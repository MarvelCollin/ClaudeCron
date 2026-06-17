param(
  [string]$ConfigPath = (Join-Path (Split-Path -Parent $PSScriptRoot) 'claudecron.config.json')
)

$root = Split-Path -Parent $PSScriptRoot
$node = Get-Command node -ErrorAction Stop
$runner = Join-Path $PSScriptRoot 'run-claude.js'
Set-Location $root
& $node.Source $runner --config $ConfigPath
exit $LASTEXITCODE
