[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\common.ps1')

$temporaryBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\')
$testRoot = Join-Path $temporaryBase ('synthenia-tts-containment-' + [guid]::NewGuid().ToString('N'))
if (-not $testRoot.StartsWith($temporaryBase + '\synthenia-tts-containment-', [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Disposable test root is invalid.'
}
[IO.Directory]::CreateDirectory($testRoot) | Out-Null
$passed = 0

function Assert-ThrowsBeforeSideEffect {
    param(
        [Parameter(Mandatory)][string]$Repository,
        [Parameter(Mandatory)][string]$Probe
    )
    $sideEffectReached = $false
    try {
        Assert-TtsPhysicalPath -Root $Repository -Target $Probe | Out-Null
        $sideEffectReached = $true
    } catch {
        if ($_.Exception.Message -notmatch 'junctions|reparse') {
            throw
        }
    }
    if ($sideEffectReached) {
        throw 'Physical admission allowed a reparse ancestor before a side effect.'
    }
    $script:passed++
}

$cases = @(
    @{ Junction = '.local'; Probe = '.local\tts-v2\jaitts\models\probe-dir' },
    @{ Junction = '.local\tts-v2'; Probe = '.local\tts-v2\jaitts\models\probe-dir' },
    @{ Junction = '.local\tts-v2\jaitts'; Probe = '.local\tts-v2\jaitts\models\probe-dir' },
    @{ Junction = '.local\tts-v2\reference'; Probe = '.local\tts-v2\reference\voice.wav' },
    @{ Junction = '.local\tts-v2\jaitts\models'; Probe = '.local\tts-v2\jaitts\models\model.bin' },
    @{ Junction = '.local\tts-v2\jaitts\receipts'; Probe = '.local\tts-v2\jaitts\receipts\install-state.json' }
)

try {
    foreach ($case in $cases) {
        $caseRoot = Join-Path $testRoot ([guid]::NewGuid().ToString('N'))
        $repository = Join-Path $caseRoot 'repo'
        $outside = Join-Path $caseRoot 'outside'
        [IO.Directory]::CreateDirectory($repository) | Out-Null
        [IO.Directory]::CreateDirectory($outside) | Out-Null
        [IO.File]::WriteAllText((Join-Path $outside 'marker.txt'), 'unchanged')
        $junction = Join-Path $repository $case.Junction
        [IO.Directory]::CreateDirectory((Split-Path $junction -Parent)) | Out-Null
        New-Item -ItemType Junction -Path $junction -Target $outside | Out-Null
        try {
            $probe = Join-Path $repository $case.Probe
            Assert-ThrowsBeforeSideEffect -Repository $repository -Probe $probe
            $creationRejected = $false
            try {
                New-TtsPhysicalDirectory -Root $repository -Target $probe | Out-Null
            } catch {
                if ($_.Exception.Message -match 'junctions|reparse') {
                    $creationRejected = $true
                } else {
                    throw
                }
            }
            if (-not $creationRejected -or (Test-Path -LiteralPath (Join-Path $outside 'probe-dir'))) {
                throw 'Physical directory creation followed a reparse ancestor.'
            }
            $passed++
            if ((Get-Content -LiteralPath (Join-Path $outside 'marker.txt') -Raw) -ne 'unchanged') {
                throw 'A junction target was modified.'
            }
        } finally {
            $junctionItem = Get-Item -LiteralPath $junction -Force -ErrorAction SilentlyContinue
            if ($null -ne $junctionItem) {
                if (($junctionItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -eq 0) {
                    throw 'Disposable junction identity changed; cleanup refused.'
                }
                [IO.Directory]::Delete([IO.Path]::GetFullPath($junction), $false)
            }
            $caseFull = [IO.Path]::GetFullPath($caseRoot)
            if (-not $caseFull.StartsWith($testRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
                throw 'Disposable case cleanup escaped its test root.'
            }
            Remove-Item -LiteralPath $caseFull -Recurse -Force
        }
    }

    $safeRepository = Join-Path $testRoot 'safe-repo'
    [IO.Directory]::CreateDirectory($safeRepository) | Out-Null
    $safeTarget = Join-Path $safeRepository '.local\tts-v2\jaitts\models'
    New-TtsPhysicalDirectory -Root $safeRepository -Target $safeTarget | Out-Null
    Assert-TtsPhysicalPath -Root $safeRepository -Target $safeTarget `
        -LeafType Directory -MustExist | Out-Null
    $passed++

    $collisionRepository = Join-Path $testRoot 'collision-repo'
    [IO.Directory]::CreateDirectory($collisionRepository) | Out-Null
    $collisionLocal = Join-Path $collisionRepository '.local\tts-v2'
    New-TtsPhysicalDirectory -Root $collisionRepository -Target $collisionLocal | Out-Null
    $collisionStage = Join-Path $collisionLocal '.setup-jaitts-00000000000000000000000000000000'
    New-TtsPhysicalDirectory -Root $collisionRepository -Target $collisionStage | Out-Null
    [IO.File]::WriteAllText((Join-Path $collisionStage 'stage-marker.txt'), 'stage')
    $collisionDestination = Join-Path $collisionLocal 'jaitts'
    Assert-TtsPhysicalPath -Root $collisionRepository -Target $collisionDestination `
        -LeafType Directory -MustNotExist | Out-Null

    # Simulate a second setup winning promotion after the first absence check.
    New-TtsPhysicalDirectory -Root $collisionRepository -Target $collisionDestination | Out-Null
    [IO.File]::WriteAllText((Join-Path $collisionDestination 'existing-marker.txt'), 'existing')
    $collisionRejected = $false
    try {
        Move-TtsPhysicalDirectoryExclusive -Root $collisionRepository `
            -Source $collisionStage -Destination $collisionDestination | Out-Null
    } catch {
        if ($_.Exception.Message -match 'already exists') {
            $collisionRejected = $true
        } else {
            throw
        }
    }
    if (-not $collisionRejected) {
        throw 'Exclusive promotion reported success for a late-created destination.'
    }
    if ((Get-Content -LiteralPath (Join-Path $collisionDestination 'existing-marker.txt') -Raw) -ne 'existing') {
        throw 'Promotion collision modified the existing provider root.'
    }
    if (-not (Test-Path -LiteralPath $collisionStage -PathType Container) -or
        (Test-Path -LiteralPath (Join-Path $collisionDestination (Split-Path $collisionStage -Leaf)))) {
        throw 'Promotion collision nested or lost the verified stage.'
    }
    Assert-TtsPhysicalPath -Root $collisionRepository -Target $collisionStage `
        -LeafType Directory -MustExist | Out-Null
    Remove-Item -LiteralPath $collisionStage -Recurse -Force
    if ((Get-Content -LiteralPath (Join-Path $collisionDestination 'existing-marker.txt') -Raw) -ne 'existing') {
        throw 'Stage cleanup modified the existing provider root.'
    }
    $passed++
} finally {
    if (Test-Path -LiteralPath $testRoot) {
        $remainingReparse = @(Get-ChildItem -LiteralPath $testRoot -Force -Recurse |
            Where-Object { ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 })
        foreach ($link in $remainingReparse) {
            $linkFull = [IO.Path]::GetFullPath($link.FullName)
            if (-not $linkFull.StartsWith($testRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
                throw 'Disposable reparse cleanup escaped its test root.'
            }
            [IO.Directory]::Delete($linkFull, $false)
        }
        $testFull = [IO.Path]::GetFullPath($testRoot)
        if (-not $testFull.StartsWith($temporaryBase + '\synthenia-tts-containment-', [StringComparison]::OrdinalIgnoreCase)) {
            throw 'Disposable test cleanup escaped the temp root.'
        }
        Remove-Item -LiteralPath $testFull -Recurse -Force
    }
}

if ($passed -ne 14) {
    throw "Expected 14 containment assertions; observed $passed."
}
Write-Output "powershell-containment:$passed"
