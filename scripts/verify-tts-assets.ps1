[CmdletBinding(SupportsShouldProcess = $true, ConfirmImpact = 'Medium')]
param(
    [Parameter(Mandatory)][ValidateSet('jaitts', 'vachaspeech')][string]$Provider,
    [string]$ProviderRoot,
    [switch]$WriteReceipt,
    [switch]$ConfirmExplicitSetup
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'tts-v2\common.ps1')

if (-not $ProviderRoot) {
    $ProviderRoot = Join-Path $PSScriptRoot "..\.local\tts-v2\$Provider"
}
$providerRootFull = Assert-TtsProviderRoot -Provider $Provider -ProviderRoot $ProviderRoot
$context = Get-TtsManifestContext -Provider $Provider
Assert-TtsManifestReady -Context $context

$python = Join-Path $providerRootFull 'venv\Scripts\python.exe'
$receiptRoot = Join-Path $providerRootFull 'receipts'
$modelRoot = Join-Path $providerRootFull 'models'
Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $providerRootFull `
    -LeafType Directory -MustExist | Out-Null
Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $python `
    -LeafType File -MustExist | Out-Null
Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $modelRoot `
    -LeafType Directory -MustExist | Out-Null
$pythonVersion = Get-TtsPythonVersion -Python $python
if ($pythonVersion -ne [string]$context.Manifest.python.version) {
    throw 'The isolated provider interpreter version is invalid.'
}

$verifiedArtifacts = @()
foreach ($artifact in $context.Manifest.artifacts) {
    $candidate = Test-TtsContainedPath -Root $modelRoot -RelativePath ([string]$artifact.relativePath)
    Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $candidate `
        -LeafType File -MustExist | Out-Null
    $item = Get-Item -LiteralPath $candidate
    if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or
        $item.Length -ne [long]$artifact.sizeBytes) {
        throw 'A local TTS artifact failed verification.'
    }
    Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $candidate `
        -LeafType File -MustExist | Out-Null
    $hash = (Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($hash -ne [string]$artifact.sha256) {
        throw 'A local TTS artifact failed verification.'
    }
    $verifiedArtifacts += [ordered]@{
        relativePath = [string]$artifact.relativePath
        sizeBytes = [long]$artifact.sizeBytes
        sha256 = [string]$artifact.sha256
    }
}

Assert-TtsPrivateReference | Out-Null

if ($WriteReceipt.IsPresent) {
    if (-not $ConfirmExplicitSetup.IsPresent) {
        throw 'Writing a verification receipt requires explicit confirmation.'
    }
    if ($PSCmdlet.ShouldProcess('sanitized provider install receipt', 'write verified metadata')) {
        Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $providerRootFull `
            -LeafType Directory -MustExist | Out-Null
        Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $receiptRoot `
            -LeafType Directory | Out-Null
        Write-TtsInstallReceipt -Context $context -ProviderRoot $providerRootFull `
            -Artifacts $verifiedArtifacts -PythonVersion $pythonVersion
    }
}

[pscustomobject]@{
    Provider = [string]$context.Manifest.provider.id
    Valid = $true
    ArtifactCount = $verifiedArtifacts.Count
    PythonVersion = $pythonVersion
    ReceiptWritten = $WriteReceipt.IsPresent
}
