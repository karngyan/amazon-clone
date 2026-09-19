#!/usr/bin/env python3
"""Append-only prompt/response capture for Claude Code hooks.

Usage (hook JSON arrives on stdin):
  capture.py session  <- SessionStart (remembers the model for prompt 1)
  capture.py prompt   <- UserPromptSubmit
  capture.py stop     <- Stop

Writes .agent-logs/YYYY-MM-DD_HH-MM-SS_<session-id>.md, one file per session.
Only the prompt and the final response of each turn are logged: no thinking,
no tool calls. Entries are only ever appended; the frontmatter counters are
the one thing rewritten in place.
"""
import glob
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime, timezone

ROOT = os.environ.get("CLAUDE_PROJECT_DIR") or os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
LOG_DIR = os.path.join(ROOT, ".agent-logs")
TOOL = "claude-code"


def now():
    return datetime.now(timezone.utc)


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + "%03dZ" % (dt.microsecond // 1000)


def author():
    for cmd in (["gh", "api", "user", "-q", ".login"], ["git", "config", "user.name"]):
        try:
            out = subprocess.run(
                cmd, capture_output=True, text=True, timeout=5, cwd=ROOT
            ).stdout.strip()
            if out:
                return out
        except Exception:
            pass
    return os.environ.get("USER", "unknown")


def read_transcript(path):
    entries = []
    if not path or not os.path.exists(path):
        return entries
    with open(path, encoding="utf-8") as f:
        for line in f:
            try:
                entries.append(json.loads(line))
            except ValueError:
                pass
    return entries


def text_of(content):
    if isinstance(content, str):
        return content
    return "\n\n".join(
        b.get("text", "") for b in content or [] if b.get("type") == "text"
    )


def is_prompt(e):
    """A human-typed prompt, not a tool result or injected meta message."""
    if e.get("type") != "user" or e.get("isSidechain") or e.get("isMeta"):
        return False
    if "toolUseResult" in e or "sourceToolAssistantUUID" in e:
        return False
    content = (e.get("message") or {}).get("content")
    if isinstance(content, list):
        if any(b.get("type") == "tool_result" for b in content):
            return False
    return bool(text_of(content).strip())


def main_assistant(e):
    return e.get("type") == "assistant" and not e.get("isSidechain")


def last_model(entries):
    for e in reversed(entries):
        if main_assistant(e):
            model = (e.get("message") or {}).get("model")
            if model and not model.startswith("<"):
                return model
    return None


def final_response(entries):
    """Text blocks after the last tool call / user entry of the main thread."""
    parts, model = [], None
    for e in reversed(entries):
        if e.get("isSidechain"):
            continue
        if e.get("type") == "user":
            break
        if e.get("type") != "assistant":
            continue
        content = (e.get("message") or {}).get("content") or []
        types = {b.get("type") for b in content if isinstance(b, dict)}
        if "tool_use" in types:
            break
        txt = text_of(content)
        if txt.strip():
            parts.append(txt)
            model = model or (e.get("message") or {}).get("model")
    return "\n\n".join(reversed(parts)), model


def log_path(session_id, started):
    hits = sorted(glob.glob(os.path.join(LOG_DIR, "*_%s.md" % session_id)))
    if hits:
        return hits[0], False
    name = "%s_%s.md" % (started.strftime("%Y-%m-%d_%H-%M-%S"), session_id)
    return os.path.join(LOG_DIR, name), True


def create(path, session_id, started, model):
    short = session_id[:8]
    project = os.path.basename(ROOT)
    who = author()
    head = [
        "---",
        "session_id: %s" % session_id,
        "date: %s" % started.strftime("%Y-%m-%d"),
        "author: %s" % who,
        "model: %s" % model,
        "tool: %s" % TOOL,
        "project: %s" % project,
        "total_exchanges: 0",
        "first_prompt_time: %s" % iso(started),
        "last_prompt_time: %s" % iso(started),
        "---",
        "",
        "# Session Log - %s" % started.strftime("%Y-%m-%d"),
        "",
        "Session: `%s` | Project: `%s` | Author: `%s`" % (short, project, who),
        "",
        "---",
        "",
    ]
    with open(path, "w", encoding="utf-8") as f:
        f.write("\n".join(head))


def state_path(session_id):
    return os.path.join(ROOT, ".claude", "hooks", ".state", "%s.json" % session_id)


def load_state(session_id):
    # Counters live outside the log so quoted LOG_ENTRY lines can't skew them.
    try:
        with open(state_path(session_id)) as f:
            return json.load(f)
    except Exception:
        return {"prompts": 0, "responses": 0, "model": None}


def save_state(session_id, state):
    os.makedirs(os.path.dirname(state_path(session_id)), exist_ok=True)
    with open(state_path(session_id), "w") as f:
        json.dump(state, f)


def append(path, kind, num, session_id, ts, model, body):
    with open(path, "a", encoding="utf-8") as f:
        f.write(
            "\n[LOG_ENTRY type=%s num=%d session=%s]\ntimestamp: %s\nmodel: %s\n\n%s\n\n"
            % (kind, num, session_id[:8], iso(ts), model, body.rstrip("\n"))
        )


def bump_header(path, total, last_prompt, model):
    """Refresh frontmatter counters only; never touches the entries below."""
    with open(path, encoding="utf-8") as f:
        text = f.read()
    end = text.find("\n---", 4)
    if end < 0:
        return
    head, rest = text[:end], text[end:]
    head = re.sub(r"(?m)^total_exchanges: .*$", "total_exchanges: %d" % total, head)
    if last_prompt:
        head = re.sub(
            r"(?m)^last_prompt_time: .*$", "last_prompt_time: %s" % iso(last_prompt), head
        )
    if model and re.search(r"(?m)^model: unknown$", head):
        head = re.sub(r"(?m)^model: .*$", "model: %s" % model, head)
    with open(path, "w", encoding="utf-8") as f:
        f.write(head + rest)


def parse_ts(s):
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")).astimezone(timezone.utc)
    except Exception:
        return now()


def configured_model():
    """Model the session will start with: env override, else settings files."""
    if os.environ.get("ANTHROPIC_MODEL"):
        return os.environ["ANTHROPIC_MODEL"]
    for path in (
        os.path.join(ROOT, ".claude", "settings.local.json"),
        os.path.join(ROOT, ".claude", "settings.json"),
        os.path.expanduser("~/.claude/settings.json"),
    ):
        try:
            with open(path) as f:
                model = json.load(f).get("model")
        except Exception:
            continue
        if model:
            return re.sub(r"\[.*\]$", "", model)
    return None


def on_session(data):
    # The transcript has no assistant entry before the first prompt, and the
    # SessionStart payload may not name the model, so fall back to settings.
    sid = data.get("session_id", "unknown")
    state = load_state(sid)
    model = data.get("model") or configured_model()
    if isinstance(model, dict):
        model = model.get("id") or model.get("display_name")
    if model:
        state["model"] = model
        save_state(sid, state)


def on_prompt(data):
    sid = data.get("session_id", "unknown")
    ts = now()
    entries = read_transcript(data.get("transcript_path"))
    state = load_state(sid)
    model = (
        data.get("model")
        or last_model(entries)
        or state.get("model")
        or configured_model()
        or "unknown"
    )
    path, fresh = log_path(sid, ts)
    if fresh:
        create(path, sid, ts, model)
    num = state["prompts"] = state["prompts"] + 1
    append(path, "PROMPT", num, sid, ts, model, data.get("prompt", ""))
    save_state(sid, state)
    bump_header(path, num, ts, model)


def on_stop(data):
    sid = data.get("session_id", "unknown")
    ts = now()
    tpath = data.get("transcript_path")

    # The transcript can lag the Stop event; wait briefly for the final text.
    text = model = None
    entries = []
    for _ in range(10):
        entries = read_transcript(tpath)
        text, model = final_response(entries)
        if text.strip():
            break
        time.sleep(0.3)
    text = data.get("last_assistant_message") or text or ""
    state = load_state(sid)
    model = (
        model
        or last_model(entries)
        or state.get("model")
        or os.environ.get("ANTHROPIC_MODEL")
        or "unknown"
    )
    if not text.strip():
        text = "(no final text response captured for this turn)"

    path, fresh = log_path(sid, ts)
    prompts, responses = state["prompts"], state["responses"]

    # Hook installed mid-session (or prompt hook missed): recover the prompt
    # verbatim from the transcript so the response is not orphaned.
    if prompts <= responses:
        last = next((e for e in reversed(entries) if is_prompt(e)), None)
        if last is not None:
            pts = parse_ts(last.get("timestamp", ""))
            if fresh:
                path, _ = log_path(sid, pts)
                create(path, sid, pts, model)
                fresh = False
            prompts += 1
            append(path, "PROMPT", prompts, sid, pts, model,
                   text_of(last["message"]["content"]))
            bump_header(path, prompts, pts, model)
    if fresh:
        create(path, sid, ts, model)

    append(path, "RESPONSE", max(prompts, 1), sid, ts, model, text)
    state.update(prompts=prompts, responses=max(prompts, 1))
    save_state(sid, state)
    bump_header(path, max(prompts, 1), None, model)


def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    try:
        data = json.load(sys.stdin)
    except ValueError:
        data = {}
    if data.get("stop_hook_active"):
        return
    os.makedirs(LOG_DIR, exist_ok=True)
    if mode == "session":
        on_session(data)
    elif mode == "prompt":
        on_prompt(data)
    elif mode == "stop":
        on_stop(data)


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:  # never block the session over logging
        try:
            os.makedirs(LOG_DIR, exist_ok=True)
            with open(os.path.join(LOG_DIR, "capture-errors.log"), "a") as f:
                f.write("%s %s: %r\n" % (iso(now()), " ".join(sys.argv[1:]), exc))
        except Exception:
            pass
    sys.exit(0)
