# Constella Windows Media Session (SMTC) Reader
$ErrorActionPreference = 'SilentlyContinue'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media, ContentType = WindowsRuntime] | Out-Null

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { 
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' 
})[0]

function Await($WinRtTask, $ResultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
    $netTask = $asTask.Invoke($null, @($WinRtTask))
    $netTask.Wait(-1) | Out-Null
    $netTask.Result
}

try {
    $op = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()
    $mgr = Await $op ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])
} catch {
    Write-Output '{"status":"ERROR","message":"Failed to initialize SMTC"}'
    exit
}

$lastSignature = ""

while ($true) {
    try {
        $session = $mgr.GetCurrentSession()
        if ($session) {
            $info = Await ($session.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
            $playback = $session.GetPlaybackInfo()
            $timeline = $session.GetTimelineProperties()

            $title = if ($info) { $info.Title } else { "" }
            $artist = if ($info) { $info.Artist } else { "" }
            $album = if ($info) { $info.AlbumTitle } else { "" }
            $status = if ($playback) { $playback.PlaybackStatus.ToString() } else { "Closed" }
            $pos = if ($timeline) { $timeline.Position.TotalSeconds } else { 0 }
            $dur = if ($timeline) { $timeline.EndTime.TotalSeconds } else { 0 }
            $appId = $session.SourceAppUserModelId

            $sig = "$title|$artist|$status|[Math]::Round($pos, 1)"
            
            $data = [PSCustomObject]@{
                status = "ACTIVE"
                title = $title
                artist = $artist
                album = $album
                playbackStatus = $status
                position = $pos
                duration = $dur
                sourceApp = $appId
                timestamp = [DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds()
            }
            $json = $data | ConvertTo-Json -Compress
            Write-Output $json
        } else {
            if ($lastSignature -ne "NO_SESSION") {
                $lastSignature = "NO_SESSION"
                Write-Output '{"status":"NO_SESSION"}'
            }
        }
    } catch {
        # ignore transient COM query errors
    }
    Start-Sleep -Milliseconds 250
}
