$ErrorActionPreference = 'Stop'
$taskRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$taskScript = Join-Path $taskRoot 'reference-motion\pc-worker.js'
$taskDirectory = Join-Path $env:LOCALAPPDATA 'ShortsCraft\reference-pc-worker'
$taskStatePath = Join-Path $taskDirectory 'worker-state.json'
$taskStopPath = Join-Path $taskDirectory 'stop-request.json'
if (-not (Test-Path -LiteralPath $taskStatePath)) { Write-Output 'The ShortsCraft PC beta worker is not running.'; exit 0 }
if ((Get-Item -LiteralPath $taskDirectory).Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Aliased worker state directory refused.' }
$taskState = Get-Content -LiteralPath $taskStatePath -Raw | ConvertFrom-Json
if ($taskState.kind -ne 'shortscraft-reference-pc-worker-process-v1' -or $taskState.scriptPath -ne $taskScript -or [int]$taskState.pid -le 0) {
    throw 'Unrecognized worker state. No process was changed.'
}
function Get-OwnedReferenceWorker {
    $taskCandidate = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$taskState.pid)" -ErrorAction Stop
    if (-not $taskCandidate) { return $null }
    $taskBirth = ([DateTimeOffset]$taskCandidate.CreationDate.ToUniversalTime()).ToUnixTimeMilliseconds()
    if ($taskCandidate.ExecutablePath -ne $taskState.nodePath -or [Math]::Abs($taskBirth - [double]$taskState.bornAtUnixMs) -ge 3000 -or
        $taskCandidate.CommandLine -notmatch ([regex]::Escape($taskScript)) -or $taskCandidate.CommandLine -notmatch '\srun(?:\s|$)') {
        throw 'The recorded PID is not the owned worker. No unrelated process will be stopped.'
    }
    return $taskCandidate
}
if (-not (Get-OwnedReferenceWorker)) { Remove-Item -LiteralPath $taskStatePath; Write-Output 'Removed a stale worker state file; no process was stopped.'; exit 0 }
$taskMarker = @{kind='shortscraft-reference-pc-worker-stop-v1'; workerId=$taskState.workerId} | ConvertTo-Json -Compress
[IO.File]::WriteAllText($taskStopPath, $taskMarker, [Text.UTF8Encoding]::new($false))
for ($taskIndex=0; $taskIndex -lt 25; $taskIndex++) {
    Start-Sleep -Seconds 1
    if (-not (Get-OwnedReferenceWorker)) { break }
}
$taskRemaining = Get-OwnedReferenceWorker
if ($taskRemaining) {
    # Revalidated PID, process birth, executable and this exact worker script.
    # /T targets only descendants of the worker, never arbitrary Chrome/Node.
    & "$env:SystemRoot\System32\taskkill.exe" /PID ([int]$taskState.pid) /T /F | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Owned worker termination could not be confirmed.' }
}
if (-not (Get-OwnedReferenceWorker)) {
    if (Test-Path -LiteralPath $taskStatePath) { Remove-Item -LiteralPath $taskStatePath }
    if (Test-Path -LiteralPath $taskStopPath) { Remove-Item -LiteralPath $taskStopPath }
}
Write-Output 'Stopped only the ShortsCraft PC beta worker and its owned processing children. Manual restart is required.'
