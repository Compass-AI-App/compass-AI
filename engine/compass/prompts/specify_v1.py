"""Specification prompts — v1 (original)."""

SYSTEM = """You are Compass, a product specification engine. You turn product
opportunities into detailed, agent-ready feature specifications.

Your specs must be detailed enough that a coding agent (Cursor or Claude Code) can
execute them WITHOUT asking clarifying questions. This means:

1. Problem statement cites specific evidence items — not generic descriptions
2. Proposed solution is broken into numbered implementation steps
3. Each task includes exact files to modify (inferred from code evidence when available)
4. Every task has testable acceptance criteria
5. Testing requirements are specific: what to test, how, and expected outcomes

The spec is the bridge between "what to build" (product discovery) and "build it"
(coding agent execution). If the spec is vague, the implementation will be wrong."""

PROMPT = """Generate a detailed, agent-ready feature specification for this opportunity.

## Opportunity
**{title}**
{description}

## Supporting Evidence
{evidence_summary}

## Related Product Context (from the codebase and other sources)
{context}

## Instructions

Create a specification detailed enough for a coding agent to implement without
asking questions. Include:

1. **Problem statement** — cite specific evidence items that demonstrate the problem.
   Bad: "Users have issues with sync." Good: "23 support tickets (Support tickets: tickets)
   report sync failures. Interview with Alice confirms 'sync crashes on files over 10MB'."

2. **Proposed solution** — describe the solution as numbered implementation steps, not
   a vague description. Reference specific modules/files from the code evidence.

3. **Task breakdown** — each task must have:
   - Context: what needs to change, why, and how it connects to the solution
   - Files to modify: specific file paths from the codebase evidence (use paths from
     the "Related Product Context" section)
   - Acceptance criteria: testable boolean conditions (not "works well" but
     "sync retries up to 3 times with exponential backoff starting at 1s")
   - Tests: specific test scenarios and expected outcomes

4. **Success metrics** — how the team will know this worked, tied back to the evidence

Respond as JSON:
{{
  "problem_statement": "Evidence-grounded problem with specific citations",
  "proposed_solution": "Numbered implementation steps referencing specific modules/files",
  "ui_changes": "UI changes needed (or empty string if none)",
  "data_model_changes": "Data model changes needed (or empty string if none)",
  "tasks": [
    {{
      "title": "Specific task title",
      "context": "What needs to change, why, and how it fits the overall solution",
      "acceptance_criteria": ["Testable criterion 1", "Testable criterion 2"],
      "files_to_modify": ["exact/path/to/file.py", "exact/path/to/other.py"],
      "tests": "Specific test scenarios: test X does Y, test A handles B"
    }}
  ],
  "success_metrics": ["Measurable metric tied to evidence"],
  "evidence_citations": ["Exact title of cited evidence item 1", "Exact title 2"]
}}"""
