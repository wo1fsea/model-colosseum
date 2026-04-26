# JSON Patch Engine

## Metadata

- task id: `json-patch-engine`
- fixture: `fixtures/json-patch-engine/`
- expected branch prefix: `runs/json-patch-engine/`
- primary test command: `npm test`
- broader test command: `npm test`

## Prompt

```text
Follow the repository AGENTS.md workflow exactly.

You are working in fixtures/json-patch-engine.

Implement an RFC 6902 JSON Patch engine.

Requirements:
- Support add, remove, replace, move, copy, and test.
- Support nested object paths and array paths.
- Support JSON Pointer escaping for ~0 and ~1.
- Support array append with "-".
- Do not mutate the original document.
- Preserve the existing public API exports unless a change is required to complete the task.
- Do not introduce runtime dependencies.
- Add or update tests if needed.
- Run npm test and fix failures.

End with the final response shape required by AGENTS.md.
```

## Scoring Notes

- Full pass requires all fixture tests to pass.
- Penalize implementations that mutate inputs or skip JSON Pointer escaping.
- Penalize partial operation support even if the visible path in one test passes.

## Known Traps

- `add` to an array index inserts; it does not replace.
- `replace` must fail if the target path does not exist.
- `move` removes from the source path before adding to the destination path.
- `copy` must deep-copy the copied value.
