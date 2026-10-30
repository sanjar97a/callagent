[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-Location (Split-Path -Parent $PSScriptRoot)
Write-Host "CallAgent to'xtatilmoqda..." -ForegroundColor Cyan
docker compose down
Write-Host "To'xtatildi. Ma'lumotlar (agentlar, qo'ng'iroqlar) saqlanib qoladi." -ForegroundColor Green
Read-Host "Enter"
