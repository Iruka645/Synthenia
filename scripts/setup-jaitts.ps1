[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [Parameter(Mandatory)][switch]$ConfirmExplicitSetup,
    [string]$ProviderRoot = (Join-Path $PSScriptRoot '..\.local\tts-v2\jaitts')
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'tts-v2\common.ps1')

$target = Assert-TtsProviderRoot -Provider 'jaitts' -ProviderRoot $ProviderRoot
if ($PSCmdlet.ShouldProcess('isolated local JaiTTS provider', 'download and install pinned artifacts')) {
    Invoke-TtsProviderSetup -Provider 'jaitts' -ProviderRoot $target `
        -ConfirmExplicitSetup:$ConfirmExplicitSetup
}
