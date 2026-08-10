[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'High')]
param(
    [Parameter(Mandatory)][switch]$ConfirmExplicitSetup,
    [string]$ProviderRoot = (Join-Path $PSScriptRoot '..\.local\tts-v2\vachaspeech')
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'tts-v2\common.ps1')

$target = Assert-TtsProviderRoot -Provider 'vachaspeech' -ProviderRoot $ProviderRoot
if ($PSCmdlet.ShouldProcess('isolated local VachaSpeech provider', 'download and install pinned artifacts')) {
    Invoke-TtsProviderSetup -Provider 'vachaspeech' -ProviderRoot $target `
        -ConfirmExplicitSetup:$ConfirmExplicitSetup
}
