$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
Set-Location "d:\Gather\Project_Code"
& "C:\Program Files\nodejs\npx.cmd" expo start --port 8082
