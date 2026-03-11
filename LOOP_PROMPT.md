# Claude Code Loop Prompt

> Copy everything below the line into Claude Code with `--dangerously-skip-permissions`.

---

You are working on the Compass project — an AI-native product discovery tool. You are running in autonomous loop mode.

## Your Loop

Repeat this cycle until all tasks are complete:

### Step 1: Merge open PR (if any)

```bash
# Check for open PRs authored by you
gh pr list --author="@me" --state=open --json number,title,headRefName,mergeable
```

If there's an open PR:
1. **MANDATORY: Check CI status first:** `gh pr checks <number>`
2. **If any check is failing or pending, DO NOT merge.** Instead:
   - Read the failure logs: `gh pr checks <number> --json name,state,conclusion`
   - If failing: fix the issue on that branch, commit, push, and wait for CI to re-run. Do NOT proceed to merge until all checks pass.
   - If pending: stop the loop iteration here. Do not merge, do not start new work. Wait for checks to complete before continuing.
3. **Only if ALL checks pass** (every check has `conclusion: "success"`), merge it: `gh pr merge <number> --squash --delete-branch`
4. Switch to `main` and pull: `git checkout main && git pull origin main`

**NEVER merge a PR with failing CI.** This is a hard rule with no exceptions.

If no open PR, just make sure you're on `main` and it's up to date:
```bash
git checkout main && git pull origin main
```

### Step 2: Determine the next task

Read `docs/roadmap.md` to see the task list organized by milestone (M0 → M1 → M2 → ... → M8).

Check which tasks are already done by looking at merged PRs and commit history:
```bash
gh pr list --state=merged --limit=50 --json title,headRefName
git log --oneline -30
```

The task naming convention is `M{milestone}-T{task}` (e.g., M0-T1, M1-T3).

Pick the next task by following these rules:
1. **Milestone order:** Complete all tasks in M0 before starting M1, all M1 before M2, etc.
2. **Dependency order within milestone:** Check the dependency graph in `docs/roadmap.md` under each milestone. A task with dependencies can only start after its dependencies are merged.
3. **Pick the lowest-numbered unfinished task** in the current milestone that has all dependencies satisfied.

If ALL tasks across ALL milestones are done, print "All tasks complete!" and stop.

### Step 3: Create a branch and do the work

```bash
git checkout -b feat/<task-id-lowercase> main
# Example: git checkout -b feat/m0-t1-kg-persistence main
```

Now execute the task:
1. Read the task card in `docs/roadmap.md` for the scope, files to modify, and definition of done.
2. Read `docs/implementation-plan.md` for additional technical context (Part 1 has architecture, data models, API contracts; Part 2 has detailed task cards with more context).
3. Read ALL files mentioned in the task card before making changes.
4. Implement the task following the existing code style and patterns.
5. If the task says to create tests, run them: `cd engine && python -m pytest tests/ -v`
6. If the task modifies the engine, check it starts: `cd engine && python -c "from compass.server import app; print('OK')"`
7. If the task modifies the app, check it compiles: `cd app && npx tsc --noEmit`

### Step 4: Commit and open PR

```bash
git add -A
git commit -m "feat(<task-id>): <short description>

<2-3 sentence summary of what was done>

Task: <task-id> from docs/roadmap.md"

git push -u origin HEAD
```

Open a PR:
```bash
gh pr create \
  --title "feat(<task-id>): <short description>" \
  --body "## Task
<task-id> from docs/roadmap.md

## Summary
<bullet points of what was implemented>

## Changes
<list of files modified/created>

## Definition of Done
<paste the DoD from the task card, with checkboxes marked>

## Dependencies
<list any prerequisite tasks, confirm they're merged>

## Testing
<describe how the changes were verified>"
```

### Step 5: Loop back to Step 1

Go back to Step 1. Merge the PR you just created, then pick the next task.

---

## Important Rules

- **NEVER merge a failing PR.** Always verify CI passes before merging. If checks are failing, fix them first. If checks are pending, wait. No exceptions.
- **One task per PR.** Never combine multiple task cards into one PR.
- **Branch from main.** Always create branches from an up-to-date `main`.
- **Don't skip tasks.** Follow the milestone and dependency order strictly.
- **Read before writing.** Always read existing files before modifying them.
- **Don't break existing functionality.** If tests exist, they must still pass after your changes.
- **Commit messages matter.** Use the `feat(<task-id>): description` format consistently.
- **If stuck on a task for more than 3 attempts**, create the PR as a draft with `gh pr create --draft` and a note about what's blocking, then move to the next independent task.
- **Mock LLM calls in tests.** Never require a real API key for tests to pass.
- **Use tmp_path fixtures** for any test that writes to disk.

## Context Files

- `docs/roadmap.md` — Product roadmap with milestone task lists and dependency graphs
- `docs/implementation-plan.md` — Detailed technical spec and agent task cards (more context per task)
- `docs/adr/001-cli-first.md` — Architecture decision: CLI-first approach

## Current Milestone Order

M0 (Solid Engine) → M1 (Intelligence) → M2 (Killer Demo) → M3 (MCP Server) → M4 (Native App) → M5 (Beta) → M6 (Connectors) → M7 (Cloud) → M8 (Scale)

Begin now. Start from Step 1.
