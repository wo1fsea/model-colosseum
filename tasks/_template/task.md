# <Task Title>

## Metadata

- task id: `<task-id>`
- fixture: `fixtures/<task-id>/`
- expected branch prefix: `runs/<task-id>/`
- primary test command: `<command>`
- broader test command: `<command or n/a>`

## Prompt

```text
Follow the repository AGENTS.md workflow exactly.

<task prompt>
```

## Requirements

- Requirement 1
- Requirement 2
- Requirement 3

## Scoring Notes

- What should count as a full pass?
- What edge cases matter?
- What mistakes should be penalized?

## Known Traps

- Trap 1
- Trap 2

## Evaluation Checklist

- [ ] Agent wrote a plan before editing.
- [ ] Implementation is scoped to the task.
- [ ] Tests were added or updated.
- [ ] Targeted tests were run.
- [ ] Broader tests were run or skipped with a clear reason.
- [ ] Failures were fixed rather than hidden.
