param([switch]$DevLoopback)
$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskScript = Join-Path $taskRoot 'reference-motion\pc-worker.js'
$taskNode = (Get-Command node.exe -ErrorAction Stop).Source
$taskDirectory = Join-Path $env:LOCALAPPDATA 'ShortsCraft\reference-pc-worker'
$taskStatePath = Join-Path $taskDirectory 'worker-state.json'
$taskConfigPath = Join-Path $taskDirectory 'config.json'
if (-not (Test-Path -LiteralPath $taskScript -PathType Leaf) -or -not (Test-Path -LiteralPath $taskConfigPath -PathType Leaf)) {
    throw 'The private PC worker must be configured before it is started.'
}
if ((Get-Item -LiteralPath $taskDirectory).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Aliased worker state directory refused.' }
if (Test-Path -LiteralPath $taskStatePath) {
    $taskState = Get-Content -LiteralPath $taskStatePath -Raw | ConvertFrom-Json
    if ($taskState.kind -ne 'shortscraft-reference-pc-worker-process-v1' -or $taskState.scriptPath -ne $taskScript) { throw 'Unrecognized worker state; no process was changed.' }
    $taskExisting = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$taskState.pid)" -ErrorAction Stop
    if ($taskExisting) {
        $taskBirth = ([DateTimeOffset]$taskExisting.CreationDate.ToUniversalTime()).ToUnixTimeMilliseconds()
        if ($taskExisting.ExecutablePath -eq $taskState.nodePath -and [Math]::Abs($taskBirth - [double]$taskState.bornAtUnixMs) -lt 3000 -and
            $taskExisting.CommandLine -match ([regex]::Escape($taskScript)) -and $taskExisting.CommandLine -match '\srun(?:\s|$)') {
            Write-Output 'The ShortsCraft PC beta worker is already running.'
            exit 0
        }
        throw 'The recorded PID is not the owned worker. No process was changed.'
    }
    Remove-Item -LiteralPath $taskStatePath
}
$taskArguments = @('"' + $taskScript + '"', 'run')
if ($DevLoopback) { $taskArguments += '--dev-loopback' }
$taskProcess = Start-Process -FilePath $taskNode -ArgumentList $taskArguments -WorkingDirectory $taskRoot -WindowStyle Hidden -PassThru `
    -RedirectStandardOutput (Join-Path $taskDirectory 'worker.stdout.log') -RedirectStandardError (Join-Path $taskDirectory 'worker.stderr.log')
Start-Sleep -Seconds 2
$taskProcess.Refresh()
if ($taskProcess.HasExited) { throw 'The worker did not stay running. Check the private worker logs; no token is logged.' }
Write-Output 'ShortsCraft PC beta worker started in the background. No inbound port or startup task was created.'
