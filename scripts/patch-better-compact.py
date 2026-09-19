import os

# Patch better-compact pour Windows : fsync sur handle read-only → EPERM
# Fix : ouvrir en "r+" (lecture-écriture) + protéger le fsync répertoire.
TARGET = os.path.expanduser(
    r"~\.cache\opencode\packages\better-compact\node_modules\better-compact\dist\tui.js"
)

with open(TARGET, encoding="utf-8") as f:
    src = f.read()

orig = src

# 1. Handle temp : lecture seule → lecture-écriture (permet fsync sur Windows)
src = src.replace(
    'const temporaryHandle = openSync(temp, "r");',
    'const temporaryHandle = openSync(temp, "r+");',
)

# 2. fsync répertoire : openSync sur un dossier plante sur Windows (EISDIR/EPERM)
#    → protégé par try/catch silencieux.
old_dir = '''    const directoryHandle = openSync(dirname(path), "r");
    try {
      fsyncSync(directoryHandle);
    } finally {
      closeSync(directoryHandle);
    }'''
new_dir = '''    try {
      const directoryHandle = openSync(dirname(path), "r");
      try {
        fsyncSync(directoryHandle);
      } finally {
        closeSync(directoryHandle);
      }
    } catch {}'''

if old_dir in src:
    src = src.replace(old_dir, new_dir)
else:
    print("WARN: pattern fsync répertoire non trouvé (peut-être déjà patché)")

with open(TARGET, "w", encoding="utf-8", newline="") as f:
    f.write(src)

print("Patch appliqué:", "OUI" if src != orig else "NON (déjà en place)")
print("  - openSync(temp, 'r') -> 'r+':", "OUI" if 'openSync(temp, "r+")' in src else "NON")
print("  - fsync répertoire protégé:", "OUI" if "catch {}" in src else "NON")