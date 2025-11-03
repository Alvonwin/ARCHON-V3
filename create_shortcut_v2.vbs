Set oWS = WScript.CreateObject("WScript.Shell")
sLinkFile = oWS.SpecialFolders("Desktop") & "\ARCHON V3.lnk"
Set oLink = oWS.CreateShortcut(sLinkFile)
oLink.TargetPath = "E:\Quartier Général\archon-v3\START_ARCHON.bat"
oLink.Arguments = ""
oLink.WorkingDirectory = "E:\Quartier Général\archon-v3"
oLink.IconLocation = "C:\Windows\System32\imageres.dll,76"
oLink.Description = "Lancer ARCHON V3 - Assistant IA Local"
oLink.Save

WScript.Echo "Raccourci cree sur le bureau: " & sLinkFile
