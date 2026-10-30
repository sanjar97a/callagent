[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host "Agent va server loglari (chiqish: Ctrl+C)" -ForegroundColor Cyan
docker compose logs -f --tail 100 agent server tunnel
