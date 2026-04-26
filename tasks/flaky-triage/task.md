# Flaky Test Triage And Fix

## Metadata

- task id: `flaky-triage`
- fixture: `fixtures/flaky-triage/`
- expected branch prefix: `runs/flaky-triage/`
- primary test command: `npm test`
- broader test command: `npm test`

## Prompt

```text
Follow the repository AGENTS.md workflow exactly.

You are working in fixtures/flaky-triage.

The test suite contains failures that represent common flaky-test causes.

Requirements:
- Diagnose and fix the root cause of each failing test.
- Do not delete tests.
- Do not weaken assertions.
- Do not add long sleeps.
- Preserve the public function names unless a change is required by the task.
- Keep fixes minimal and explain each root cause.
- Add or update tests if needed.
- Run npm test and fix failures.

End with the final response shape required by AGENTS.md.
```

## Scoring Notes

- Full pass requires all fixture tests to pass without hiding the failures.
- Reward root-cause explanations for async ordering, timezone bucketing, and shared mutable state.
- Penalize sleep-based fixes and assertion weakening.

## Known Traps

- Completion order is not input order.
- UTC day bucketing should use UTC date fields or ISO day extraction after conversion.
- Default object/array references can leak state across calls.
