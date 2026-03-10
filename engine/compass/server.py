"""Compass Engine HTTP Server — FastAPI bridge for the Electron app.

Exposes the engine as local HTTP endpoints so the Electron main process
can call it via the engine-bridge module.
"""

from __future__ import annotations

import json
import sys
import traceback
from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncGenerator

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from compass.config import ProductConfig, SourceConfig, save_config, load_config, get_compass_dir, get_output_dir
from compass.connectors import get_connector
from compass.engine.knowledge_graph import KnowledgeGraph
from compass.engine.orchestrator import get_orchestrator, configure_orchestrator
from compass.engine.reconciler import Reconciler
from compass.engine.discoverer import Discoverer
from compass.engine.specifier import Specifier
from compass.models.sources import Evidence, SourceType


_kg: KnowledgeGraph | None = None
_kg_workspace_path: str | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Compass Engine", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"status": "error", "message": str(exc), "detail": traceback.format_exc()},
    )


# ---------- Request / Response models ----------

class InitRequest(BaseModel):
    name: str
    description: str = ""
    workspace_path: str


class ConnectRequest(BaseModel):
    workspace_path: str
    source_type: str
    name: str
    path: str | None = None
    url: str | None = None


class WorkspaceRequest(BaseModel):
    workspace_path: str


class SpecifyRequest(BaseModel):
    workspace_path: str
    opportunity_title: str


class ChatRequest(BaseModel):
    workspace_path: str
    message: str
    history: list[dict] = Field(default_factory=list)


class SearchRequest(BaseModel):
    workspace_path: str
    query: str
    source_type: str | None = None
    limit: int = 20


class ConfigureRequest(BaseModel):
    api_key: str = ""
    model: str = ""
    provider: str = "anthropic"


# ---------- Health ----------

@app.get("/health")
def health():
    return {"status": "ready", "version": "0.1.0"}


# ---------- Usage ----------

@app.get("/usage")
def usage():
    orch = get_orchestrator()
    u = orch.usage
    return {
        "status": "ok",
        "session_tokens": {"input": u.input_tokens, "output": u.output_tokens},
        "total_tokens": u.total,
        "total_cost_estimate": f"${u.estimated_cost_usd:.4f}",
    }


# ---------- Configure ----------

@app.post("/configure")
def configure(req: ConfigureRequest):
    """Reconfigure the LLM provider at runtime (e.g. from the Settings page)."""
    try:
        orch = configure_orchestrator(
            api_key=req.api_key,
            model=req.model,
            provider=req.provider,
        )
        return {
            "status": "ok",
            "provider": req.provider,
            "model": req.model or orch.default_model,
        }
    except ValueError as e:
        raise HTTPException(400, str(e))


# ---------- Init ----------

@app.post("/init")
def init_workspace(req: InitRequest):
    base = Path(req.workspace_path)
    base.mkdir(parents=True, exist_ok=True)
    config = ProductConfig(name=req.name, description=req.description)
    save_config(config, base)
    return {"status": "ok", "workspace": req.workspace_path, "name": req.name}


# ---------- Connect ----------

@app.post("/connect")
def connect_source(req: ConnectRequest):
    base = Path(req.workspace_path)
    config = load_config(base)
    source = SourceConfig(type=req.source_type, name=req.name, path=req.path, url=req.url)
    config.add_source(source)
    save_config(config, base)

    connector_cls = get_connector(req.source_type)
    connector = connector_cls(source)
    valid = connector.validate()

    return {"status": "ok", "name": req.name, "type": req.source_type, "accessible": valid}


# ---------- Ingest ----------

@app.post("/ingest")
def ingest(req: WorkspaceRequest):
    global _kg, _kg_workspace_path
    base = Path(req.workspace_path)
    config = load_config(base)

    if not config.sources:
        raise HTTPException(400, "No sources connected")

    compass_dir = get_compass_dir(base)
    _kg = KnowledgeGraph(persist_dir=compass_dir / "knowledge")
    _kg_workspace_path = req.workspace_path
    _kg.clear()

    results = []
    total = 0
    for source in config.sources:
        try:
            connector_cls = get_connector(source.type)
            connector = connector_cls(source)
            evidence = connector.ingest()
            _kg.add_many(evidence)
            count = len(evidence)
            total += count
            results.append({"name": source.name, "type": source.type, "items": count})
        except Exception as e:
            results.append({"name": source.name, "type": source.type, "items": 0, "error": str(e)})

    summary = _kg.store.summary
    return {"status": "ok", "total": total, "sources": results, "summary": summary}


# ---------- Evidence ----------

@app.post("/evidence")
def get_evidence(req: WorkspaceRequest):
    kg = _get_kg(req.workspace_path)
    items = []
    for e in kg.store.items:
        items.append({
            "id": e.id,
            "source_type": e.source_type.value,
            "connector": e.connector,
            "title": e.title,
            "content": e.content,
            "metadata": e.metadata,
            "timestamp": str(e.timestamp),
        })
    return {
        "status": "ok",
        "count": len(items),
        "summary": kg.store.summary,
        "items": items,
    }


# ---------- Reconcile ----------

@app.post("/reconcile")
def reconcile(req: WorkspaceRequest):
    base = Path(req.workspace_path)
    config = load_config(base)
    kg = _get_kg(req.workspace_path)

    reconciler = Reconciler(kg, model=config.model)
    report = reconciler.reconcile()

    conflicts = []
    for c in report.conflicts:
        conflicts.append({
            "conflict_type": c.conflict_type.value,
            "severity": c.severity.value,
            "title": c.title,
            "description": c.description,
            "source_a_evidence": c.source_a_evidence,
            "source_b_evidence": c.source_b_evidence,
            "recommendation": c.recommendation,
        })

    output_dir = get_output_dir(base)
    report_lines = ["# Conflict Report\n"]
    for c in report.conflicts:
        report_lines.append(f"## [{c.severity.value.upper()}] {c.title}\n")
        report_lines.append(f"**Type:** {c.conflict_type.description}\n")
        report_lines.append(f"{c.description}\n")
        report_lines.append(f"**Recommendation:** {c.recommendation}\n\n---\n")
    (output_dir / "conflict-report.md").write_text("\n".join(report_lines))

    return {"status": "ok", "count": len(conflicts), "conflicts": conflicts}


# ---------- Discover ----------

@app.post("/discover")
def discover(req: WorkspaceRequest):
    base = Path(req.workspace_path)
    config = load_config(base)
    kg = _get_kg(req.workspace_path)

    reconciler = Reconciler(kg, model=config.model)
    conflict_report = reconciler.reconcile()

    discoverer = Discoverer(kg, model=config.model)
    opportunities = discoverer.discover(conflict_report)

    result = []
    for opp in opportunities:
        result.append({
            "rank": opp.rank,
            "title": opp.title,
            "description": opp.description,
            "confidence": opp.confidence.value,
            "evidence_summary": opp.evidence_summary,
            "evidence_ids": opp.evidence_ids,
            "conflict_ids": opp.conflict_ids,
            "estimated_impact": opp.estimated_impact,
        })

    compass_dir = get_compass_dir(base)
    cache = [opp.model_dump() for opp in opportunities]
    (compass_dir / "opportunities_cache.json").write_text(json.dumps(cache, indent=2, default=str))

    return {"status": "ok", "count": len(result), "opportunities": result}


# ---------- Specify ----------

@app.post("/specify")
def specify(req: SpecifyRequest):
    base = Path(req.workspace_path)
    config = load_config(base)
    kg = _get_kg(req.workspace_path)

    from compass.models.specs import Opportunity, Confidence

    compass_dir = get_compass_dir(base)
    cache_path = compass_dir / "opportunities_cache.json"
    opportunity = None

    if cache_path.exists():
        cache = json.loads(cache_path.read_text())
        for opp_data in cache:
            if req.opportunity_title.lower() in opp_data["title"].lower():
                opportunity = Opportunity(**opp_data)
                break

    if not opportunity:
        opportunity = Opportunity(
            rank=1,
            title=req.opportunity_title,
            description=req.opportunity_title,
            confidence=Confidence.MEDIUM,
            evidence_summary="User-specified opportunity",
        )

    specifier = Specifier(kg, model=config.model)
    spec = specifier.specify(opportunity)

    output_dir = get_output_dir(base)
    safe_name = opportunity.title.lower().replace(" ", "-")[:50]
    spec_path = output_dir / f"spec-{safe_name}.md"
    spec_path.write_text(spec.to_markdown())

    return {
        "status": "ok",
        "title": spec.title,
        "markdown": spec.to_markdown(),
        "spec": {
            "title": spec.title,
            "problem_statement": spec.problem_statement,
            "proposed_solution": spec.proposed_solution,
            "ui_changes": spec.ui_changes,
            "data_model_changes": spec.data_model_changes,
            "success_metrics": spec.success_metrics,
            "evidence_citations": spec.evidence_citations,
            "tasks": [t.model_dump() for t in spec.tasks],
            "opportunity": {
                "rank": spec.opportunity.rank,
                "title": spec.opportunity.title,
                "confidence": spec.opportunity.confidence.value,
                "estimated_impact": spec.opportunity.estimated_impact,
            },
        },
        "file": str(spec_path),
    }


# ---------- Chat ----------

CHAT_SYSTEM = """You are Compass, an AI product discovery assistant.
Answer the user's question based ONLY on the evidence provided below.
When citing evidence, use [source_type:title] format.
If the evidence doesn't contain enough information, say so clearly."""


@app.post("/chat")
def chat(req: ChatRequest):
    kg = _get_kg(req.workspace_path)
    orch = get_orchestrator()

    relevant = kg.query(req.message, n_results=8)

    evidence_context = "\n\n".join(
        f"[{e.source_type.value}:{e.connector}] {e.title}\n{e.content}"
        for e in relevant
    )

    citations = [
        {"id": e.id, "title": e.title, "source_type": e.source_type.value}
        for e in relevant
    ]

    history_text = ""
    for msg in req.history[-6:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        history_text += f"\n{role.upper()}: {content}"

    prompt = f"""Based on the following evidence from the product workspace:

{evidence_context}

{f"Conversation history:{history_text}" if history_text else ""}

USER QUESTION: {req.message}

Provide a helpful, evidence-grounded answer. Cite specific evidence using [source_type:title] format."""

    response = orch.ask(prompt, system=CHAT_SYSTEM)

    return {
        "status": "ok",
        "response": response,
        "citations": citations,
    }


@app.post("/chat/stream")
def chat_stream(req: ChatRequest):
    kg = _get_kg(req.workspace_path)
    orch = get_orchestrator()

    relevant = kg.query(req.message, n_results=8)

    evidence_context = "\n\n".join(
        f"[{e.source_type.value}:{e.connector}] {e.title}\n{e.content}"
        for e in relevant
    )

    citations = [
        {"id": e.id, "title": e.title, "source_type": e.source_type.value}
        for e in relevant
    ]

    history_text = ""
    for msg in req.history[-6:]:
        role = msg.get("role", "user")
        content = msg.get("content", "")
        history_text += f"\n{role.upper()}: {content}"

    prompt = f"""Based on the following evidence from the product workspace:

{evidence_context}

{f"Conversation history:{history_text}" if history_text else ""}

USER QUESTION: {req.message}

Provide a helpful, evidence-grounded answer. Cite specific evidence using [source_type:title] format."""

    def generate():
        yield _sse_event("citations", {"citations": citations})
        for token in orch.ask_stream(prompt, system=CHAT_SYSTEM):
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


# ---------- Search ----------

@app.post("/search")
def search(req: SearchRequest):
    kg = _get_kg(req.workspace_path)

    relevant = kg.query(req.query, n_results=req.limit)

    if req.source_type:
        relevant = [e for e in relevant if e.source_type.value == req.source_type]

    items = [
        {
            "id": e.id,
            "source_type": e.source_type.value,
            "connector": e.connector,
            "title": e.title,
            "content": e.content[:300],
            "metadata": e.metadata,
        }
        for e in relevant
    ]

    return {"status": "ok", "count": len(items), "items": items}


# ---------- SSE Streaming variants ----------

def _sse_event(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@app.post("/reconcile/stream")
def reconcile_stream(req: WorkspaceRequest):
    base = Path(req.workspace_path)
    config = load_config(base)
    kg = _get_kg(req.workspace_path)

    def generate() -> AsyncGenerator[str, None]:
        yield _sse_event("progress", {"step": "Starting reconciliation...", "pct": 0})

        reconciler = Reconciler(kg, model=config.model)
        yield _sse_event("progress", {"step": "Comparing source pairs...", "pct": 20})

        report = reconciler.reconcile()
        yield _sse_event("progress", {"step": "Analysis complete", "pct": 100})

        conflicts = []
        for c in report.conflicts:
            conflicts.append({
                "conflict_type": c.conflict_type.value,
                "severity": c.severity.value,
                "title": c.title,
                "description": c.description,
                "source_a_evidence": c.source_a_evidence,
                "source_b_evidence": c.source_b_evidence,
                "recommendation": c.recommendation,
            })

        yield _sse_event("result", {"count": len(conflicts), "conflicts": conflicts})

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/discover/stream")
def discover_stream(req: WorkspaceRequest):
    base = Path(req.workspace_path)
    config = load_config(base)
    kg = _get_kg(req.workspace_path)

    def generate() -> AsyncGenerator[str, None]:
        yield _sse_event("progress", {"step": "Reconciling sources...", "pct": 10})

        reconciler = Reconciler(kg, model=config.model)
        conflict_report = reconciler.reconcile()
        yield _sse_event("progress", {"step": "Analyzing opportunities...", "pct": 50})

        discoverer = Discoverer(kg, model=config.model)
        opportunities = discoverer.discover(conflict_report)
        yield _sse_event("progress", {"step": "Discovery complete", "pct": 100})

        result = []
        for opp in opportunities:
            result.append({
                "rank": opp.rank,
                "title": opp.title,
                "description": opp.description,
                "confidence": opp.confidence.value,
                "evidence_summary": opp.evidence_summary,
                "estimated_impact": opp.estimated_impact,
            })

        compass_dir = get_compass_dir(base)
        cache = [opp.model_dump() for opp in opportunities]
        (compass_dir / "opportunities_cache.json").write_text(json.dumps(cache, indent=2, default=str))

        yield _sse_event("result", {"count": len(result), "opportunities": result})

    return StreamingResponse(generate(), media_type="text/event-stream")


# ---------- Helpers ----------

def _get_kg(workspace_path: str) -> KnowledgeGraph:
    """Get the knowledge graph, loading from persistence (no re-ingestion).

    If the workspace_path differs from the cached one, create a new KG
    for the new workspace (workspace isolation).
    """
    global _kg, _kg_workspace_path

    # If we have a cached KG for a different workspace, discard it
    if _kg and _kg_workspace_path != workspace_path:
        _kg = None
        _kg_workspace_path = None

    if _kg and len(_kg) > 0:
        return _kg

    base = Path(workspace_path)
    compass_dir = get_compass_dir(base)
    _kg = KnowledgeGraph(persist_dir=compass_dir / "knowledge")
    _kg_workspace_path = workspace_path

    if len(_kg) == 0:
        raise HTTPException(400, "No evidence ingested. Run ingest first.")

    return _kg


def main():
    """Run the engine server."""
    import uvicorn
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 9811
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")


if __name__ == "__main__":
    main()
