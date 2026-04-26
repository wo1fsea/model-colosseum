# Model Colosseum

Model Colosseum is a small evaluation workspace for comparing coding agents and models on the same tasks.

The first round focuses on Pi + OpenRouter model runs, but the repo is intentionally provider-neutral. It should be able to hold runs from Pi, Codex, Claude Code, Kilo, Aider, or any future agent harness.

## Goals

- Keep benchmark tasks reproducible.
- Record model outputs, token usage, runtime, cost, and test results.
- Compare model behavior using the same repository instructions.
- Preserve raw run artifacts without turning the repo into a giant benchmark framework too early.

## Repository Model

`main` is the control plane:

- task definitions
- fixture projects
- tools and logging extensions
- run manifests
- evaluation summaries

Model-written engineering work lives on run branches:

```text
runs/<task-id>/<agent>-<provider>-<model>/<attempt>
```

Example:

```text
runs/json-patch-engine/pi-openrouter-kimi-k2.6/a01
```

Use one branch per model attempt, not one permanent branch per model. After a run finishes, record the branch, commit SHA, patch, logs, metrics, and evaluation under `results/<task-id>/<run-id>/` on `main`.

## First Models

- `xiaomi/mimo-v2-pro`
- `z-ai/glm-5.1`
- `moonshotai/kimi-k2.6`
- `minimax/minimax-m2.7`

## Layout

```text
.
├── AGENTS.md
├── fixtures/
│   └── README.md
├── tasks/
│   └── README.md
├── results/
│   └── README.md
├── tools/
│   └── pi/
├── scripts/
│   └── README.md
└── docs/
    └── README.md
```

## Run Discipline

All evaluated agents should follow the same loop:

```text
Plan -> Implement -> Test -> Fix
```

See `AGENTS.md` for the exact instructions.

## Key Docs

- [Repository organization](docs/repository-organization.md)
- [Scoring rubric](docs/scoring-rubric.md)
