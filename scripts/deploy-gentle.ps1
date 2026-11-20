# Gentle Low-CPU / Low-RAM Firebase Hosting Deploy Script for Windows
# Prevents CPU/thermal spikes and Windows BSODs during Next.js production builds.

$ErrorActionPreference = "Stop"

$env:NODE_OPTIONS = "--max-old-space-size=2048 --dns-result-order=ipv4first"
$env:NEXT_TELEMETRY_DISABLED = "1"
$env:UV_THREADPOOL_SIZE = "2"

Write-Host "Starting gentle low-CPU Firebase Hosting deploy (BelowNormal priority, 1 CPU worker, 2GB heap cap)..." -ForegroundColor Cyan

$proc = Start-Process -FilePath "cmd.exe" `
  -ArgumentList "/c firebase deploy --only hosting --non-interactive" `
  -WorkingDirectory "C:\Users\amoma\lonkind-app" `
  -NoNewWindow `
  -PassThru

try {
  $proc.PriorityClass = [System.Diagnostics.ProcessPriorityClass]::BelowNormal
} catch {
  # Ignore if priority cannot be adjusted
}

$proc.WaitForExit()
exit $proc.ExitCode
