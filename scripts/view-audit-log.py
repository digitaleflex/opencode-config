#!/usr/bin/env python3
"""
Audit log viewer for opencode agent audit logs.
Usage: python view-audit-log.py [--date YYYY-MM-DD] [--tool TOOL] [--agent AGENT] [--provider PROVIDER]
       [--model MODEL] [--sensitive] [--errors] [--limit N] [--since TIME] [--until TIME]
       [--statistics] [--json]
"""
import json
import sys
import argparse
from datetime import datetime, timedelta
from pathlib import Path

LOG_DIR = Path.home() / ".config" / "opencode" / "logs"

EMOJI_MAP = {
    "ok": "[OK]",
    "success": "[OK]",
    "error": "[ERR]",
    "failed": "[ERR]",
    "blocked": "[BLK]",
    "sensitive": "[R]",
    "agent": "[AGT]",
    "tool": "[TL]",
    "warning": "[WRN]",
}

def parse_args():
    parser = argparse.ArgumentParser(description="View opencode audit logs")
    parser.add_argument("--date", help="YYYY-MM-DD (default: today)")
    parser.add_argument("--tool", help="Filter by tool name (e.g. bash, edit)")
    parser.add_argument("--agent", help="Filter by agent name")
    parser.add_argument("--provider", help="Filter by provider (groq, mistral, etc.)")
    parser.add_argument("--model", help="Filter by model name")
    parser.add_argument("--sensitive", action="store_true", help="Only sensitive operations")
    parser.add_argument("--errors", action="store_true", help="Only failed operations")
    parser.add_argument("--limit", type=int, default=50, help="Max entries to show (default: 50)")
    parser.add_argument("--all", action="store_true", help="Show all dates")
    parser.add_argument("--since", help="Start time HH:MM (today) or YYYY-MM-DD HH:MM")
    parser.add_argument("--until", help="End time HH:MM (today) or YYYY-MM-DD HH:MM")
    parser.add_argument("--statistics", action="store_true", help="Show statistics instead of entries")
    parser.add_argument("--json", action="store_true", help="Output raw JSON")
    return parser.parse_args()

def parse_time(time_str, default_date):
    """Parse time string like 'HH:MM' or 'YYYY-MM-DD HH:MM'."""
    try:
        if " " in time_str:
            return datetime.strptime(time_str, "%Y-%m-%d %H:%M")
        else:
            return datetime.combine(default_date, datetime.strptime(time_str, "%H:%M").time())
    except ValueError:
        return None

def match_entry(entry, args, since_dt, until_dt):
    """Check if entry matches all filters."""
    # Tool filter
    if args.tool and entry.get("tool") != args.tool:
        return False
    
    # Agent filter
    if args.agent and entry.get("agent") != args.agent:
        return False
    
    # Provider filter
    if args.provider and entry.get("provider") != args.provider:
        return False
    
    # Model filter
    if args.model and entry.get("model") != args.model:
        return False
    
    # Sensitive filter
    if args.sensitive and not entry.get("sensitive", False):
        return False
    
    # Error filter
    if args.errors:
        has_error = entry.get("error") is not None
        is_failed = entry.get("success") is False
        if not (has_error or is_failed):
            return False
    
    # Time filter
    ts_str = entry.get("ts", "")
    if ts_str:
        try:
            entry_dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            if since_dt and entry_dt < since_dt:
                return False
            if until_dt and entry_dt > until_dt:
                return False
        except ValueError:
            pass
    
    return True

def format_entry(entry, show_json=False):
    """Format a log entry for display."""
    if show_json:
        return json.dumps(entry, ensure_ascii=False)
    
    ts = entry.get("ts", "")
    event = entry.get("event", "")
    tool = entry.get("tool", "")
    agent = entry.get("agent", "")
    model = entry.get("model", "")
    provider = entry.get("provider", "")
    sensitive = entry.get("sensitive", False)
    error = entry.get("error", "")
    success = entry.get("success", None)
    args_data = entry.get("args", {})
    
    # Status marker
    status = ""
    if error:
        status = f" {EMOJI_MAP['error']} {error[:80]}"
    elif success is False:
        status = f" {EMOJI_MAP['failed']} failed"
    elif event == "tool.execute.after" and not error:
        status = f" {EMOJI_MAP['ok']}"
    elif sensitive:
        status = f" {EMOJI_MAP['sensitive']}"
    
    sensitive_marker = EMOJI_MAP['sensitive'] if sensitive else ""
    
    # Shorten args for display
    args_str = json.dumps(args_data, ensure_ascii=False)
    if len(args_str) > 120:
        args_str = args_str[:120] + "..."
    
    if event == "agent.invoked":
        task_preview = entry.get("task", "")[:80]
        model_info = f" ({model})" if model else ""
        provider_info = f" via {provider}" if provider else ""
        return f"{ts} {sensitive_marker}{EMOJI_MAP['agent']} {agent}{model_info}{provider_info}\n         task: {task_preview}"
    
    elif event in ("tool.execute.before", "tool.execute.after"):
        return f"{ts} {sensitive_marker}{EMOJI_MAP['tool']} {tool} -> {args_str}{status}"
    
    else:
        # Generic fallback
        extra = ""
        if model:
            extra += f" model={model}"
        if provider:
            extra += f" provider={provider}"
        return f"{ts} {sensitive_marker}{event}{extra} {json.dumps(entry, ensure_ascii=False)[:200]}"

def compute_statistics(entries):
    """Compute statistics from log entries."""
    stats = {
        "total": 0,
        "by_event": {},
        "by_tool": {},
        "by_agent": {},
        "by_provider": {},
        "by_model": {},
        "errors": 0,
        "blocked": 0,
        "sensitive": 0,
        "success": 0,
    }
    
    for entry in entries:
        stats["total"] += 1
        
        # By event
        event = entry.get("event", "unknown")
        stats["by_event"][event] = stats["by_event"].get(event, 0) + 1
        
        # By tool
        tool = entry.get("tool", "unknown")
        stats["by_tool"][tool] = stats["by_tool"].get(tool, 0) + 1
        
        # By agent
        agent = entry.get("agent", "unknown")
        stats["by_agent"][agent] = stats["by_agent"].get(agent, 0) + 1
        
        # By provider
        provider = entry.get("provider")
        if provider:
            stats["by_provider"][provider] = stats["by_provider"].get(provider, 0) + 1
        
        # By model
        model = entry.get("model")
        if model:
            stats["by_model"][model] = stats["by_model"].get(model, 0) + 1
        
        # Counters
        if entry.get("error") is not None:
            stats["errors"] += 1
        if entry.get("success") is False:
            stats["errors"] += 1
        if entry.get("blocked") is True:
            stats["blocked"] += 1
        if entry.get("sensitive") is True:
            stats["sensitive"] += 1
        if entry.get("success") is True:
            stats["success"] += 1
    
    return stats

def print_statistics(stats):
    """Print statistics in a nice format."""
    print("=== Audit Log Statistics ===")
    print(f"Total entries: {stats['total']}")
    print()
    
    print("--- By Event ---")
    for event, count in sorted(stats["by_event"].items(), key=lambda x: -x[1]):
        print(f"  {event}: {count}")
    print()
    
    print("--- By Tool ---")
    for tool, count in sorted(stats["by_tool"].items(), key=lambda x: -x[1]):
        print(f"  {tool}: {count}")
    print()
    
    print("--- By Agent ---")
    for agent, count in sorted(stats["by_agent"].items(), key=lambda x: -x[1]):
        print(f"  {agent}: {count}")
    print()
    
    if stats["by_provider"]:
        print("--- By Provider ---")
        for provider, count in sorted(stats["by_provider"].items(), key=lambda x: -x[1]):
            print(f"  {provider}: {count}")
        print()
    
    if stats["by_model"]:
        print("--- By Model ---")
        for model, count in sorted(stats["by_model"].items(), key=lambda x: -x[1]):
            print(f"  {model}: {count}")
        print()
    
    print("--- Status ---")
    print(f"  Successful: {stats['success']}")
    print(f"  Errors:     {stats['errors']}")
    print(f"  Blocked:    {stats['blocked']}")
    print(f"  Sensitive:  {stats['sensitive']}")

def main():
    args = parse_args()
    
    limit = args.limit
    count = 0
    found_any = False
    all_entries = []
    
    # Determine time range
    now = datetime.now()
    today = now.date()
    
    since_dt = parse_time(args.since, today) if args.since else None
    until_dt = parse_time(args.until, today) if args.until else None
    
    # Determine which files to read
    if args.all:
        log_files = sorted(LOG_DIR.glob("audit-*.jsonl"), reverse=True)
    else:
        date = args.date or today.strftime("%Y-%m-%d")
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
                    try:
                        entry = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    
                    if not match_entry(entry, args, since_dt, until_dt):
                        continue
                    
                    found_any = True
                    all_entries.append(entry)
                    
                    if not args.statistics:
                        print(format_entry(entry, args.json))
                        count += 1
                        if count >= limit:
                            break
            
            if count >= limit and not args.statistics:
                break
                
        except FileNotFoundError:
            continue
    
    if args.statistics:
        stats = compute_statistics(all_entries)
        print_statistics(stats)
    elif not found_any:
        print(f"[audit-log] No matching entries found")
        print(f"  Logs in: {LOG_DIR}")
        print(f"  Try: --all to see all dates, or --limit 100 for more entries")

if __name__ == "__main__":
    main()