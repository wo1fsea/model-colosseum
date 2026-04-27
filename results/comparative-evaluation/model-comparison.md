# Model Output Comparison

Date: 2026-04-27

Scope:
- Baseline: `pi` + `openai-codex/gpt-5.5` + `thinking high`
- OpenRouter candidates: `xiaomi/mimo-v2-pro`, `z-ai/glm-5.1`, `moonshotai/kimi-k2.6`, `minimax/minimax-m2.7`
- Additional attempted candidate: `deepseek/deepseek-v4-pro`
- Tasks: `json-patch-engine`, `config-migration`, `flaky-triage`

The fixture tests all passed for every recorded run. This comparison adds independent hidden checks from `tools/evaluate-output-quality.mjs` and a human review of the produced diffs.

`deepseek/deepseek-v4-pro` is not included in the quality ranking because OpenRouter returned upstream rate-limit errors before Pi could produce code. The failed `a01` runs are preserved in `results/*/*deepseek-deepseek-v4-pro-high__a01/` as availability evidence, not as model-output quality evidence.

## Aggregate Result

`Original Tests` means tests present in the run branch compared with the expected baseline count. A lower number usually means the model solved the visible tests but added fewer tests of its own, not that the branch test command failed.

| Model | Hidden Tests | Original Tests | Est. Cost | Wall Time | Judgment |
|---|---:|---:|---:|---:|---|
| `gpt-5.5` | 21/21 | 23/23 | $0.849184 | 281s | Best overall engineering output and test discipline; most expensive. |
| `moonshotai/kimi-k2.6` | 21/21 | 15/23 | $0.132582 | 535s | Best OpenRouter correctness in hidden checks; weak test additions and one transient `terminated` turn. |
| `xiaomi/mimo-v2-pro` | 20/21 | 17/23 | $0.090935 | 248s | Best speed/cost/quality tradeoff; one JSON Patch array-boundary miss. |
| `z-ai/glm-5.1` | 20/21 | 20/23 | $0.113241 | 300s | Strong test generation, especially config migration; one mutable-alias edge in flaky triage. |
| `minimax/minimax-m2.7` | 17/21 | 14/23 | $0.033180 | 296s | Very cheap, but several boundary misses; not strong enough as the quality baseline. |

## DeepSeek v4 Availability Attempt

| Model | Attempt | Result | Notes |
|---|---|---|---|
| `deepseek/deepseek-v4-pro` | `a01`, three tasks | Not comparable | Pi received `Provider returned error` / `429 temporarily rate-limited upstream`; no code changes were produced, and branches remained at the base commit. |
| `deepseek/deepseek-v4-pro` | smoke retry | Failed | Repeated smoke request still returned `429 temporarily rate-limited upstream`. |
| `deepseek/deepseek-v4-flash` | smoke | Passed | One-shot smoke returned successfully. |
| `deepseek/deepseek-v4-flash` | partial `json-patch-engine` attempt | Not comparable | Multi-turn agent run hit `429 temporarily rate-limited upstream` after reading files; the unfinished local worktree was removed and not recorded as a completed result. |

Conclusion: DeepSeek v4 could not be evaluated under the same Pi + OpenRouter + `thinking high` conditions in this run. A fair comparison needs either a later retry after the upstream limit clears or a configured DeepSeek provider key in OpenRouter integrations.

## Task Findings

### `json-patch-engine`

| Model | Hidden | Notes |
|---|---:|---|
| `gpt-5.5` | 10/10 | Most complete implementation. Handles root operations, invalid pointer escapes, missing targets, move-into-descendant guard, and adds the broadest tests. |
| `moonshotai/kimi-k2.6` | 10/10 | Correct on the hidden suite with clean operation decomposition. Runtime was much slower because the run had a transient `terminated` turn before recovery. |
| `z-ai/glm-5.1` | 10/10 | Correct on hidden checks and reasonably structured. Added no extra visible tests, but implementation held up. |
| `xiaomi/mimo-v2-pro` | 9/10 | Allows sparse array insert (`/items/3` into length 1) instead of rejecting it. Otherwise solid and fastest. |
| `minimax/minimax-m2.7` | 8/10 | Does not reject missing intermediate parents for `add`, and `remove` of a missing object key can silently succeed. |

### `config-migration`

| Model | Hidden | Notes |
|---|---:|---|
| `gpt-5.5` | 6/6 | Best production-style answer: normalizes v1/v2, validates malformed config, validates active profile, keeps write paths safe, and adds the most tests. |
| `z-ai/glm-5.1` | 6/6 | Strongest OpenRouter test coverage here. Simpler validation than GPT, but good functional result. |
| `xiaomi/mimo-v2-pro` | 6/6 | Good validation and actionable errors. Uses a 30s default timeout, which is acceptable because the task did not specify an exact value. |
| `moonshotai/kimi-k2.6` | 6/6 | Minimal but correct for required behavior. It does less validation around malformed v2 shapes than GPT/Xiaomi/GLM. |
| `minimax/minimax-m2.7` | 5/6 | Functional migration, but `setEndpoint` mutates the original v2 object. That is a maintainability risk even though the visible tests pass. |

### `flaky-triage`

| Model | Hidden | Notes |
|---|---:|---|
| `gpt-5.5` | 5/5 | Clean and idiomatic: `Promise.all` for input order, UTC date fields, cloned roles array. |
| `moonshotai/kimi-k2.6` | 5/5 | Correct and compact; clones override roles as well as the default roles. |
| `xiaomi/mimo-v2-pro` | 5/5 | Correct and explicit. Slightly more code than GPT/Kimi for async ordering, but robust. |
| `z-ai/glm-5.1` | 4/5 | Fixes default shared state but aliases `overrides.roles`, so external mutation can leak into the returned session. |
| `minimax/minimax-m2.7` | 4/5 | Ignores `overrides.roles` entirely. This passes the visible root-cause tests but regresses public behavior. |

## Comparison To `gpt-5.5`

`gpt-5.5` remains the strongest baseline. It had perfect hidden results, the highest visible test count, and the most defensive production-style code, especially in `config-migration`.

The OpenRouter group narrows the gap more than expected:
- `moonshotai/kimi-k2.6` matched GPT on hidden correctness, but added fewer tests and had the slowest total runtime.
- `z-ai/glm-5.1` was closest on process quality because it generated more tests, but it had one state-aliasing edge case.
- `xiaomi/mimo-v2-pro` was the practical value winner: fastest total runtime, lower cost than GLM/Kimi, and only one hidden miss.
- `minimax/minimax-m2.7` was dramatically cheaper, but the hidden failures are real engineering issues rather than cosmetic differences.
- `deepseek/deepseek-v4-pro` is unranked for now because the run failed at the provider layer before producing model output.

## Recommendation

Use `gpt-5.5` as the quality reference and judge other models against it.

For OpenRouter-only runs:
1. Choose `xiaomi/mimo-v2-pro` when cost and latency matter and a human review pass is available.
2. Choose `moonshotai/kimi-k2.6` when hidden correctness is the priority and slower/less stable runs are acceptable.
3. Choose `z-ai/glm-5.1` when test generation and auditability matter.
4. Use `minimax/minimax-m2.7` for cheap smoke runs, not for final-quality implementation selection yet.
5. Retry `deepseek/deepseek-v4-pro` only after OpenRouter upstream rate limits clear, or after adding a dedicated DeepSeek integration key.

Next improvements:
- Add the hidden checks as first-class fixture tests or a separate `judge` command.
- Add a human-review rubric for test additions, validation depth, and maintainability.
- Repeat each model at least three times per task to measure stability and variance.
