# Hidden Output Quality Tests

These tests are independent checks against each run commit. They supplement the fixture tests and are not part of the model prompts.

| Task | Model | Original Tests | Hidden Tests | Estimated Cost | Duration | Commit |
|---|---|---:|---:|---:|---:|---:|
| `config-migration` | `gpt-5.5` | 10/10 | 6/6 | $0.346059 | 102.1s | `43e7089` |
| `config-migration` | `minimax/minimax-m2.7` | 5/10 | 5/6 | $0.008662 | 73.8s | `edea481` |
| `config-migration` | `xiaomi/mimo-v2-pro` | 8/10 | 6/6 | $0.049537 | 128.1s | `48206c2` |
| `config-migration` | `z-ai/glm-5.1` | 11/10 | 6/6 | $0.034771 | 130.5s | `0c73540` |
| `config-migration` | `moonshotai/kimi-k2.6` | 5/10 | 6/6 | $0.021411 | 70.5s | `8a31945` |
| `flaky-triage` | `gpt-5.5` | 5/5 | 5/5 | $0.137746 | 47.4s | `a18bb5a` |
| `flaky-triage` | `minimax/minimax-m2.7` | 4/5 | 4/5 | $0.008575 | 57.7s | `477a989` |
| `flaky-triage` | `xiaomi/mimo-v2-pro` | 4/5 | 5/5 | $0.019502 | 60.8s | `3e392c6` |
| `flaky-triage` | `z-ai/glm-5.1` | 4/5 | 4/5 | $0.024507 | 49.8s | `b1ccde4` |
| `flaky-triage` | `moonshotai/kimi-k2.6` | 4/5 | 5/5 | $0.014963 | 42.6s | `3c51256` |
| `json-patch-engine` | `gpt-5.5` | 8/8 | 10/10 | $0.365379 | 131.9s | `9276935` |
| `json-patch-engine` | `minimax/minimax-m2.7` | 5/8 | 8/10 | $0.015943 | 164.2s | `15d084b` |
| `json-patch-engine` | `xiaomi/mimo-v2-pro` | 5/8 | 9/10 | $0.021896 | 58.9s | `3a7c881` |
| `json-patch-engine` | `z-ai/glm-5.1` | 5/8 | 10/10 | $0.053963 | 119.4s | `24bdb21` |
| `json-patch-engine` | `moonshotai/kimi-k2.6` | 6/8 | 10/10 | $0.096208 | 422.3s | `3398123` |

## Failures

### config-migration / minimax/minimax-m2.7

- setEndpoint does not mutate the original v2 object: Expected values to be strictly equal: + actual - expected + 'http://new-dev' - 'http://old-dev' ^

### flaky-triage / minimax/minimax-m2.7

- createSession clones override roles arrays: Expected values to be strictly deep-equal: + actual - expected + [] - [ - 'member' - ]

### flaky-triage / z-ai/glm-5.1

- createSession clones override roles arrays: Expected values to be strictly deep-equal: + actual - expected [ 'member', + 'external-mutation' ]

### json-patch-engine / minimax/minimax-m2.7

- add fails when an intermediate parent path is missing: Missing expected exception (JsonPatchError).
- remove fails when an object key is missing: Missing expected exception (JsonPatchError).

### json-patch-engine / xiaomi/mimo-v2-pro

- array add rejects sparse indexes: Missing expected exception (JsonPatchError).

