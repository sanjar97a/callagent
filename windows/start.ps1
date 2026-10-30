# CallAgent - Windows'da bir bosishda ishga tushirish
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Utf8 = New-Object System.Text.UTF8Encoding $false

function Say($text, $color = 'Gray') { Write-Host $text -ForegroundColor $color }
function Stop-WithMessage($text) {
    Say ""
    Say $text 'Red'
    Say ""
    Read-Host "Yopish uchun Enter bosing"
    exit 1
}
function Read-EnvValue($lines, $name) {
    foreach ($l in $lines) { if ($l -match "^\s*$name=(.*)$") { return $Matches[1].Trim() } }
    return ''
}
function New-Secret($len) {
    $chars = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    $bytes = New-Object byte[] $len
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

Say ""
Say "  CallAgent - ovozli AI agentlar" 'Cyan'
Say "  ------------------------------" 'Cyan'
Say ""

# ---------- 1. Docker ----------
$docker = Get-Command docker -ErrorAction SilentlyContinue
if (-not $docker) {
    Say "Docker Desktop topilmadi." 'Yellow'
    Say "Uni o'rnating: https://www.docker.com/products/docker-desktop/"
    Say "O'rnatgach kompyuterni qayta yoqing, Docker Desktop'ni oching va start.bat ni yana bosing."
    Start-Process "https://www.docker.com/products/docker-desktop/"
    Stop-WithMessage "Docker kerak."
}

$ready = $false
try { docker info *> $null; $ready = ($LASTEXITCODE -eq 0) } catch { $ready = $false }
if (-not $ready) {
    Say "Docker Desktop ishga tushirilmoqda..." 'Yellow'
    $dd = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if (Test-Path $dd) { Start-Process $dd }
    for ($i = 0; $i -lt 60; $i++) {
        Start-Sleep -Seconds 3
        try { docker info *> $null; if ($LASTEXITCODE -eq 0) { $ready = $true; break } } catch {}
        Write-Host "." -NoNewline
    }
    Say ""
    if (-not $ready) { Stop-WithMessage "Docker ishga tushmadi. Docker Desktop'ni qo'lda oching, pastda 'Engine running' chiqqach start.bat ni qayta bosing." }
}
Say "Docker ishlayapti." 'Green'

# ---------- 2. .env ----------
$envPath = Join-Path $Root '.env'
$firstRun = -not (Test-Path $envPath)
if ($firstRun) {
    $lines = [System.IO.File]::ReadAllLines((Join-Path $Root '.env.example'), $Utf8)
    $secrets = @{
        'DB_PASSWORD'    = (New-Secret 24)
        'INTERNAL_TOKEN' = (New-Secret 40)
        'JWT_SECRET'     = (New-Secret 40)
        'ADMIN_PASSWORD' = (New-Secret 10)
    }
    $lines = $lines | ForEach-Object {
        $line = $_
        foreach ($k in $secrets.Keys) { if ($line -match "^$k=\s*$") { $line = "$k=$($secrets[$k])" } }
        $line
    }
    [System.IO.File]::WriteAllText($envPath, (($lines -join "`n") + "`n"), $Utf8)
    Say ".env yaratildi, maxfiy parollar avtomatik qo'yildi." 'Green'
}

$envLines = [System.IO.File]::ReadAllLines($envPath, $Utf8)
$missing = @()
foreach ($k in 'GOOGLE_API_KEY', 'YANDEX_API_KEY', 'YANDEX_FOLDER_ID') {
    if (-not (Read-EnvValue $envLines $k)) { $missing += $k }
}
if ($missing.Count -gt 0) {
    Say ""
    Say "Quyidagi kalitlar hali yozilmagan: $($missing -join ', ')" 'Yellow'
    Say "Hozir .env fayli Bloknotda ochiladi. Kalitlarni '=' belgisidan keyin yozing, saqlang (Ctrl+S) va Bloknotni yoping."
    Say "Kalitsiz ham dashboard ochiladi, lekin agent gapira olmaydi."
    Read-Host "Davom etish uchun Enter bosing"
    Start-Process notepad.exe -ArgumentList "`"$envPath`"" -Wait
    $envLines = [System.IO.File]::ReadAllLines($envPath, $Utf8)
}

# ---------- 3. Ishga tushirish ----------
Say ""
Say "Tizim yig'ilmoqda va ishga tushirilmoqda. Birinchi marta 5-15 daqiqa ketadi (internetdan yuklanadi)..." 'Cyan'
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { Stop-WithMessage "Ishga tushirishda xato. Yuqoridagi xabarni nusxalab yuboring." }

$port = Read-EnvValue $envLines 'WEB_PORT'; if (-not $port) { $port = '8080' }
$url = "http://localhost:$port"
Say "Dashboard tayyor bo'lishini kutyapman..." 'Cyan'
$up = $false
for ($i = 0; $i -lt 90; $i++) {
    try {
        $r = Invoke-WebRequest -UseBasicParsing -Uri "$url/api/auth/me" -TimeoutSec 3 -ErrorAction Stop
        $up = $true; break
    } catch {
        # 401 - server ishlayapti, faqat kirilmagan
        if ($_.Exception.Response -and [int]$_.Exception.Response.StatusCode -eq 401) { $up = $true; break }
    }
    Start-Sleep -Seconds 2
}
if (-not $up) { Stop-WithMessage "Server javob bermadi. 'docker compose logs server' natijasini yuboring." }

# ---------- 4. Tunnel manzili ----------
$public = $null
for ($i = 0; $i -lt 20; $i++) {
    $logs = docker compose logs tunnel 2>&1 | Out-String
    $m = [regex]::Match($logs, 'https://[a-z0-9-]+\.trycloudflare\.com')
    if ($m.Success) { $public = $m.Value; break }
    Start-Sleep -Seconds 2
}

$email = Read-EnvValue $envLines 'ADMIN_EMAIL'
$pass = Read-EnvValue $envLines 'ADMIN_PASSWORD'
Say ""
Say "  ================= TAYYOR =================" 'Green'
Say "  Dashboard:  $url" 'Green'
Say "  Email:      $email"
Say "  Parol:      $pass"
if ($public) {
    Say "  Internetdagi manzil:   $public"
    Say "  Twilio webhook:        $public/twilio/incoming"
} else {
    Say "  Tunnel manzili hali chiqmadi - dashboard'dagi Kampaniyalar sahifasida ko'rinadi." 'Yellow'
}
Say "  To'xtatish uchun: stop.bat"
Say "  ==========================================" 'Green'
Say ""
Start-Process $url
Read-Host "Bu oynani yopish mumkin (tizim fonda ishlayveradi). Enter"
