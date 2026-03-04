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

    for source in config.sources:
        try:
            connector_cls = get_connector(source.type)
            connector = connector_cls(source)
            evidence = connector.ingest()
            kg.add_many(evidence)
            count = len(evidence)
            total += count
            table.add_row(source.name, source.type, str(count))
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

    # Display conflicts
    console.print(f"\n[bold]Found {len(report)} conflicts[/bold]\n")

    for conflict in report.conflicts:
        severity_color = {"high": "red", "medium": "yellow", "low": "dim"}
        color = severity_color.get(conflict.severity.value, "white")

        console.print(Panel(
            f"[bold]{conflict.title}[/bold]\n\n"
            f"{conflict.description}\n\n"
            f"[dim]Type: {conflict.conflict_type.description}[/dim]\n"
            f"[dim]Recommendation: {conflict.recommendation}[/dim]",
            title=f"[{color}]{conflict.severity.value.upper()}[/{color}]",
            border_style=color,
        ))

    # Save report
    output_dir = get_output_dir()
    report_path = output_dir / "conflict-report.md"
    _save_conflict_report(report, report_path)
    console.print(f"\n[dim]Report saved to {report_path}[/dim]")


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

    console.print(f"\n[bold]Top {len(opportunities)} Opportunities[/bold]\n")

    for opp in opportunities:
        confidence_color = {"high": "green", "medium": "yellow", "low": "dim"}
        color = confidence_color.get(opp.confidence.value, "white")

        console.print(Panel(
            f"[bold]{opp.description}[/bold]\n\n"
            f"[dim]Evidence:[/dim] {opp.evidence_summary}\n\n"
            f"[dim]Impact:[/dim] {opp.estimated_impact}",
            title=f"#{opp.rank} [{color}]{opp.confidence.value.upper()} confidence[/{color}]  {opp.title}",
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


# --- status ---

@app.command()
def status():
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
    ingest_summary = compass_dir / "last_ingest.txt"
    if ingest_summary.exists():
        console.print(f"\n[dim]{ingest_summary.read_text()}[/dim]")

    # Show existing outputs
    output_dir = get_output_dir()
    outputs = list(output_dir.glob("*.md"))
    if outputs:
        console.print(f"\n[dim]Outputs: {', '.join(f.name for f in outputs)}[/dim]")


# --- helpers ---

def _load_knowledge_graph(compass_dir: Path):
    """Load the knowledge graph from a previous ingestion."""
    from compass.engine.knowledge_graph import KnowledgeGraph
    from compass.connectors import get_connector

    kg_dir = compass_dir / "knowledge"

    # Re-ingest from sources (ChromaDB persists embeddings but we need the EvidenceStore)
    config = load_config()
    kg = KnowledgeGraph(persist_dir=kg_dir)

    if not config.sources:
        console.print("[yellow]No sources connected. Run 'compass connect' first.[/yellow]")
        return None

    # Re-populate the in-memory store from connectors
    total = 0
    for source in config.sources:
        try:
            connector_cls = get_connector(source.type)
            connector = connector_cls(source)
            evidence = connector.ingest()
            kg.store.add_many(evidence)
            total += len(evidence)
        except Exception:
            continue

    if total == 0:
        console.print("[yellow]No evidence found. Run 'compass ingest' first.[/yellow]")
        return None

    return kg


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
