#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
HASH Direct Wrapper — remplace `opencode run` par notre wrapper direct.
Permet d'utiliser `opencode run "prompt"` sans changer les habitudes.
"""

import sys
import subprocess
from pathlib import Path

SCRIPTS_DIR = Path.home() / ".config" / "opencode" / "scripts"
HASH_DIRECT = SCRIPTS_DIR / "hash-direct.py"


def main():
    # Si pas d'argument, affiche l'aide opencode (pour compatibilité)
    if len(sys.argv) <= 1:
        # Passe à opencode réel pour les commandes natives (config, plugin, etc.)
        subprocess.run(["opencode"])
        return

    # Si la première commande est "run" ou "r", on redirige vers hash-direct
    if sys.argv[1] in ("run", "r"):
        # Reconstruire le prompt à partir des arguments restants
        prompt = " ".join(sys.argv[2:])
        
        # Si le prompt est vide, affiche l'aide hash-direct
        if not prompt:
            subprocess.run([sys.executable, str(HASH_DIRECT)])
            return
        
        # Appeler hash-direct.py via subprocess
        cmd = [sys.executable, str(HASH_DIRECT), prompt] + sys.argv[3:]
        subprocess.run(cmd)
        return

    # Sinon, commande opencode native (config, plugin, agent, etc.)
    subprocess.run(["opencode"] + sys.argv[1:])


if __name__ == "__main__":
    main()