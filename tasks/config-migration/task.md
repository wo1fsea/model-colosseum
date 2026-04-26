# Config Migration With Backward Compatibility

## Metadata

- task id: `config-migration`
- fixture: `fixtures/config-migration/`
- expected branch prefix: `runs/config-migration/`
- primary test command: `npm test`
- broader test command: `npm test`

## Prompt

```text
Follow the repository AGENTS.md workflow exactly.

You are working in fixtures/config-migration.

Migrate the configuration system from v1 to v2.

Requirements:
- Old v1 config files must still load.
- Loading a v1 config should return the v2 shape in memory.
- Saving or updating a migrated config should write v2 JSON.
- v2 supports profiles with activeProfile and profiles.default/dev/prod style data.
- Existing CLI commands get-endpoint and set-endpoint must stay compatible.
- Damaged JSON/config should produce an actionable error.
- Do not silently overwrite damaged user files.
- Do not introduce runtime dependencies.
- Add or update tests if needed.
- Run npm test and fix failures.

End with the final response shape required by AGENTS.md.
```

## Scoring Notes

- Full pass requires v1 migration, v2 profile behavior, CLI compatibility, and damaged-file safety.
- Penalize solutions that mutate user files during read-only load.
- Penalize vague JSON parse errors that do not identify config damage.

## Known Traps

- v1 may omit `version`.
- Missing timeout should get a sensible default.
- `setEndpoint` should update only the active v2 profile.
- CLI writes must not collapse a v2 config back to v1.
