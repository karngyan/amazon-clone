# CAPTURE-TEST

## Tool and model

- **Tool:** Claude Code (CLI, terminal)
- **Model:** `claude-fable-5-1` (Claude Fable 5.1). One model plans and executes; there
  is no separate planner/executor split. Subagents, when used, inherit the same model.
  Each log entry carries its own `model:` line, so a mid-build switch is visible.
- **Hook mechanism:** yes. Claude Code has lifecycle hooks configured in
  `.claude/settings.json`; the harness runs them, not the model, so they fire on every
  prompt and every end-of-turn without anyone remembering to.

## Mechanism

Config file changed: **`.claude/settings.json`** (project-level, committed). Script:
**`.claude/hooks/capture.py`** (Python 3, stdlib only).

| Event | Command | What it does |
|---|---|---|
| `SessionStart` | `capture.py session` | remembers the configured model so prompt 1 can be labelled |
| `UserPromptSubmit` | `capture.py prompt` | appends the prompt verbatim from the hook payload, UTC timestamp, model |
| `Stop` | `capture.py stop` | reads `transcript_path` from stdin, appends only the final text response of the turn |

Thinking, tool calls, tool results and subagent (sidechain) chatter are skipped: the
response is the assistant text after the last tool call of the turn. Entries are
append-only; only the frontmatter counters (`total_exchanges`, `last_prompt_time`) are
rewritten. Turn counters live in `.claude/hooks/.state/` (gitignored), not in the log.
If `Stop` fires for a turn whose prompt was never logged (hook installed mid-session),
the prompt is recovered verbatim from the transcript with its original timestamp.

## Log files the canaries landed in

- Second session (fresh `claude -p` process, started after the hook was installed):
  `.agent-logs/2026-09-19_15-39-28_9f99a9f7-ffe1-4bf9-98cd-b8f7ad832963.md`
- Interactive session canary: see "Canary 1" below.

## Canary 2 — second session, raw

```
[LOG_ENTRY type=PROMPT num=1 session=9f99a9f7]
timestamp: 2026-09-19T15:39:28.181Z
model: claude-fable-5-1

CAPTURE TEST — 8x assignment, Karn (second session)


[LOG_ENTRY type=RESPONSE num=1 session=9f99a9f7]
timestamp: 2026-09-19T15:39:41.499Z
model: claude-fable-5-1

Capture test received. Session `9f99a9f7` live, log created.

Capture check:
- PROMPT entry now carry `model: claude-fable-5-1` — model fix landed (prior sessions `bb694c0a`, `5e7273c0` show `unknown` on prompt entries).
- `SessionStart` hook now wired alongside `UserPromptSubmit` + `Stop` — likely source of model.
- Frontmatter model correct at prompt time, no wait for `Stop`.
- Outlier: session `31a642c3` ("say ok") has `model: unknown` everywhere, frontmatter + response. Probably ran before fix or without `SessionStart` payload. Re-test if that path matter (e.g. `claude -p` one-shot).
- RESPONSE entry for this turn write at `Stop` — verify after turn end.

Me: `claude-fable-5-1`.

Repo: no commits, only `.claude/` + `.agent-logs/` untracked. Memory dir empty.

MCP: Notion, Customer.io EU/Standalone need auth via claude.ai connector settings. Linear failed connect (404) — retry/fix config.

No task in prompt. Send assignment spec, me build.
```

## Canary 1 — interactive session, raw

_Pending: to be pasted here once the canary is sent in the interactive session._

## What I tried first that did not work

All of these are still visible in `.agent-logs/`; nothing was deleted.

1. **Counting entries by grepping the log for `[LOG_ENTRY ...]`.** The setup prompt
   itself contains sample `LOG_ENTRY` lines, and a prompt that quotes a real entry
   threw the numbering off (`num=1, 2, 3, 4` for two exchanges in a pipe test). Moved
   the counters to a sidecar state file.
2. **Model name on the prompt entry.** The `UserPromptSubmit` payload has no model
   field, and the transcript has no assistant entry before the first prompt, so prompt 1
   logged `model: unknown` (sessions `bb694c0a`, `5e7273c0`). Second attempt read
   `model` from the `SessionStart` payload; in this Claude Code version that payload has
   no model either, so it was still `unknown`. Third attempt, which works: fall back to
   `ANTHROPIC_MODEL` / the `model` key in settings at session start, then prefer the
   transcript's real model from the first response onward. The RESPONSE entry always
   carries the model the API actually reported.
3. **`claude -p --no-session-persistence`** (session `31a642c3`, a debug run to dump the
   `SessionStart` payload) writes no transcript, so the Stop hook had nothing to read
   and logged a placeholder response with `model: unknown`. Normal sessions are
   unaffected; noted so the odd log file is explained.
4. **The very first prompt of the install session** (the setup instructions) predates
   the hook, so `UserPromptSubmit` could not have caught it. The Stop-side backfill
   exists for exactly this case.
