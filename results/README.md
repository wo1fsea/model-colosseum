# Results

This directory stores model run outputs and evaluation summaries.

Recommended structure:

```text
results/
└── <task-id>/
    ├── leaderboard.md
    └── <run-id>/
        ├── run.md
        ├── metrics.json
        ├── evaluation.md
        ├── diff.patch
        └── logs/
```

Raw run logs should stay close to the original output. Human scoring and conclusions can live in `summary.md`.

Use `results/_template/` when adding a new run record.
