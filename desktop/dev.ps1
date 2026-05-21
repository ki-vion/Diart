# Start Tauri dev with Rust/Cargo on PATH (nach frischer Rust-Installation)
$env:Path = "$env:USERPROFILE\.cargo\bin;" + $env:Path
Set-Location $PSScriptRoot
npm run tauri dev
