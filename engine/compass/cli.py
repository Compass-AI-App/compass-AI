"""Compass CLI — the product discovery command line.

Usage:
    compass init "My Product"
    compass connect github --path ./my-repo
    compass connect interviews --path ./interviews/
    compass ingest
    compass reconcile
    compass discover
    compass specify "Fix sync reliability"
    compass status
"""

from __future__ import annotations

from pathlib import Path

import typer
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.markdown import Markdown

from compass import __version__
from compass.config import (
    ProductConfig,
    SourceConfig,
    load_config,
    save_config,
    get_compass_dir,
    get_output_dir,
)

app = typer.Typer(
    name="compass",
    help="Compass — Cursor for Product Managers. AI-native product discovery.",
    no_args_is_help=True,
)
console = Console()

# Color-coded source type indicators
SOURCE_COLORS = {
    "code": "blue",
    "docs": "green",
    "data": "yellow",
    "judgment": "magenta",
}


def _source_badge(source_type: str) -> str:
    """Return a color-coded source type badge."""
    color = SOURCE_COLORS.get(source_type, "white")
    return f"[{color}][{source_type.upper()}][/{color}]"


@app.callback(invoke_without_command=True)
def main(
    version: bool = typer.Option(False, "--version", "-v", help="Show version"),
):
    if version:
        console.print(f"compass {__version__}")
        raise typer.Exit()


# --- init ---

@app.command()
def init(
    name: str = typer.Argument(..., help="Product name"),
    description: str = typer.Option("", "--description", "-d", help="Product description"),
):
    """Initialize a Compass product workspace."""
    config = ProductConfig(name=name, description=description)
    path = save_config(config)

    console.print(Panel(
        f"[bold green]Compass workspace initialized[/bold green]\n\n"
        f"Product: [bold]{name}[/bold]\n"
        f"Config:  {path}\n\n"
        f"Next steps:\n"
        f"  compass connect github --path ./your-repo\n"
        f"  compass connect docs --path ./strategy-docs/\n"
        f"  compass connect analytics --path ./data.csv\n"
        f"  compass connect interviews --path ./interviews/\n"
        f"  compass connect support --path ./tickets.csv",
        title="compass",
    ))


# --- connect ---

@app.command()
def connect(
    source_type: str = typer.Argument(..., help="Source type: github, docs, analytics, interviews, support"),
    path: str = typer.Option(None, "--path", "-p", help="Local file or directory path"),
    url: str = typer.Option(None, "--url", "-u", help="Remote URL (e.g. GitHub repo)"),
    name: str = typer.Option(None, "--name", "-n", help="Custom name for this source"),
):
    """Connect an evidence source."""
    config = load_config()

    source_name = name or f"{source_type}:{Path(path).name if path else url or 'default'}"
    source = SourceConfig(type=source_type, name=source_name, path=path, url=url)
    config.add_source(source)
    save_config(config)

    from compass.connectors import get_connector
    connector_cls = get_connector(source_type)
    connector = connector_cls(source)
    valid = connector.validate()

    status = "[green]accessible[/green]" if valid else "[red]not accessible[/red]"
    console.print(f"  Connected [bold]{source_name}[/bold] ({source_type}) — {status}")


# --- ingest ---

@app.command()
def ingest():
    """Ingest evidence from all connected sources."""
    config = load_config()

    if not config.sources:
        console.print("[yellow]No sources connected. Run 'compass connect' first.[/yellow]")
        raise typer.Exit(1)

    from compass.connectors import get_connector
    from compass.engine.knowledge_graph import KnowledgeGraph

    compass_dir = get_compass_dir()
    kg = KnowledgeGraph(persist_dir=compass_dir / "knowledge")

    # Clear previous ingestion
    kg.clear()

    total = 0
    table = Table(title="Ingestion Results")
    table.add_column("Source", style="bold")
    table.add_column("Type")
    table.add_column("Items", justify="right")

    from datetime import datetime
    from compass.models.sources import CONNECTOR_SOURCE_MAP

    for source in config.sources:
        try:
            connector_cls = get_connector(source.type)
            connector = connector_cls(source)
            evidence = connector.ingest()
            now = datetime.now()
            for ev in evidence:
                ev.source_name = source.name
                ev.ingested_at = now
            kg.add_many(evidence)
            count = len(evidence)
            total += count
            source_type = CONNECTOR_SOURCE_MAP.get(source.type, source.type)
            type_str = _source_badge(source_type.value if hasattr(source_type, 'value') else source_type)
            table.add_row(source.name, type_str, str(count))
        except Exception as e:
            table.add_row(source.name, source.type, f"[red]Error: {e}[/red]")

    console.print(table)
    console.print(f"\n[bold green]Ingested {total} evidence items from {len(config.sources)} sources[/bold green]")

    # Save summary
    summary = kg.store.summary
    summary_lines = [f"Total evidence: {total}"]
    for source_type, count in summary.items():
        summary_lines.append(f"  {source_type}: {count}")
    (compass_dir / "last_ingest.txt").write_text("\n".join(summary_lines))


# --- reconcile ---

@app.command()
def reconcile():
    """Surface conflicts across the four sources of truth."""
    config = load_config()
    compass_dir = get_compass_dir()

    from compass.engine.reconciler import Reconciler

    kg = _load_knowledge_graph(compass_dir)
    if not kg:
        return

    reconciler = Reconciler(kg, model=config.model)
    report = reconciler.reconcile()

    if not report.conflicts:
        console.print("[green]No conflicts detected between sources.[/green]")
        return

    high_count = len(report.high)
    console.print(f"\n[bold]Found {len(report)} conflicts[/bold]"
                  + (f" ([red]{high_count} high severity[/red])" if high_count else "")
                  + "\n")

    for conflict in report.conflicts:
        severity_color = {"high": "red", "medium": "yellow", "low": "dim"}
        color = severity_color.get(conflict.severity.value, "white")
        sources = conflict.conflict_type.sources
        badge_a = _source_badge(sources[0].value)
        badge_b = _source_badge(sources[1].value)
        signal = f"  Signal: {conflict.signal_strength} evidence items" if conflict.signal_strength > 0 else ""

        console.print(Panel(
            f"[bold]{conflict.title}[/bold]\n\n"
            f"{conflict.description}\n\n"
            f"{badge_a} vs {badge_b} — {conflict.conflict_type.description}\n"
            f"[dim]Recommendation: {conflict.recommendation}[/dim]"
            f"[dim]{signal}[/dim]",
            title=f"[{color}]{conflict.severity.value.upper()}[/{color}]",
            border_style=color,
        ))

    console.print(f"[dim]Conflicts reveal where your product's sources of truth disagree — "
                  f"these are where opportunities hide.[/dim]")

    # Save report
    output_dir = get_output_dir()
    report_path = output_dir / "conflict-report.md"
    _save_conflict_report(report, report_path)
    console.print(f"[dim]Report saved to {report_path}[/dim]")


# --- discover ---

@app.command()
def discover():
    """Ask: 'What should we build next?' — evidence-grounded product discovery."""
    config = load_config()
    compass_dir = get_compass_dir()

    from compass.engine.reconciler import Reconciler
    from compass.engine.discoverer import Discoverer

    kg = _load_knowledge_graph(compass_dir)
    if not kg:
        return

    # Run reconciliation first to feed into discovery
    console.print("[dim]Running reconciliation...[/dim]")
    reconciler = Reconciler(kg, model=config.model)
    conflict_report = reconciler.reconcile()

    console.print("[dim]Synthesizing opportunities...[/dim]")
    discoverer = Discoverer(kg, model=config.model)
    opportunities = discoverer.discover(conflict_report)

    if not opportunities:
        console.print("[yellow]No clear opportunities found. Try adding more evidence sources.[/yellow]")
        return

    console.print(f"\n[bold]Top {len(opportunities)} Opportunities[/bold]")
    console.print("[dim]Ranked by confidence and impact, grounded in evidence.[/dim]\n")

    for opp in opportunities:
        confidence_color = {"high": "green", "medium": "yellow", "low": "dim"}
        color = confidence_color.get(opp.confidence.value, "white")
        confidence_badge = f"[{color}]{opp.confidence.value.upper()}[/{color}]"

        console.print(Panel(
            f"[bold]{opp.description}[/bold]\n\n"
            f"[dim]Evidence:[/dim] {opp.evidence_summary}\n\n"
            f"[dim]Impact:[/dim] {opp.estimated_impact}",
            title=f"#{opp.rank} {confidence_badge}  {opp.title}",
        ))

    # Save opportunities
    output_dir = get_output_dir()
    opp_path = output_dir / "opportunities.md"
    _save_opportunities(opportunities, opp_path)
    console.print(f"\n[dim]Opportunities saved to {opp_path}[/dim]")
    console.print(f"\nRun [bold]compass specify \"{opportunities[0].title}\"[/bold] to generate a feature spec.")

    # Cache opportunities for specify command
    import json
    cache = [opp.model_dump() for opp in opportunities]
    (compass_dir / "opportunities_cache.json").write_text(json.dumps(cache, indent=2, default=str))

    # Record in history
    from compass.engine.history import record_discovery
    record_discovery(compass_dir, opportunities, conflict_report)


# --- specify ---

@app.command()
def specify(
    opportunity_title: str = typer.Argument(..., help="Title of the opportunity to specify (from discover output)"),
):
    """Generate an agent-ready feature spec from a discovered opportunity."""
    config = load_config()
    compass_dir = get_compass_dir()

    from compass.engine.specifier import Specifier
    from compass.models.specs import Opportunity, Confidence

    kg = _load_knowledge_graph(compass_dir)
    if not kg:
        return

    # Load cached opportunities
    import json
    cache_path = compass_dir / "opportunities_cache.json"
    opportunity = None

    if cache_path.exists():
        cache = json.loads(cache_path.read_text())
        for opp_data in cache:
            if opp_data["title"].lower() == opportunity_title.lower():
                opportunity = Opportunity(**opp_data)
                break
            if opportunity_title.lower() in opp_data["title"].lower():
                opportunity = Opportunity(**opp_data)
                break

    if not opportunity:
        # Create a minimal opportunity from the title
        opportunity = Opportunity(
            rank=1,
            title=opportunity_title,
            description=opportunity_title,
            confidence=Confidence.MEDIUM,
            evidence_summary="User-specified opportunity",
        )

    specifier = Specifier(kg, model=config.model)
    spec = specifier.specify(opportunity)

    # Display spec
    md = Markdown(spec.to_markdown())
    console.print(md)

    # Save spec
    output_dir = get_output_dir()
    safe_name = opportunity.title.lower().replace(" ", "-")[:50]
    spec_path = output_dir / f"spec-{safe_name}.md"
    spec_path.write_text(spec.to_markdown())
    console.print(f"\n[dim]Spec saved to {spec_path}[/dim]")


# --- refresh ---

@app.command()
def refresh(
    source_name: str = typer.Argument(None, help="Source name to refresh (e.g. 'github:my-repo'). Refreshes all if omitted."),
):
    """Re-ingest evidence from one source (or all), replacing old data."""
    config = load_config()

    if not config.sources:
        console.print("[yellow]No sources connected. Run 'compass connect' first.[/yellow]")
        raise typer.Exit(1)

    from compass.connectors import get_connector
    from compass.engine.knowledge_graph import KnowledgeGraph
    from datetime import datetime

    compass_dir = get_compass_dir()
    kg = KnowledgeGraph(persist_dir=compass_dir / "knowledge")

    sources_to_refresh = config.sources
    if source_name:
        sources_to_refresh = [s for s in config.sources if s.name == source_name]
        if not sources_to_refresh:
            console.print(f"[red]Source '{source_name}' not found. Available: {', '.join(s.name for s in config.sources)}[/red]")
            raise typer.Exit(1)

    table = Table(title="Refresh Results")
    table.add_column("Source", style="bold")
    table.add_column("Removed", justify="right")
    table.add_column("Added", justify="right")

    for source in sources_to_refresh:
        try:
            # Remove old evidence from this source
            removed = kg.remove_by_connector(source.name)
            if removed == 0:
                # Try connector type as fallback
                removed = kg.remove_by_connector(source.type)

            # Re-ingest
            connector_cls = get_connector(source.type)
            connector = connector_cls(source)
            evidence = connector.ingest()
            now = datetime.now()
            for ev in evidence:
                ev.source_name = source.name
                ev.ingested_at = now
            kg.add_many(evidence)
            table.add_row(source.name, str(removed), str(len(evidence)))
        except Exception as e:
            table.add_row(source.name, "?", f"[red]Error: {e}[/red]")

    console.print(table)
    console.print(f"\n[bold green]Refresh complete. Total evidence: {len(kg)}[/bold green]")


# --- ask ---

ASK_SYSTEM = """You are Compass, an AI product discovery assistant. You answer questions about
the user's product based on ingested evidence from four sources of truth:
- Code (technical reality), Docs (strategy & specs), Data (metrics & usage), Judgment (user feedback)

Rules:
1. Ground every claim in specific evidence. Cite evidence titles in [brackets].
2. If the evidence doesn't support an answer, say so — don't speculate.
3. When sources disagree, highlight the conflict explicitly.
4. Be concise but thorough. PMs need actionable answers, not essays."""

ASK_PROMPT = """## Question
{question}

## Relevant Evidence
{evidence}

## Instructions
Answer the question using only the evidence above. Cite specific evidence items by title
in [brackets]. If sources disagree, highlight the conflict. If evidence is insufficient,
say what's missing."""


@app.command()
def ask(
    question: str = typer.Argument(None, help="Question to ask about your product"),
):
    """Ask a question about your product, grounded in evidence."""
    config = load_config()
    compass_dir = get_compass_dir()

    kg = _load_knowledge_graph(compass_dir)
    if not kg:
        return

    if question:
        _ask_single(kg, config, question)
    else:
        _ask_interactive(kg, config, compass_dir)


def _ask_single(kg, config, question: str):
    """Handle a single question with streaming response."""
    from compass.engine.llm import ask_stream

    related = kg.query(question, n_results=10)
    evidence_lines = []
    for ev in related:
        preview = ev.content[:300] + "..." if len(ev.content) > 300 else ev.content
        evidence_lines.append(f"- [{ev.source_type.value}:{ev.connector}] **{ev.title}**: {preview}")
    evidence_text = "\n".join(evidence_lines) if evidence_lines else "(no relevant evidence found)"

    prompt = ASK_PROMPT.format(question=question, evidence=evidence_text)

    from rich.live import Live
    from rich.text import Text

    response_text = ""
    with Live("", console=console, refresh_per_second=10) as live:
        for chunk in ask_stream(prompt, system=ASK_SYSTEM, model=config.model):
            response_text += chunk
            live.update(Markdown(response_text))

    # Show cited sources
    if related:
        console.print("\n[dim]─── Sources ───[/dim]")
        seen = set()
        for ev in related:
            key = f"{ev.source_type.value}:{ev.connector}"
            if key not in seen:
                seen.add(key)
                console.print(f"  [dim]{key} ({len([e for e in related if e.connector == ev.connector])} items)[/dim]")


def _ask_interactive(kg, config, compass_dir: Path):
    """Interactive multi-turn chat mode."""
    import json
    from compass.engine.llm import ask_stream
    from rich.live import Live

    history_path = compass_dir / "chat_history.json"
    history: list[dict] = []
    if history_path.exists():
        try:
            history = json.loads(history_path.read_text())
        except Exception:
            history = []

    console.print(Panel(
        "[bold]Compass Chat[/bold]\n\n"
        "Ask questions about your product grounded in evidence.\n"
        "Type [bold]quit[/bold] or [bold]exit[/bold] to leave.\n"
        "History is saved between sessions.",
        border_style="blue",
    ))

    while True:
        try:
            question = console.input("\n[bold blue]You:[/bold blue] ").strip()
        except (EOFError, KeyboardInterrupt):
            break

        if not question or question.lower() in ("quit", "exit", "q"):
            break

        related = kg.query(question, n_results=10)
        evidence_lines = []
        for ev in related:
            preview = ev.content[:300] + "..." if len(ev.content) > 300 else ev.content
            evidence_lines.append(f"- [{ev.source_type.value}:{ev.connector}] **{ev.title}**: {preview}")
        evidence_text = "\n".join(evidence_lines) if evidence_lines else "(no relevant evidence found)"

        # Build prompt with recent history for context
        history_context = ""
        if history:
            recent = history[-6:]  # last 3 exchanges
            history_lines = []
            for entry in recent:
                history_lines.append(f"User: {entry['question']}")
                history_lines.append(f"Assistant: {entry['answer'][:200]}...")
            history_context = "\n## Recent Conversation\n" + "\n".join(history_lines) + "\n"

        prompt = ASK_PROMPT.format(question=question, evidence=evidence_text)
        if history_context:
            prompt = history_context + "\n" + prompt

        console.print()
        response_text = ""
        with Live("", console=console, refresh_per_second=10) as live:
            for chunk in ask_stream(prompt, system=ASK_SYSTEM, model=config.model):
                response_text += chunk
                live.update(Markdown(response_text))

        history.append({"question": question, "answer": response_text})
        history_path.write_text(json.dumps(history, indent=2))


# --- status ---

@app.command()
def status(
    health: bool = typer.Option(False, "--health", help="Show evidence freshness per source"),
):
    """Show the current state of the Compass workspace."""
    try:
        config = load_config()
    except FileNotFoundError:
        console.print("[yellow]No Compass workspace found. Run 'compass init' first.[/yellow]")
        raise typer.Exit(1)

    console.print(Panel(
        f"[bold]{config.name}[/bold]" + (f"\n{config.description}" if config.description else ""),
        title="Compass Workspace",
    ))

    if config.sources:
        table = Table(title="Connected Sources")
        table.add_column("Name", style="bold")
        table.add_column("Type")
        table.add_column("Path / URL")

        for source in config.sources:
            table.add_row(source.name, source.type, source.path or source.url or "")

        console.print(table)
    else:
        console.print("[dim]No sources connected yet.[/dim]")

    compass_dir = get_compass_dir()

    if health:
        _show_health(compass_dir)
        return

    ingest_summary = compass_dir / "last_ingest.txt"
    if ingest_summary.exists():
        console.print(f"\n[dim]{ingest_summary.read_text()}[/dim]")

    # Show existing outputs
    output_dir = get_output_dir()
    outputs = list(output_dir.glob("*.md"))
    if outputs:
        console.print(f"\n[dim]Outputs: {', '.join(f.name for f in outputs)}[/dim]")


def _show_health(compass_dir: Path):
    """Show evidence freshness per source."""
    from datetime import datetime, timedelta
    from compass.engine.knowledge_graph import KnowledgeGraph

    kg = KnowledgeGraph(persist_dir=compass_dir / "knowledge")
    if len(kg) == 0:
        console.print("[yellow]No evidence ingested yet.[/yellow]")
        return

    # Group by source_name (or connector if source_name not set)
    source_groups: dict[str, list] = {}
    for ev in kg.store.items:
        key = ev.source_name or f"{ev.source_type.value}:{ev.connector}"
        source_groups.setdefault(key, []).append(ev)

    table = Table(title="Evidence Health")
    table.add_column("Source", style="bold")
    table.add_column("Type")
    table.add_column("Items", justify="right")
    table.add_column("Last Ingested")
    table.add_column("Status")

    stale_threshold = datetime.now() - timedelta(days=7)

    for source_name, items in sorted(source_groups.items()):
        source_type = items[0].source_type.value
        count = len(items)
        latest = max(ev.ingested_at for ev in items)
        age = datetime.now() - latest

        if age < timedelta(hours=1):
            age_str = f"{int(age.total_seconds() // 60)} minutes ago"
        elif age < timedelta(days=1):
            age_str = f"{int(age.total_seconds() // 3600)} hours ago"
        else:
            age_str = f"{age.days} days ago"

        if latest < stale_threshold:
            status_str = "[red]stale[/red]"
        else:
            status_str = "[green]fresh[/green]"

        table.add_row(source_name, source_type, str(count), age_str, status_str)

    console.print(table)


# --- history ---

@app.command()
def history():
    """Show discovery history — how opportunities and conflicts evolved over time."""
    from compass.engine.history import get_history_summary

    compass_dir = get_compass_dir()
    summary = get_history_summary(compass_dir)

    if summary.get("total_runs", 0) == 0:
        console.print("[dim]No discovery history yet. Run: compass discover[/dim]")
        return

    console.print(f"\n[bold]Discovery History[/bold]")
    console.print(f"[dim]Total runs: {summary['total_runs']}  |  First: {summary.get('first_run', 'N/A')[:10]}  |  Last: {summary.get('last_run', 'N/A')[:10]}[/dim]")
    console.print(f"[dim]Unique opportunities: {summary.get('total_unique_opportunities', 0)}  |  Unique conflicts: {summary.get('total_unique_conflicts', 0)}[/dim]\n")

    recurring = summary.get("recurring_opportunities", {})
    if recurring:
        console.print("[bold]Recurring Opportunities[/bold] (appeared in 2+ runs)")
        for title, count in sorted(recurring.items(), key=lambda x: -x[1]):
            console.print(f"  [green]↻[/green] {title} — appeared {count}x")
        console.print()

    persistent = summary.get("persistent_conflicts", {})
    if persistent:
        console.print("[bold]Persistent Conflicts[/bold] (detected in 2+ runs)")
        for title, count in sorted(persistent.items(), key=lambda x: -x[1]):
            console.print(f"  [red]⚠[/red] {title} — detected {count}x")
        console.print()


# --- feedback ---

@app.command()
def feedback(
    export: bool = typer.Option(False, "--export", help="Export all feedback as markdown"),
):
    """View or export user feedback collected by the Compass app."""
    import json

    compass_dir = get_compass_dir()
    feedback_file = compass_dir / "feedback.json"

    if export:
        # Try app's localStorage feedback (copied to .compass) or direct file
        if not feedback_file.exists():
            console.print("[dim]No feedback found. Feedback is collected in the Compass app.[/dim]")
            return

        entries = json.loads(feedback_file.read_text())
        if not entries:
            console.print("[dim]No feedback entries yet.[/dim]")
            return

        lines = ["# Compass Feedback Export", "", f"Total: {len(entries)} entries", ""]
        for entry in entries:
            lines.append(f"## [{entry.get('type', 'general').upper()}] {entry.get('timestamp', 'unknown')}")
            lines.append("")
            lines.append(entry.get("message", ""))
            lines.append("")
            lines.append(f"_App version: {entry.get('appVersion', 'unknown')}_")
            lines.append("")
            lines.append("---")
            lines.append("")

        md = "\n".join(lines)
        console.print(Markdown(md))
    else:
        console.print("[dim]Use [bold]compass feedback --export[/bold] to view all feedback as markdown.[/dim]")


# --- doctor ---

@app.command()
def doctor(
    fix: bool = typer.Option(False, "--fix", help="Attempt to auto-fix issues"),
):
    """Pre-flight check to diagnose Compass setup issues."""
    import shutil
    import sys

    checks_passed = 0
    checks_failed = 0

    def _check(name: str, passed: bool, fix_hint: str = ""):
        nonlocal checks_passed, checks_failed
        if passed:
            console.print(f"  [green]\u2713[/green] {name}")
            checks_passed += 1
        else:
            msg = f"  [red]\u2717[/red] {name}"
            if fix_hint:
                msg += f"  [dim]→ {fix_hint}[/dim]"
            console.print(msg)
            checks_failed += 1

    console.print("\n[bold]Compass Doctor[/bold]\n")

    # 1. Python version
    py_version = sys.version_info
    _check(
        f"Python {py_version.major}.{py_version.minor}.{py_version.micro}",
        py_version >= (3, 11),
        "Compass requires Python 3.11+",
    )

    # 2. Workspace exists
    compass_dir = Path.cwd() / ".compass"
    workspace_exists = compass_dir.exists()
    if not workspace_exists and fix:
        compass_dir.mkdir(exist_ok=True)
        (compass_dir / "output").mkdir(exist_ok=True)
        workspace_exists = True
        console.print("    [dim](created .compass/ directory)[/dim]")
    _check("Workspace found (.compass/)", workspace_exists, "Run: compass init \"My Product\"")

    # 3. Config file
    config_file = compass_dir / "compass.yaml"
    _check("Config file exists", config_file.exists(), "Run: compass init \"My Product\"")

    # 4. Sources connected
    sources_connected = False
    source_count = 0
    if config_file.exists():
        try:
            config = load_config()
            source_count = len(config.sources)
            sources_connected = source_count > 0
        except Exception:
            pass
    _check(
        f"Sources connected ({source_count})",
        sources_connected,
        "Run: compass connect <type> --path <path>",
    )

    # 5. Evidence ingested
    evidence_file = compass_dir / "knowledge" / "evidence_store.json"
    evidence_ingested = evidence_file.exists()
    _check("Evidence ingested", evidence_ingested, "Run: compass ingest")

    # 6. API key
    import os
    api_key_set = bool(os.environ.get("ANTHROPIC_API_KEY"))
    _check(
        "API key configured",
        api_key_set,
        "Set ANTHROPIC_API_KEY environment variable",
    )

    # 7. Engine reachable
    engine_ok = False
    try:
        import urllib.request
        res = urllib.request.urlopen("http://localhost:9811/health", timeout=2)
        data = res.read().decode()
        engine_ok = "ready" in data
    except Exception:
        pass
    _check(
        "Engine server reachable",
        engine_ok,
        "Run: compass server (or start the Compass app)",
    )

    # Summary
    console.print()
    if checks_failed == 0:
        console.print(f"[green bold]All {checks_passed} checks passed![/green bold]\n")
    else:
        console.print(f"[yellow]{checks_passed} passed, {checks_failed} failed[/yellow]\n")


# --- demo ---

@app.command()
def demo(
    skip_spec: bool = typer.Option(False, "--skip-spec", help="Skip spec generation for faster demo"),
):
    """Run the full Compass pipeline on compelling sample data in one command."""
    import time
    import tempfile
    import shutil
    from datetime import datetime

    start_time = time.time()

    # Find sample data
    demo_data_dir = _find_demo_data()
    if not demo_data_dir:
        console.print("[red]Could not find demo sample data.[/red]")
        raise typer.Exit(1)

    console.print(Panel(
        "[bold]Compass Demo[/bold]\n\n"
        "Watch Compass analyze a real product (SyncFlow) across 5 evidence sources\n"
        "and surface where the sources of truth disagree.",
        border_style="blue",
    ))
    console.print()

    # Create temp workspace
    workspace = Path(tempfile.mkdtemp(prefix="compass-demo-"))

    try:
        # Step 1: Init
        console.print("[bold cyan]Step 1/5:[/bold cyan] Initializing workspace...")
        config = ProductConfig(
            name="SyncFlow",
            description="Real-time integration platform — the plumbing that keeps tools in sync",
        )
        save_config(config, workspace)

        # Step 2: Connect sources
        console.print("[bold cyan]Step 2/5:[/bold cyan] Connecting 5 evidence sources...")
        sources = [
            SourceConfig(type="github", name="code:syncflow-engine", path=str(demo_data_dir / "code")),
            SourceConfig(type="docs", name="docs:strategy", path=str(demo_data_dir / "strategy")),
            SourceConfig(type="analytics", name="analytics:metrics", path=str(demo_data_dir / "analytics")),
            SourceConfig(type="interviews", name="interviews:customers", path=str(demo_data_dir / "interviews")),
            SourceConfig(type="support", name="support:tickets", path=str(demo_data_dir / "support")),
        ]
        for source in sources:
            config.add_source(source)
        save_config(config, workspace)
        console.print(f"  Connected: {', '.join(s.name for s in sources)}")

        # Step 3: Ingest
        console.print("[bold cyan]Step 3/5:[/bold cyan] Ingesting evidence...")
        from compass.connectors import get_connector
        from compass.engine.knowledge_graph import KnowledgeGraph

        compass_dir = get_compass_dir(workspace)
        kg = KnowledgeGraph(persist_dir=compass_dir / "knowledge")
        kg.clear()

        total = 0
        for source in config.sources:
            connector_cls = get_connector(source.type)
            connector = connector_cls(source)
            evidence = connector.ingest()
            now = datetime.now()
            for ev in evidence:
                ev.source_name = source.name
                ev.ingested_at = now
            kg.add_many(evidence)
            total += len(evidence)
            console.print(f"  [dim]{source.name}: {len(evidence)} items[/dim]")

        ingest_time = time.time() - start_time
        console.print(f"  [green]Ingested {total} evidence items from {len(sources)} sources ({ingest_time:.1f}s)[/green]")
        console.print()

        # Step 4: Reconcile
        console.print("[bold cyan]Step 4/5:[/bold cyan] Finding conflicts between sources of truth...")
        from compass.engine.reconciler import Reconciler

        reconciler = Reconciler(kg, model=config.model)
        report = reconciler.reconcile()

        if report.conflicts:
            console.print(f"\n  [bold]Found {len(report)} conflicts[/bold]\n")
            for conflict in report.conflicts:
                severity_color = {"high": "red", "medium": "yellow", "low": "dim"}
                color = severity_color.get(conflict.severity.value, "white")
                console.print(Panel(
                    f"[bold]{conflict.title}[/bold]\n\n"
                    f"{conflict.description}\n\n"
                    f"[dim]Recommendation: {conflict.recommendation}[/dim]",
                    title=f"[{color}]{conflict.severity.value.upper()}[/{color}] — {conflict.conflict_type.description}",
                    border_style=color,
                    width=90,
                ))
        console.print()

        # Step 5: Discover
        console.print("[bold cyan]Step 5/5:[/bold cyan] Synthesizing product opportunities...")
        from compass.engine.discoverer import Discoverer

        discoverer = Discoverer(kg, model=config.model)
        opportunities = discoverer.discover(report)

        if opportunities:
            console.print(f"\n  [bold]Top {len(opportunities)} Opportunities[/bold]\n")
            for opp in opportunities:
                confidence_color = {"high": "green", "medium": "yellow", "low": "dim"}
                color = confidence_color.get(opp.confidence.value, "white")
                console.print(Panel(
                    f"[bold]{opp.description}[/bold]\n\n"
                    f"[dim]Evidence:[/dim] {opp.evidence_summary}\n\n"
                    f"[dim]Impact:[/dim] {opp.estimated_impact}",
                    title=f"#{opp.rank} [{color}]{opp.confidence.value.upper()}[/{color}]  {opp.title}",
                    width=90,
                ))

        # Optional: Generate spec for #1 opportunity
        if not skip_spec and opportunities:
            console.print()
            console.print("[bold cyan]Bonus:[/bold cyan] Generating agent-ready spec for #1 opportunity...")
            from compass.engine.specifier import Specifier
            specifier = Specifier(kg, model=config.model)
            spec = specifier.specify(opportunities[0])
            console.print()
            console.print(Markdown(spec.to_markdown()))

        # Summary
        elapsed = time.time() - start_time
        console.print()
        console.print(Panel(
            f"[bold green]Compass analyzed {total} evidence items from {len(sources)} sources "
            f"in {elapsed:.0f} seconds.[/bold green]\n\n"
            f"Conflicts found: {len(report)}\n"
            f"Opportunities surfaced: {len(opportunities)}\n\n"
            f"[dim]This is what Compass does: it reads your product's sources of truth,\n"
            f"finds where they disagree, and tells you what to build next — grounded\n"
            f"in evidence, not opinion.[/dim]",
            title="[bold]Demo Complete[/bold]",
            border_style="green",
        ))

    finally:
        # Cleanup
        shutil.rmtree(workspace, ignore_errors=True)


def _find_demo_data() -> Path | None:
    """Find the demo sample data directory."""
    # Check relative to repo root
    candidates = [
        Path(__file__).parent.parent.parent / "demo" / "sample_data",  # engine/compass/cli.py -> demo/
        Path.cwd() / "demo" / "sample_data",
        Path.cwd().parent / "demo" / "sample_data",
    ]
    for candidate in candidates:
        if candidate.exists() and (candidate / "code").exists():
            return candidate
    return None


# --- cloud auth ---

CLOUD_TOKEN_KEY = "compass-cloud-token"
CLOUD_URL_DEFAULT = "https://api.compass.dev"


def _get_cloud_url() -> str:
    import os
    return os.environ.get("COMPASS_CLOUD_URL", CLOUD_URL_DEFAULT)


def _save_cloud_token(token: str) -> None:
    token_file = Path.home() / ".compass" / "cloud_token"
    token_file.parent.mkdir(parents=True, exist_ok=True)
    token_file.write_text(token)


def _load_cloud_token() -> str | None:
    token_file = Path.home() / ".compass" / "cloud_token"
    if token_file.exists():
        return token_file.read_text().strip()
    import os
    return os.environ.get("COMPASS_AUTH_TOKEN")


@app.command()
def login(
    email: str = typer.Option(..., prompt=True),
    password: str = typer.Option(..., prompt=True, hide_input=True),
):
    """Log in to Compass Cloud."""
    import json
    import urllib.request
    import urllib.error

    url = f"{_get_cloud_url()}/auth/login"
    payload = json.dumps({"email": email, "password": password}).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            _save_cloud_token(data["token"])
            console.print(f"[green]Logged in as {data['email']} ({data['plan']} plan)[/green]")
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode()) if e.fp else {}
        console.print(f"[red]Login failed: {body.get('detail', 'Unknown error')}[/red]")
    except Exception as e:
        console.print(f"[red]Connection error: {e}[/red]")


@app.command()
def signup(
    email: str = typer.Option(..., prompt=True),
    password: str = typer.Option(..., prompt=True, hide_input=True, confirmation_prompt=True),
):
    """Create a Compass Cloud account."""
    import json
    import urllib.request
    import urllib.error

    url = f"{_get_cloud_url()}/auth/signup"
    payload = json.dumps({"email": email, "password": password}).encode()
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            _save_cloud_token(data["token"])
            console.print(f"[green]Account created! Logged in as {data['email']} (free plan, 50k tokens/month)[/green]")
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode()) if e.fp else {}
        console.print(f"[red]Signup failed: {body.get('detail', 'Unknown error')}[/red]")
    except Exception as e:
        console.print(f"[red]Connection error: {e}[/red]")


@app.command()
def whoami():
    """Show current Compass Cloud account info."""
    import json
    import urllib.request
    import urllib.error

    token = _load_cloud_token()
    if not token:
        console.print("[dim]Not logged in. Run: compass login[/dim]")
        return

    url = f"{_get_cloud_url()}/auth/me"
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
            console.print(f"Email: [bold]{data['email']}[/bold]")
            console.print(f"Plan:  {data['plan']}")
            limit = data.get('token_limit', 0)
            usage = data.get('token_usage_month', 0)
            if limit > 0:
                console.print(f"Usage: {usage:,} / {limit:,} tokens this month")
            else:
                console.print(f"Usage: {usage:,} tokens (unlimited)")
    except urllib.error.HTTPError:
        console.print("[red]Session expired. Run: compass login[/red]")
    except Exception as e:
        console.print(f"[red]Connection error: {e}[/red]")


@app.command()
def logout():
    """Log out of Compass Cloud."""
    token_file = Path.home() / ".compass" / "cloud_token"
    if token_file.exists():
        token_file.unlink()
    console.print("[dim]Logged out.[/dim]")


# --- mcp ---

mcp_app = typer.Typer(help="MCP server management")
app.add_typer(mcp_app, name="mcp")


@mcp_app.callback(invoke_without_command=True)
def mcp_config(ctx: typer.Context):
    """Print MCP server configuration JSON (for manual setup)."""
    if ctx.invoked_subcommand is not None:
        return

    import json
    import sys

    compass_path = _find_compass_executable()
    config = {
        "mcpServers": {
            "compass": {
                "command": compass_path,
                "args": ["mcp", "serve"],
            }
        }
    }
    console.print(json.dumps(config, indent=2))
    console.print(f"\n[dim]Add this to your Claude Code or Cursor MCP config.[/dim]")
    console.print(f"[dim]Or run: compass mcp install[/dim]")


@mcp_app.command()
def serve():
    """Start the MCP server (stdio transport)."""
    from compass.mcp_server import main
    main()


@mcp_app.command()
def install():
    """Auto-install Compass MCP server into Claude Code or Cursor config."""
    import json

    compass_path = _find_compass_executable()
    server_config = {
        "command": compass_path,
        "args": ["mcp", "serve"],
    }

    installed = False

    # Claude Code config
    claude_config_path = Path.home() / ".claude" / "claude_code_config.json"
    if claude_config_path.parent.exists():
        config = {}
        if claude_config_path.exists():
            try:
                config = json.loads(claude_config_path.read_text())
            except Exception:
                config = {}

        mcp_servers = config.setdefault("mcpServers", {})
        mcp_servers["compass"] = server_config
        claude_config_path.write_text(json.dumps(config, indent=2))
        console.print(f"[green]Installed Compass MCP server in Claude Code[/green]")
        console.print(f"  [dim]{claude_config_path}[/dim]")
        installed = True

    # Cursor config
    cursor_config_path = Path.cwd() / ".cursor" / "mcp.json"
    if cursor_config_path.parent.exists():
        config = {}
        if cursor_config_path.exists():
            try:
                config = json.loads(cursor_config_path.read_text())
            except Exception:
                config = {}

        mcp_servers = config.setdefault("mcpServers", {})
        mcp_servers["compass"] = server_config
        cursor_config_path.write_text(json.dumps(config, indent=2))
        console.print(f"[green]Installed Compass MCP server in Cursor[/green]")
        console.print(f"  [dim]{cursor_config_path}[/dim]")
        installed = True

    if not installed:
        console.print("[yellow]No Claude Code or Cursor config directory found.[/yellow]")
        console.print("Run [bold]compass mcp[/bold] to get the config JSON for manual setup.")
    else:
        console.print(f"\n[dim]Restart your AI tool to activate Compass tools.[/dim]")


def _find_compass_executable() -> str:
    """Find the compass executable path."""
    import shutil
    path = shutil.which("compass")
    return path or "compass"


# --- helpers ---

def _load_knowledge_graph(compass_dir: Path):
    """Load the knowledge graph from persistence (no re-ingestion)."""
    from compass.engine.knowledge_graph import KnowledgeGraph

    kg_dir = compass_dir / "knowledge"
    kg = KnowledgeGraph(persist_dir=kg_dir)

    # KG loaded from persistence — if it has evidence, return it
    if len(kg) > 0:
        return kg

    # Persistence is empty — check if sources exist for a helpful message
    try:
        config = load_config()
    except FileNotFoundError:
        console.print("[yellow]No Compass workspace found. Run 'compass init' first.[/yellow]")
        return None

    if not config.sources:
        console.print("[yellow]No sources connected. Run 'compass connect' first.[/yellow]")
        return None

    console.print("[yellow]No evidence found. Run 'compass ingest' first.[/yellow]")
    return None


def _save_conflict_report(report, path: Path):
    """Save conflict report as markdown."""
    lines = ["# Conflict Report", "", f"Found {len(report)} conflicts between sources of truth.", ""]

    for conflict in report.conflicts:
        lines.extend([
            f"## [{conflict.severity.value.upper()}] {conflict.title}",
            "",
            f"**Type:** {conflict.conflict_type.description}",
            "",
            conflict.description,
            "",
            f"**Recommendation:** {conflict.recommendation}",
            "",
            "---",
            "",
        ])

    path.write_text("\n".join(lines))


def _save_opportunities(opportunities, path: Path):
    """Save opportunities as markdown."""
    lines = ["# Product Opportunities", "", "Evidence-grounded recommendations from Compass.", ""]

    for opp in opportunities:
        lines.extend([
            f"## #{opp.rank}: {opp.title}",
            "",
            f"**Confidence:** {opp.confidence.value}",
            f"**Impact:** {opp.estimated_impact}",
            "",
            opp.description,
            "",
            f"**Evidence:** {opp.evidence_summary}",
            "",
            "---",
            "",
        ])

    path.write_text("\n".join(lines))
