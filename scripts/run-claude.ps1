param(
  [string]$ConfigPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'claudecron.config.json')
)

$root = Split-Path -Parent $PSScriptRoot
$config = Get-Content -Raw $ConfigPath | ConvertFrom-Json
$prompt = [string]$config.prompt
if ([string]::IsNullOrWhiteSpace($prompt)) { throw 'prompt is required.' }
$logFile = [string]$config.logFile
if ([string]::IsNullOrWhiteSpace($logFile)) { throw 'logFile is required.' }
$logPath = if ([System.IO.Path]::IsPathRooted($logFile)) { $logFile } else { Join-Path $root $logFile }
$logDir = Split-Path -Parent $logPath
$claude = Get-Command claude -ErrorAction Stop
$argsList = @('-p', $prompt)
if ($config.model) { $argsList += @('--model', [string]$config.model) }

New-Item -ItemType Directory -Force -Path $logDir | Out-Null
Set-Location $root
Add-Content -Path $logPath -Value ("[{0}] start" -f (Get-Date -Format o))
& $claude.Source @argsList >> $logPath 2>&1
$exitCode = $LASTEXITCODE
if ($null -eq $exitCode) { $exitCode = 1 }
Add-Content -Path $logPath -Value ("[{0}] exit {1}" -f (Get-Date -Format o), $exitCode)
exit $exitCode
