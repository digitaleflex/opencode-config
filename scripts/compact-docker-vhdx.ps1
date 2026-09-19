# ─────────────────────────────────────────────────────────────
#  Compaction du disque virtuel Docker (VHDX)
#
#  POURQUOI
#  --------
#  Sur Windows, Docker Desktop stocke tout dans un fichier VHDX
#  (docker_data.vhdx). Quand on libère de l'espace *à l'intérieur*
#  (docker builder prune), le fichier VHDX ne rétrécit PAS tout seul.
#  Il faut le compacter pour rendre l'espace au disque C:.
#
#  Constaté : 8,3 Go libérés par `docker builder prune`, mais 0 Go
#  récupéré sur C: car le VHDX n'a pas été compacté.
#
#  PRÉREQUIS
#  ---------
#  - Docker Desktop FERMÉ (ou au moins : `wsl --shutdown`)
#  - Droits ADMINISTRATEUR (diskpart l'exige)
#
#  USAGE
#  -----
#  Clic droit sur PowerShell → "Exécuter en tant qu'administrateur", puis :
#    powershell -ExecutionPolicy Bypass -File compact-docker-vhdx.ps1
# ─────────────────────────────────────────────────────────────

$ErrorActionPreference = "Stop"

function Get-FreeGB { [math]::Round((Get-PSDrive C).Free / 1GB, 2) }

$vhdx = "$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx"

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  COMPACTION DU DISQUE VIRTUEL DOCKER" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan

if (-not (Test-Path $vhdx)) {
    Write-Host "❌ VHDX introuvable : $vhdx" -ForegroundColor Red
    Write-Host "   Docker Desktop a peut-être un autre emplacement." -ForegroundColor Yellow
    exit 1
}

$sizeBefore = [math]::Round((Get-Item $vhdx).Length / 1GB, 2)
$freeBefore = Get-FreeGB

Write-Host "  VHDX        : $vhdx"
Write-Host "  Taille      : $sizeBefore Go"
Write-Host "  C: libre    : $freeBefore Go"
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan

# ── 1. Arrêt de WSL (libère le verrou sur le VHDX) ──
Write-Host ""
Write-Host "▶ Arrêt de WSL / Docker…" -ForegroundColor Yellow
wsl --shutdown
Start-Sleep -Seconds 5
Write-Host "  ✓ arrêté"

# ── 2. Compaction ──
# Deux méthodes : Optimize-VHD (Hyper-V) si dispo, sinon diskpart.
Write-Host ""
$optimize = Get-Command Optimize-VHD -ErrorAction SilentlyContinue

if ($optimize) {
    Write-Host "▶ Optimize-VHD (Hyper-V détecté)…" -ForegroundColor Yellow
    Optimize-VHD -Path $vhdx -Mode Full
    Write-Host "  ✓ compacté"
} else {
    Write-Host "▶ diskpart (Hyper-V absent — méthode standard)…" -ForegroundColor Yellow
    $dp = @"
select vdisk file="$vhdx"
attach vdisk readonly
compact vdisk
detach vdisk
exit
"@
    $tmp = Join-Path $env:TEMP "compact-vhdx.txt"
    Set-Content -Path $tmp -Value $dp -Encoding ASCII
    diskpart /s $tmp
    Remove-Item $tmp -Force
    Write-Host "  ✓ compacté"
}

# ── 3. Bilan ──
$sizeAfter = [math]::Round((Get-Item $vhdx).Length / 1GB, 2)
$freeAfter = Get-FreeGB

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  VHDX   : $sizeBefore Go  →  $sizeAfter Go   (gagné : $([math]::Round($sizeBefore - $sizeAfter, 2)) Go)"
Write-Host "  C: libre : $freeBefore Go  →  $freeAfter Go" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Pour redémarrer Docker : lance Docker Desktop normalement." -ForegroundColor Yellow
Write-Host ""
