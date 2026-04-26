# Fixtures

This directory stores self-contained projects used by benchmark tasks.

Each task should have a matching fixture directory when it needs code to edit:

```text
fixtures/
└── <task-id>/
```

Run branches should modify only the relevant fixture unless the task explicitly says otherwise.

The preferred flow is:

```text
main contains fixture baseline
run branch modifies fixture
main records evaluation result
```
