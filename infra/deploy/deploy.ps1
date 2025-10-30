#!/usr/bin/env pwsh
<#!
Placeholder deployment script for Freaky Flyer Delivery.
Requires WinSCP installed and configured for scripted uploads.
Update the credential variables before enabling.
The script exits immediately to prevent accidental uploads.
!>

Write-Host "Deployment script is disabled. Configure WinSCP settings before use."
exit 0

<#
Example WinSCP command:
$sessionOptions = New-Object WinSCP.SessionOptions -Property @{ 
    Protocol = [WinSCP.Protocol]::Sftp
    HostName = "example.tppwholesale.com"
    UserName = "USERNAME"
    Password = "PASSWORD"
}
$session = New-Object WinSCP.Session
$session.Open($sessionOptions)
$session.PutFiles("./dist/*", "/public_html/staging/", $True).Check()
$session.Dispose()
#>
