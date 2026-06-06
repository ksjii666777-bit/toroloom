try {
    $connection = Get-NetTCPConnection -LocalPort 3000 -ErrorAction Stop
    Stop-Process -Id $connection.OwningProcess -Force
    Write-Host "Killed process $($connection.OwningProcess) on port 3000"
} catch {
    Write-Host "No process found on port 3000"
}
Start-Sleep 2
try {
    $check = Get-NetTCPConnection -LocalPort 3000 -ErrorAction Stop
    Write-Host "Port 3000 STILL IN USE"
} catch {
    Write-Host "Port 3000 is FREE"
}
