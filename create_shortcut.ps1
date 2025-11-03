$WS = New-Object -ComObject WScript.Shell
$Desktop = [Environment]::GetFolderPath("Desktop")
$ShortcutPath = Join-Path $Desktop "ARCHON V3.lnk"

$Shortcut = $WS.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "E:\Quartier Général\archon-v3\OUVRIR_ARCHON.bat"
$Shortcut.Arguments = ""
$Shortcut.WorkingDirectory = "E:\Quartier Général\archon-v3"
$Shortcut.IconLocation = "C:\Windows\System32\imageres.dll,76"
$Shortcut.Description = "Lancer ARCHON V3 - Assistant IA Local"
$Shortcut.Save()

Write-Host "Raccourci cree sur le bureau: $ShortcutPath" -ForegroundColor Green
