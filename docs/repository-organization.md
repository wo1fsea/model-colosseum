# Repository Organization

Model Colosseum has two jobs:

- Preserve the engineering work produced by evaluated models.
- Preserve the evaluation record for that work.

Those two jobs should be connected but not mixed together.

## Branch Strategy

Use branches for model-produced engineering work.

Do not use one long-lived branch per model. Use one branch per task/model/attempt:

```text
runs/<task-id>/<agent>-<provider>-<model>/<attempt>
```

Examples:

```text
runs/json-patch-engine/pi-openrouter-kimi-k2.6/a01
runs/config-migration/pi-openrouter-glm-5.1/a02
runs/flaky-triage/pi-openrouter-minimax-m2.7/a01
```

This keeps repeated attempts separate. It also avoids turning `kimi`, `glm`, or `minimax` into vague branches whose contents change meaning over time.

## Main Branch

`main` is the control plane and historical record.

It contains:

- `AGENTS.md`: shared workflow instructions for evaluated agents.
- `tasks/`: task definitions and prompts.
- `fixtures/`: baseline projects that models edit.
- `tools/`: logger extensions and helper tooling.
- `results/`: run records, patches, logs, metrics, and evaluation notes.
- `docs/`: methodology and repository decisions.

`main` should not be rewritten to contain a model's attempted solution directly. Model solutions belong on run branches first.

## Run Branches

A run branch contains the actual code changes produced by a model.

Typical flow:

```text
git switch main
git pull
git switch -c runs/<task-id>/<agent>-<provider>-<model>/<attempt>
run agent against fixtures/<task-id>
commit model changes
push branch
```

After the run:

```text
git diff main...<run-branch> > results/<task-id>/<run-id>/diff.patch
```

Then record the run metadata and evaluation on `main`.

## Results

Each run should have a stable run id:

```text
<task-id>__<agent>__<provider>__<model>__<attempt>
```

Example:

```text
json-patch-engine__pi__openrouter__kimi-k2.6__a01
```

Store the run record here:

```text
results/<task-id>/<run-id>/
```

Recommended files:

- `run.md`: human-readable run metadata.
- `metrics.json`: structured model/tool/test metrics.
- `evaluation.md`: scoring and qualitative notes.
- `diff.patch`: patch from `main` or task baseline to the run branch.
- `logs/`: raw terminal output, Pi JSONL logs, or provider usage exports.

## Why Not Only Branches?

Branches are good for preserving code, but poor as an evaluation database.

They do not answer these questions by themselves:

- Which task was this branch for?
- Which exact model/provider/agent produced it?
- What did it cost?
- Which tests passed?
- What did the evaluator think?
- Was this the first attempt or a retry?

So the rule is:

```text
Branch stores the engineering artifact.
main/results stores the evaluation record.
```
