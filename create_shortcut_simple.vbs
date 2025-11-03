Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = oWS.SpecialFolders("Desktop") & "\ARCHON V3.lnk"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "C:\Users\niwno\Desktop\ARCHON_LAUNCHER.bat"
oLink.Arguments = ""
oLink.WorkingDirectory = "C:\Users\niwno\Desktop"
oLink.IconLocation = "C:\Windows\System32\imageres.dll,76"
oLink.Description = "Lancer ARCHON V3 - Assistant IA Local"
oLink.Save

WScript.Echo "Raccourci cree: " & sLinkFile
