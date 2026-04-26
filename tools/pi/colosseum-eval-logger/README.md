# colosseum-eval-logger

Pi extension for Model Colosseum runs.

It records each completed assistant turn to JSONL so model outputs can be compared with local run metadata and provider billing dashboards.

## Environment

- `COLOSSEUM_TASK_ID`: logical benchmark task id.
- `COLOSSEUM_RUN_ID`: unique run id for this model/task attempt.
- `COLOSSEUM_LOG_PATH`: optional override for the JSONL path.
- `COLOSSEUM_META`: optional JSON object or string stored with each record.

Default log path:

```text
.colosseum/runs.jsonl
```

## Command

Inside Pi:

```text
/colosseum-stats
```

Shows an aggregate summary from the JSONL log.
