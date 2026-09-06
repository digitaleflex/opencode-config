#!/usr/bin/env python3
"""
Audit log viewer for opencode agent audit logs.
Usage: python view-audit-log.py [--date YYYY-MM-DD] [--tool TOOL] [--agent AGENT] [--sensitive] [--limit N]
"""
import json
import sys
import argparse
from datetime import datetime
from pathlib import Path

LOG_DIR = Path.home() / ".config" / "opencode" / "logs"

def main():
    parser = argparse.ArgumentParser(description="View opencode audit logs")
    parser.add_argument("--date", help="YYYY-MM-DD (default: today)")
    parser.add_argument("--tool", help="Filter by tool name (e.g. bash, edit)")
    parser.add_argument("--agent", help="Filter by agent name")
    parser.add_argument("--sensitive", action="store_true", help="Only sensitive operations")
    parser.add_argument("--errors", action="store_true", help="Only failed operations")
    parser.add_argument("--limit", type=int, default=50, help="Max entries to show (default: 50)")
    parser.add_argument("--all", action="store_true", help="Show all dates")
    args = parser.parse_args()

    limit = args.limit
    count = 0
    found_any = False

    # Determine which files to read
    if args.all:
        log_files = sorted(LOG_DIR.glob("audit-*.jsonl"), reverse=True)
    else:
        date = args.date or datetime.now().strftime("%Y-%m-%d")
        log_file = LOG_DIR / f"audit-{date}.jsonl"
        log_files = [log_file] if log_file.exists() else []

    if not log_files:
        print(f"[audit-log] No log files found in {LOG_DIR}")
        print(f"  (use --date YYYY-MM-DD or --all to see older logs)")
        return

    for log_file in log_files:
        try:
            with open(log_file, encoding="utf-8") as f:
                for line in f:
                    if count >= limit:
                        break
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    # Filters
                    if args.tool and entry.get("tool") != args.tool:
                        continue
                    if args.agent and entry.get("agent") != args.agent:
                        continue
                    if args.sensitive and not entry.get("sensitive"):
                        continue
                    if args.errors and entry.get("error") is None and entry.get("success") is not False:
                        continue

                    found_any = True
                    ts = entry.get("ts", "")
                    event = entry.get("event", "")
                    tool = entry.get("tool", "")
                    agent = entry.get("agent", "")
                    sensitive = "[R] " if entry.get("sensitive") else "    "
                    error = entry.get("error", "")
                    success = entry.get("success", None)
                    status = ""
                    if error:
                        status = f" [ERR] {error[:80]}"
                    elif success is False:
                        status = " [ERR] failed"
                    elif event == "tool.execute.after":
                        status = " [OK]"

                    # Shorten long args for display
                    args_str = json.dumps(entry.get("args", {}), ensure_ascii=False)
                    if len(args_str) > 120:
                        args_str = args_str[:120] + "..."

                    if event == "agent.invoked":
                        model = entry.get("model", "")
                        task_preview = entry.get("task", "")[:80]
                        print(f"{ts} {sensitive}[agent] {agent} ({model})")
                        print(f"         task: {task_preview}")
                    elif event == "tool.execute.before":
                        print(f"{ts} {sensitive}[tool] {tool} -> {args_str}{status}")
                    elif event == "tool.execute.after":
                        print(f"{ts} {sensitive}[tool] {tool} -> {args_str}{status}")
                    else:
                        print(f"{ts} {sensitive}{event} {json.dumps(entry, ensure_ascii=False)[:200]}")

                    count += 1
        except FileNotFoundError:
            continue

    if not found_any:
        print(f"[audit-log] No matching entries found")
        print(f"  Logs in: {LOG_DIR}")
        print(f"  Try: --all to see all dates, or --limit 100 for more entries")

if __name__ == "__main__":
    main()
