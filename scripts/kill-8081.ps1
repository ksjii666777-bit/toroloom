$p = Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue
if ($p) {
    $procId = $p.OwningProcess
    Stop-Process -Id $procId -Force -ErrorAction Stop
    Write-Host "Killed PID $procId on port 8081"
} else {
    Write-Host "No process on port 8081"
}
Start-Sleep -Seconds 2
if (Get-NetTCPConnection -LocalPort 8081 -ErrorAction SilentlyContinue) {
    Write-Host "8081: STILL IN USE"
} else {
    Write-Host "8081: FREE"
}
