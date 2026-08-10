Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$script:TtsRepositoryRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$script:TtsLocalRoot = [IO.Path]::GetFullPath((Join-Path $script:TtsRepositoryRoot '.local\tts-v2'))
$script:TtsPython = Join-Path $script:TtsRepositoryRoot 'backend\tts-engine\venv\Scripts\python.exe'

function Assert-TtsPhysicalPath {
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$Target,
        [ValidateSet('Any', 'File', 'Directory')][string]$LeafType = 'Any',
        [switch]$MustExist,
        [switch]$MustNotExist
    )
    if ($MustExist.IsPresent -and $MustNotExist.IsPresent) {
        throw 'A TTS path cannot require both existence and absence.'
    }
    $separator = [IO.Path]::DirectorySeparatorChar
    $rootFull = [IO.Path]::GetFullPath($Root).TrimEnd($separator)
    $targetFull = [IO.Path]::GetFullPath($Target).TrimEnd($separator)
    $insideRoot = [StringComparer]::OrdinalIgnoreCase.Equals($rootFull, $targetFull) -or
        $targetFull.StartsWith($rootFull + $separator, [StringComparison]::OrdinalIgnoreCase)
    if (-not $insideRoot) {
        throw 'TTS path escaped its trusted physical root.'
    }

    $rootItem = Get-Item -LiteralPath $rootFull -Force
    if (-not $rootItem.PSIsContainer -or
        ($rootItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw 'The trusted TTS root is not a physical directory.'
    }
    if ([StringComparer]::OrdinalIgnoreCase.Equals($rootFull, $targetFull)) {
        if ($MustNotExist.IsPresent) { throw 'The TTS destination already exists.' }
        if ($LeafType -eq 'File') { throw 'The TTS path type is invalid.' }
        return $targetFull
    }

    $relative = $targetFull.Substring($rootFull.Length).TrimStart($separator)
    $segments = $relative.Split($separator, [StringSplitOptions]::RemoveEmptyEntries)
    $current = $rootFull
    for ($index = 0; $index -lt $segments.Count; $index++) {
        $current = Join-Path $current $segments[$index]
        $isLeaf = $index -eq ($segments.Count - 1)
        if (-not (Test-Path -LiteralPath $current)) {
            if ($MustExist.IsPresent) {
                throw 'A required physical TTS path is missing.'
            }
            continue
        }
        if ($isLeaf -and $MustNotExist.IsPresent) {
            throw 'The TTS destination already exists.'
        }
        $item = Get-Item -LiteralPath $current -Force
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {
            throw 'TTS paths may not contain junctions, symbolic links, or reparse points.'
        }
        if (-not $isLeaf -and -not $item.PSIsContainer) {
            throw 'A TTS path ancestor is not a directory.'
        }
        if ($isLeaf -and $LeafType -eq 'Directory' -and -not $item.PSIsContainer) {
            throw 'The TTS path type is invalid.'
        }
        if ($isLeaf -and $LeafType -eq 'File' -and $item.PSIsContainer) {
            throw 'The TTS path type is invalid.'
        }
    }
    return $targetFull
}

function New-TtsPhysicalDirectory {
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$Target
    )
    $rootFull = Assert-TtsPhysicalPath -Root $Root -Target $Root -LeafType Directory -MustExist
    $targetFull = Assert-TtsPhysicalPath -Root $rootFull -Target $Target -LeafType Directory
    if ([StringComparer]::OrdinalIgnoreCase.Equals($rootFull, $targetFull)) {
        return $targetFull
    }
    $separator = [IO.Path]::DirectorySeparatorChar
    $segments = $targetFull.Substring($rootFull.Length).TrimStart($separator).Split(
        $separator,
        [StringSplitOptions]::RemoveEmptyEntries
    )
    $current = $rootFull
    foreach ($segment in $segments) {
        $parent = Assert-TtsPhysicalPath -Root $rootFull -Target $current -LeafType Directory -MustExist
        $current = Join-Path $parent $segment
        if (-not (Test-Path -LiteralPath $current)) {
            [IO.Directory]::CreateDirectory($current) | Out-Null
        }
        Assert-TtsPhysicalPath -Root $rootFull -Target $current -LeafType Directory -MustExist | Out-Null
    }
    return $targetFull
}

function Move-TtsPhysicalDirectoryExclusive {
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination
    )
    $sourceFull = Assert-TtsPhysicalPath -Root $Root -Target $Source `
        -LeafType Directory -MustExist
    $destinationParent = Assert-TtsPhysicalPath -Root $Root `
        -Target (Split-Path ([IO.Path]::GetFullPath($Destination)) -Parent) `
        -LeafType Directory -MustExist
    $destinationFull = Assert-TtsPhysicalPath -Root $Root -Target $Destination `
        -LeafType Directory -MustNotExist
    Assert-TtsPhysicalPath -Root $Root -Target $sourceFull `
        -LeafType Directory -MustExist | Out-Null
    Assert-TtsPhysicalPath -Root $Root -Target $destinationParent `
        -LeafType Directory -MustExist | Out-Null
    Assert-TtsPhysicalPath -Root $Root -Target $destinationFull `
        -LeafType Directory -MustNotExist | Out-Null
    [IO.Directory]::Move($sourceFull, $destinationFull)
    Assert-TtsPhysicalPath -Root $Root -Target $destinationFull `
        -LeafType Directory -MustExist | Out-Null
    return $destinationFull
}

function Move-TtsPhysicalFileExclusive {
    param(
        [Parameter(Mandatory)][string]$Root,
        [Parameter(Mandatory)][string]$Source,
        [Parameter(Mandatory)][string]$Destination
    )
    $sourceFull = Assert-TtsPhysicalPath -Root $Root -Target $Source `
        -LeafType File -MustExist
    $destinationParent = Assert-TtsPhysicalPath -Root $Root `
        -Target (Split-Path ([IO.Path]::GetFullPath($Destination)) -Parent) `
        -LeafType Directory -MustExist
    $destinationFull = Assert-TtsPhysicalPath -Root $Root -Target $Destination `
        -LeafType File -MustNotExist
    Assert-TtsPhysicalPath -Root $Root -Target $sourceFull `
        -LeafType File -MustExist | Out-Null
    Assert-TtsPhysicalPath -Root $Root -Target $destinationParent `
        -LeafType Directory -MustExist | Out-Null
    Assert-TtsPhysicalPath -Root $Root -Target $destinationFull `
        -LeafType File -MustNotExist | Out-Null
    [IO.File]::Move($sourceFull, $destinationFull)
    Assert-TtsPhysicalPath -Root $Root -Target $destinationFull `
        -LeafType File -MustExist | Out-Null
    return $destinationFull
}

function Get-TtsProviderDirectory {
    param([Parameter(Mandatory)][ValidateSet('jaitts', 'vachaspeech')][string]$Provider)
    return $Provider
}

function Get-TtsManifestContext {
    param([Parameter(Mandatory)][ValidateSet('jaitts', 'vachaspeech')][string]$Provider)
    $providerDirectory = Get-TtsProviderDirectory -Provider $Provider
    $sidecarRoot = Join-Path $script:TtsRepositoryRoot "backend\tts-sidecars\$providerDirectory"
    $manifestPath = Join-Path $sidecarRoot 'manifest.json'
    $lockPath = Join-Path $sidecarRoot 'requirements.lock'
    Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $sidecarRoot `
        -LeafType Directory -MustExist | Out-Null
    Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $manifestPath `
        -LeafType File -MustExist | Out-Null
    Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $lockPath `
        -LeafType File -MustExist | Out-Null
    Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $manifestPath `
        -LeafType File -MustExist | Out-Null
    $manifestRaw = [IO.File]::ReadAllBytes($manifestPath)
    if ($manifestRaw.Length -le 0 -or $manifestRaw.Length -gt 1MB) {
        throw 'TTS manifest metadata is invalid.'
    }
    $manifest = [Text.Encoding]::UTF8.GetString($manifestRaw) | ConvertFrom-Json
    Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $manifestPath `
        -LeafType File -MustExist | Out-Null
    $manifestSha256 = (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
    Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $lockPath `
        -LeafType File -MustExist | Out-Null
    $lockSha256 = (Get-FileHash -LiteralPath $lockPath -Algorithm SHA256).Hash.ToLowerInvariant()
    return [pscustomobject]@{
        Provider = $Provider
        SidecarRoot = $sidecarRoot
        ManifestPath = $manifestPath
        Manifest = $manifest
        ManifestSha256 = $manifestSha256
        LockPath = $lockPath
        LockSha256 = $lockSha256
    }
}

function Assert-TtsProviderRoot {
    param(
        [Parameter(Mandatory)][ValidateSet('jaitts', 'vachaspeech')][string]$Provider,
        [Parameter(Mandatory)][string]$ProviderRoot
    )
    $expected = [IO.Path]::GetFullPath((Join-Path $script:TtsLocalRoot $Provider))
    $candidate = [IO.Path]::GetFullPath($ProviderRoot)
    if (-not [StringComparer]::OrdinalIgnoreCase.Equals($expected, $candidate)) {
        throw 'ProviderRoot must be the provider-specific .local/tts-v2 directory.'
    }
    Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $candidate -LeafType Directory | Out-Null
    return $candidate
}

function Assert-TtsManifestReady {
    param([Parameter(Mandatory)]$Context)
    $manifest = $Context.Manifest
    if ($manifest.schemaVersion -ne 1 -or
        $manifest.provider.id -notin @('jaitts-f5tts', 'vachaspeech-0.6b') -or
        $manifest.security.trustRemoteCode -ne $false -or
        $manifest.security.runtimeNetwork -ne $false -or
        $manifest.gates.pinsVerified -ne $true -or
        $manifest.gates.licensesResolved -ne $true -or
        $manifest.gates.checksumsComplete -ne $true -or
        $manifest.gates.enablementAllowed -ne $true) {
        throw 'Provider provenance gates are not complete; explicit setup is blocked.'
    }
    if ($manifest.dependencies.lockFile -ne 'requirements.lock' -or
        $manifest.dependencies.sha256 -ne $Context.LockSha256) {
        throw 'Dependency lock provenance is invalid.'
    }
    $serialized = $manifest | ConvertTo-Json -Depth 20 -Compress
    if ($serialized -match 'UNRESOLVED' -or $serialized -match '/main(?:/|"|\?)') {
        throw 'Provider metadata contains an unresolved or floating source.'
    }
    if (-not $manifest.artifacts -or $manifest.artifacts.Count -le 0) {
        throw 'Provider artifact list is empty.'
    }
    foreach ($artifact in $manifest.artifacts) {
        if ($artifact.sizeBytes -le 0 -or $artifact.sha256 -notmatch '^[a-f0-9]{64}$' -or
            $artifact.downloadUrl -notmatch '^https://' -or
            $artifact.relativePath -match '(^|[\\/])\.\.([\\/]|$)' -or
            [IO.Path]::IsPathRooted([string]$artifact.relativePath)) {
            throw 'Provider artifact provenance is incomplete.'
        }
    }
}

function Test-TtsContainedPath {
    param([Parameter(Mandatory)][string]$Root, [Parameter(Mandatory)][string]$RelativePath)
    if ([IO.Path]::IsPathRooted($RelativePath) -or $RelativePath -match '(^|[\\/])\.\.([\\/]|$)') {
        throw 'Artifact path is invalid.'
    }
    $rootFull = Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $Root `
        -LeafType Directory -MustExist
    $candidate = [IO.Path]::GetFullPath((Join-Path $rootFull $RelativePath))
    $separator = [IO.Path]::DirectorySeparatorChar
    if (-not $candidate.StartsWith($rootFull + $separator, [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Artifact path escaped its provider root.'
    }
    Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $candidate | Out-Null
    return $candidate
}

function Get-TtsPythonVersion {
    param([Parameter(Mandatory)][string]$Python)
    Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $Python `
        -LeafType File -MustExist | Out-Null
    $version = & $Python -c 'import platform; print(platform.python_version())'
    if ($LASTEXITCODE -ne 0 -or $version.Count -ne 1) {
        throw 'Unable to verify the isolated Python interpreter.'
    }
    return [string]$version
}

function Assert-TtsPrivateReference {
    $referenceRoot = [IO.Path]::GetFullPath((Join-Path $script:TtsLocalRoot 'reference'))
    $referenceConfig = Join-Path $referenceRoot 'reference.json'
    Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $referenceRoot `
        -LeafType Directory -MustExist | Out-Null
    Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $referenceConfig `
        -LeafType File -MustExist | Out-Null
    $reference = Get-Content -LiteralPath $referenceConfig -Raw | ConvertFrom-Json
    if ($reference.schemaVersion -ne 1 -or $reference.consent.ownedOrLicensed -ne $true -or
        $reference.consent.purpose -ne 'local-noncommercial-evaluation') {
        throw 'The private reference consent gate is incomplete.'
    }
    foreach ($relative in @([string]$reference.wav, [string]$reference.transcriptFile)) {
        if (-not $relative) { throw 'The private reference configuration is invalid.' }
        $referenceFile = Test-TtsContainedPath -Root $referenceRoot -RelativePath $relative
        Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $referenceFile `
            -LeafType File -MustExist | Out-Null
        $item = Get-Item -LiteralPath $referenceFile
        if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0 -or $item.PSIsContainer) {
            throw 'The private reference configuration is invalid.'
        }
    }
    return $true
}

function Write-TtsInstallReceipt {
    param(
        [Parameter(Mandatory)]$Context,
        [Parameter(Mandatory)][string]$ProviderRoot,
        [Parameter(Mandatory)][array]$Artifacts,
        [Parameter(Mandatory)][string]$PythonVersion
    )
    Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $ProviderRoot `
        -LeafType Directory -MustExist | Out-Null
    $receiptRoot = Join-Path $ProviderRoot 'receipts'
    New-TtsPhysicalDirectory -Root $script:TtsRepositoryRoot -Target $receiptRoot | Out-Null
    $receiptPath = Join-Path $receiptRoot 'install-state.json'
    $temporary = Join-Path $receiptRoot ('.install-state.' + [guid]::NewGuid().ToString('N') + '.tmp')
    $receipt = [ordered]@{
        schemaVersion = 1
        providerId = [string]$Context.Manifest.provider.id
        manifestSha256 = $Context.ManifestSha256
        lockSha256 = $Context.LockSha256
        pythonVersion = $PythonVersion
        verifiedAt = [DateTime]::UtcNow.ToString('o')
        artifacts = $Artifacts
    }
    try {
        Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $temporary | Out-Null
        $json = $receipt | ConvertTo-Json -Depth 10
        $utf8NoBom = New-Object Text.UTF8Encoding($false)
        [IO.File]::WriteAllText($temporary, $json, $utf8NoBom)
        Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $temporary `
            -LeafType File -MustExist | Out-Null
        if (Test-Path -LiteralPath $receiptPath) {
            Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $receiptPath `
                -LeafType File -MustExist | Out-Null
            [IO.File]::Replace($temporary, $receiptPath, $null)
        } else {
            Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $receiptPath | Out-Null
            [IO.File]::Move($temporary, $receiptPath)
        }
        Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $receiptPath `
            -LeafType File -MustExist | Out-Null
    } finally {
        if (Test-Path -LiteralPath $temporary) {
            Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $temporary `
                -LeafType File -MustExist | Out-Null
            Remove-Item -LiteralPath $temporary -Force
        }
    }
}

function Invoke-TtsProviderSetup {
    param(
        [Parameter(Mandatory)][ValidateSet('jaitts', 'vachaspeech')][string]$Provider,
        [Parameter(Mandatory)][string]$ProviderRoot,
        [Parameter(Mandatory)][switch]$ConfirmExplicitSetup
    )
    if (-not $ConfirmExplicitSetup.IsPresent) {
        throw 'Explicit setup confirmation is required.'
    }
    $providerRootFull = Assert-TtsProviderRoot -Provider $Provider -ProviderRoot $ProviderRoot
    $context = Get-TtsManifestContext -Provider $Provider
    Assert-TtsManifestReady -Context $context
    $expectedProviderId = if ($Provider -eq 'jaitts') { 'jaitts-f5tts' } else { 'vachaspeech-0.6b' }
    if ($context.Manifest.provider.id -ne $expectedProviderId) {
        throw 'The provider manifest does not match the requested isolated root.'
    }
    Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $script:TtsPython `
        -LeafType File -MustExist | Out-Null
    if ((Get-TtsPythonVersion -Python $script:TtsPython) -ne [string]$context.Manifest.python.version) {
        throw 'The reviewed Python version does not match the manifest.'
    }
    Assert-TtsPrivateReference | Out-Null
    Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $providerRootFull `
        -LeafType Directory -MustNotExist | Out-Null
    $drive = Get-PSDrive -Name ([IO.Path]::GetPathRoot($script:TtsLocalRoot).TrimEnd('\').TrimEnd(':'))
    if ($drive.Free -lt 15GB) {
        throw 'At least 15 GiB free space is required before isolated setup.'
    }

    New-TtsPhysicalDirectory -Root $script:TtsRepositoryRoot -Target $script:TtsLocalRoot | Out-Null
    $stage = Join-Path $script:TtsLocalRoot ('.setup-' + $Provider + '-' + [guid]::NewGuid().ToString('N'))
    $stageFull = [IO.Path]::GetFullPath($stage)
    if (-not $stageFull.StartsWith($script:TtsLocalRoot.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)) {
        throw 'Setup staging path escaped the local TTS root.'
    }
    try {
        New-TtsPhysicalDirectory -Root $script:TtsRepositoryRoot -Target $stageFull | Out-Null
        foreach ($name in @('cache', 'models', 'source', 'receipts', 'tmp')) {
            New-TtsPhysicalDirectory -Root $script:TtsRepositoryRoot `
                -Target (Join-Path $stageFull $name) | Out-Null
        }
        Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $stageFull `
            -LeafType Directory -MustExist | Out-Null
        Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $script:TtsPython `
            -LeafType File -MustExist | Out-Null
        $venvRoot = Join-Path $stageFull 'venv'
        New-TtsPhysicalDirectory -Root $script:TtsRepositoryRoot -Target $venvRoot | Out-Null
        & $script:TtsPython -m venv $venvRoot
        if ($LASTEXITCODE -ne 0) { throw 'Unable to create the isolated provider environment.' }
        $isolatedPython = Join-Path $stageFull 'venv\Scripts\python.exe'
        Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $isolatedPython `
            -LeafType File -MustExist | Out-Null
        Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $context.LockPath `
            -LeafType File -MustExist | Out-Null
        & $isolatedPython -m pip --isolated --disable-pip-version-check --no-input `
            --no-cache-dir install --require-hashes -r $context.LockPath
        if ($LASTEXITCODE -ne 0) { throw 'Hash-locked dependency installation failed.' }

        $verifiedArtifacts = @()
        foreach ($artifact in $context.Manifest.artifacts) {
            $download = Join-Path $stageFull ('tmp\' + [guid]::NewGuid().ToString('N') + '.download')
            Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $download | Out-Null
            Invoke-WebRequest -Uri ([string]$artifact.downloadUrl) -OutFile $download -UseBasicParsing
            Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $download `
                -LeafType File -MustExist | Out-Null
            $downloadInfo = Get-Item -LiteralPath $download
            Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $download `
                -LeafType File -MustExist | Out-Null
            $downloadHash = (Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash.ToLowerInvariant()
            if ($downloadInfo.Length -ne [long]$artifact.sizeBytes -or $downloadHash -ne [string]$artifact.sha256) {
                throw 'Downloaded artifact verification failed.'
            }
            $destination = Test-TtsContainedPath -Root (Join-Path $stageFull 'models') -RelativePath ([string]$artifact.relativePath)
            New-TtsPhysicalDirectory -Root $script:TtsRepositoryRoot `
                -Target (Split-Path $destination -Parent) | Out-Null
            Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $download `
                -LeafType File -MustExist | Out-Null
            Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $destination | Out-Null
            Move-TtsPhysicalFileExclusive -Root $script:TtsRepositoryRoot `
                -Source $download -Destination $destination | Out-Null
            Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $destination `
                -LeafType File -MustExist | Out-Null
            $verifiedArtifacts += [ordered]@{
                relativePath = [string]$artifact.relativePath
                sizeBytes = [long]$artifact.sizeBytes
                sha256 = [string]$artifact.sha256
            }
        }
        $isolatedVersion = Get-TtsPythonVersion -Python $isolatedPython
        if ($isolatedVersion -ne [string]$context.Manifest.python.version) {
            throw 'The isolated Python version does not match the manifest.'
        }
        Write-TtsInstallReceipt -Context $context -ProviderRoot $stageFull `
            -Artifacts $verifiedArtifacts -PythonVersion $isolatedVersion
        Move-TtsPhysicalDirectoryExclusive -Root $script:TtsRepositoryRoot `
            -Source $stageFull -Destination $providerRootFull | Out-Null
    } catch {
        if (Test-Path -LiteralPath $stageFull) {
            $resolvedStage = [IO.Path]::GetFullPath($stageFull)
            if ($resolvedStage.StartsWith($script:TtsLocalRoot.TrimEnd('\') + '\.setup-', [StringComparison]::OrdinalIgnoreCase)) {
                Assert-TtsPhysicalPath -Root $script:TtsRepositoryRoot -Target $resolvedStage `
                    -LeafType Directory -MustExist | Out-Null
                Remove-Item -LiteralPath $resolvedStage -Recurse -Force
            }
        }
        throw
    }
}
