# Model Colosseum

Model Colosseum is a small evaluation workspace for comparing coding agents and models on the same tasks.

The first round focuses on Pi + OpenRouter model runs, but the repo is intentionally provider-neutral. It should be able to hold runs from Pi, Codex, Claude Code, Kilo, Aider, or any future agent harness.

## Goals

- Keep benchmark tasks reproducible.
- Record model outputs, token usage, runtime, cost, and test results.
- Compare model behavior using the same repository instructions.
- Preserve raw run artifacts without turning the repo into a giant benchmark framework too early.

## First Models

- `xiaomi/mimo-v2-pro`
- `z-ai/glm-5.1`
- `moonshotai/kimi-k2.6`
- `minimax/minimax-m2.7`

## Layout

```text
.
├── AGENTS.md
├── tasks/
│   └── README.md
├── results/
│   └── README.md
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
