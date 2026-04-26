# AGENTS.md

This repository is used for coding-agent evaluation.

Follow the same four-step loop for every task:

```text
Plan -> Implement -> Test -> Fix
```

## 1. Plan

Before editing files, inspect the repository and write a short plan.

The plan must include:

- The files or modules you expect to touch.
- The behavior you intend to change.
- The tests you expect to add or run.
- Any assumptions or risks.

Keep the plan concise. Do not spend excessive time planning.

## 2. Implement

Make the smallest coherent code change that satisfies the task.

Rules:

- Preserve existing public APIs unless the task explicitly asks to change them.
- Follow the repository's existing style and patterns.
- Do not introduce new runtime dependencies unless explicitly allowed.
- Do not rewrite unrelated code.
- Do not remove tests to make the suite pass.
- Do not weaken assertions unless the task explicitly requires it.

## 3. Test

Run the most relevant tests after implementation.

You must:

- Add or update tests for the changed behavior.
- Run the targeted test command first.
- Run the broader test command if the repository makes it practical.
- Record the exact commands you ran and whether they passed.

If a command cannot run because of the environment, explain the blocker clearly.

## 4. Fix

If tests fail, debug and fix the cause.

Rules:

- Prefer fixing the implementation over changing the test.
- If the test is wrong, explain why before changing it.
- Repeat the test command after every fix.
- Stop only when the relevant tests pass or when a real external blocker is identified.

## Final Response

End with a concise summary containing:

- Plan summary
- Files changed
- Tests run
- Result
- Remaining risks, if any

Do not include long explanations unless they are needed to understand the change.
