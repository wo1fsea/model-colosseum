# Tasks

This directory stores benchmark task definitions.

Each task gets its own directory:

```text
tasks/
└── <task-id>/
    └── task.md
```

Each task should include:

- task id
- prompt
- fixture repository or setup instructions
- expected test command
- scoring notes
- known traps or edge cases

Tasks should be stable enough to run across multiple models without changing the rules midstream.

Use `tasks/_template/task.md` when adding a new task.
