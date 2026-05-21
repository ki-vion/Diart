# Build PyInstaller sidecar for Tauri externalBin
Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Push-Location $PSScriptRoot
pip install pyinstaller -q
pyinstaller --onefile --name extractor-sidecar main.py

$destDir = Join-Path $PSScriptRoot "..\desktop\src-tauri\binaries"
New-Item -ItemType Directory -Force -Path $destDir | Out-Null
Copy-Item -Force "dist\extractor-sidecar.exe" (Join-Path $destDir "extractor-sidecar-x86_64-pc-windows-msvc.exe")
Write-Host "Sidecar copied to desktop/src-tauri/binaries/"
Pop-Location
