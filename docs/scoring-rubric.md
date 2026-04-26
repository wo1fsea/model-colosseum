# Scoring Rubric

Use the same scoring dimensions across tasks unless a task defines a justified override.

Default weights:

| Dimension | Weight |
|---|---:|
| Tests pass | 40 |
| Behavioral correctness | 25 |
| Code quality and maintainability | 15 |
| Agent process quality | 10 |
| Cost | 5 |
| Runtime | 5 |

## Tests Pass

Score whether the required test commands pass without weakening or deleting tests.

## Behavioral Correctness

Score correctness beyond the visible tests:

- edge cases
- backward compatibility
- failure behavior
- data safety
- task-specific invariants

## Code Quality

Score whether the solution fits the project:

- small coherent changes
- existing style followed
- understandable structure
- no unrelated rewrites
- no unnecessary dependencies

## Agent Process Quality

Score whether the agent followed the required loop:

```text
Plan -> Implement -> Test -> Fix
```

Look for:

- useful plan
- targeted implementation
- relevant tests
- honest failure reporting
- concrete fix loop when tests fail

## Cost And Runtime

Cost and runtime are tie-breakers by default. They should not outweigh correctness unless two runs are otherwise close.
