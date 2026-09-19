#!/usr/bin/env python3
"""
update-readme-dates.py — Met à jour automatiquement les dates dans les README.

Remplace les placeholders de date dans les fichiers README et docs par la date
du jour au format AAAA-MM-JJ.

Usage:
    python scripts/update-readme-dates.py
    python scripts/update-readme-dates.py --date 2026-09-19   # date fixe
"""

import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

# Configuration
ROOT = Path(__file__).resolve().parent.parent
DATE_PATTERNS = [
    # (regex, format)
    (re.compile(r"(\*Dernière mise à jour : )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Last update: )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Documentation générée le )\$\(date\)(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Documentation mise à jour le )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Summary generated )\$\(date\)(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Document généré le )\$\(date\)(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Document generated )\$\(date\)(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Guide de dépannage généré le )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Troubleshooting guide generated )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Documentation sécurité générée le )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Security documentation generated )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Documentation commands générée le )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Documentation commands generated )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Documentation plugins générée le )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Plugins documentation generated )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Documentation scripts générée le )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Documentation scripts generated )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Documentation agents générée le )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Documentation agents generated )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Documentation skills générée le )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Skills documentation generated )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Configuration maintenue avec amour par EurinHash\*\n\*Dernière mise à jour : )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
    (re.compile(r"(\*Configuration maintained with love by EurinHash\*\n\*Last update: )\d{4}-\d{2}-\d{2}(\*)"), r"\g<1>{date}\g<2>"),
]

# Fichiers à scanner (README et docs)
TARGET_FILES = [
    "README.md",
    "README-en.md",
    "docs/README.md",
    "docs/01-architecture.md",
    "docs/01-architecture-en.md",
    "docs/02-configuration.md",
    "docs/02-configuration-en.md",
    "docs/03-agents.md",
    "docs/03-agents-en.md",
    "docs/04-scripts.md",
    "docs/04-scripts-en.md",
    "docs/05-plugins.md",
    "docs/05-plugins-en.md",
    "docs/06-commands.md",
    "docs/06-commands-en.md",
    "docs/07-skills.md",
    "docs/07-skills-en.md",
    "docs/08-troubleshooting.md",
    "docs/08-troubleshooting-en.md",
    "docs/09-security.md",
    "docs/09-security-en.md",
    "docs/10-summary.md",
    "docs/10-summary-en.md",
    "docs/11-examples.md",
    "docs/11-examples-en.md",
]


def get_date(args):
    if "--date" in args:
        idx = args.index("--date")
        if idx + 1 < len(args):
            return args[idx + 1]
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def update_file(filepath, date):
    path = ROOT / filepath
    if not path.exists():
        return False
    content = path.read_text(encoding="utf-8")
    original = content
    for pattern, replacement in DATE_PATTERNS:
        content = pattern.sub(replacement.format(date=date), content)
    if content != original:
        path.write_text(content, encoding="utf-8")
        return True
    return False


def main():
    date = get_date(sys.argv)
    print(f"📅 Date utilisée : {date}")
    updated = []
    for filepath in TARGET_FILES:
        if update_file(filepath, date):
            updated.append(filepath)
            print(f"  ✅ {filepath}")
    if updated:
        print(f"\n{len(updated)} fichier(s) mis à jour.")
    else:
        print("\nAucun fichier nécessitant une mise à jour.")


if __name__ == "__main__":
    main()
