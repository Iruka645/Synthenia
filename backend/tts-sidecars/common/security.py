"""Fail-closed manifest, receipt, path, artifact, and private-reference checks."""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import sys
from pathlib import Path, PurePosixPath
from typing import Any

from common.protocol import SidecarError
from common.wav import inspect_pcm_wave

MAX_JSON_BYTES = 1024 * 1024
_SHA256 = re.compile(r"^[0-9a-f]{64}$")
_OUTPUT_NAME = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,174}\.wav$")
_OFFLINE_AUDIT_INSTALLED = False


def enforce_offline_runtime() -> None:
    """Deny sockets and child processes even if an upstream library ignores offline flags."""
    global _OFFLINE_AUDIT_INSTALLED
    if _OFFLINE_AUDIT_INSTALLED:
        return

    def deny_external_side_effects(event: str, _args: tuple[Any, ...]) -> None:
        if event.startswith("socket.") or event in {"subprocess.Popen", "os.system", "os.posix_spawn"}:
            raise PermissionError("offline TTS runtime")

    sys.addaudithook(deny_external_side_effects)
    _OFFLINE_AUDIT_INSTALLED = True


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as source:
        while True:
            block = source.read(1024 * 1024)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


def load_json(path: Path) -> dict[str, Any]:
    file_path = Path(path)
    info = os.lstat(file_path)
    if not stat.S_ISREG(info.st_mode) or info.st_size <= 0 or info.st_size > MAX_JSON_BYTES:
        raise SidecarError("TTS_INSTALL_INVALID")
    try:
        value = json.loads(file_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError):
        raise SidecarError("TTS_INSTALL_INVALID") from None
    if not isinstance(value, dict):
        raise SidecarError("TTS_INSTALL_INVALID")
    return value


def contained_file(root: Path, relative_path: str) -> Path:
    if not isinstance(relative_path, str) or "\\" in relative_path:
        raise SidecarError("TTS_INSTALL_INVALID")
    pure = PurePosixPath(relative_path)
    if pure.is_absolute() or not pure.parts or any(part in {"", ".", ".."} for part in pure.parts):
        raise SidecarError("TTS_INSTALL_INVALID")
    root_real = Path(root).resolve(strict=True)
    candidate = (root_real / Path(*pure.parts)).resolve(strict=True)
    try:
        candidate.relative_to(root_real)
    except ValueError:
        raise SidecarError("TTS_INSTALL_INVALID") from None
    info = os.lstat(candidate)
    if not stat.S_ISREG(info.st_mode):
        raise SidecarError("TTS_INSTALL_INVALID")
    return candidate


def output_path(audio_root: Path, output_name: str) -> Path:
    if not isinstance(output_name, str) or not _OUTPUT_NAME.fullmatch(output_name):
        raise SidecarError("TTS_INVALID_OUTPUT")
    root = Path(audio_root).resolve(strict=True)
    root_info = os.lstat(root)
    if not stat.S_ISDIR(root_info.st_mode):
        raise SidecarError("TTS_INVALID_OUTPUT")
    candidate = root / output_name
    if candidate.exists() or candidate.is_symlink():
        raise SidecarError("TTS_INVALID_OUTPUT")
    try:
        candidate.resolve(strict=False).relative_to(root)
    except ValueError:
        raise SidecarError("TTS_INVALID_OUTPUT") from None
    return candidate


def _valid_manifest(manifest: dict[str, Any], provider_id: str) -> bool:
    provider = manifest.get("provider")
    dependencies = manifest.get("dependencies")
    security = manifest.get("security")
    gates = manifest.get("gates")
    return (
        manifest.get("schemaVersion") == 1
        and isinstance(provider, dict)
        and provider.get("id") == provider_id
        and isinstance(manifest.get("sources"), list)
        and isinstance(manifest.get("artifacts"), list)
        and isinstance(dependencies, dict)
        and isinstance(security, dict)
        and security.get("trustRemoteCode") is False
        and security.get("runtimeNetwork") is False
        and isinstance(gates, dict)
        and all(gates.get(key) is True for key in (
            "pinsVerified", "licensesResolved", "checksumsComplete", "enablementAllowed"
        ))
    )


def verify_install(provider_id: str, manifest_path: Path, lock_path: Path,
                   provider_root: Path, model_root: Path) -> dict[str, Any]:
    manifest = load_json(manifest_path)
    if not _valid_manifest(manifest, provider_id):
        raise SidecarError("TTS_INSTALL_INVALID")
    expected_lock_hash = manifest["dependencies"].get("sha256")
    if not isinstance(expected_lock_hash, str) or not _SHA256.fullmatch(expected_lock_hash):
        raise SidecarError("TTS_INSTALL_INVALID")
    if sha256_file(lock_path) != expected_lock_hash:
        raise SidecarError("TTS_INSTALL_INVALID")

    receipt = load_json(Path(provider_root) / "receipts" / "install-state.json")
    if receipt.get("schemaVersion") != 1 or receipt.get("providerId") != provider_id:
        raise SidecarError("TTS_INSTALL_INVALID")
    if receipt.get("manifestSha256") != sha256_file(manifest_path):
        raise SidecarError("TTS_INSTALL_INVALID")
    if receipt.get("lockSha256") != expected_lock_hash:
        raise SidecarError("TTS_INSTALL_INVALID")

    artifacts = manifest.get("artifacts")
    receipt_artifacts = receipt.get("artifacts")
    if not artifacts or not isinstance(receipt_artifacts, list) or len(artifacts) != len(receipt_artifacts):
        raise SidecarError("TTS_INSTALL_INVALID")
    receipt_by_path = {
        item.get("relativePath"): item for item in receipt_artifacts if isinstance(item, dict)
    }
    verified: dict[str, Path] = {}
    for artifact in artifacts:
        if not isinstance(artifact, dict):
            raise SidecarError("TTS_INSTALL_INVALID")
        relative_path = artifact.get("relativePath")
        expected_hash = artifact.get("sha256")
        expected_size = artifact.get("sizeBytes")
        if not isinstance(expected_hash, str) or not _SHA256.fullmatch(expected_hash):
            raise SidecarError("TTS_INSTALL_INVALID")
        if not isinstance(expected_size, int) or expected_size <= 0:
            raise SidecarError("TTS_INSTALL_INVALID")
        file_path = contained_file(model_root, relative_path)
        if file_path.stat().st_size != expected_size or sha256_file(file_path) != expected_hash:
            raise SidecarError("TTS_INSTALL_INVALID")
        recorded = receipt_by_path.get(relative_path)
        if not recorded or recorded.get("sha256") != expected_hash \
                or recorded.get("sizeBytes") != expected_size:
            raise SidecarError("TTS_INSTALL_INVALID")
        verified[relative_path] = file_path
    return {"manifest": manifest, "artifacts": verified}


def load_private_reference(config_path: Path, *, require_transcript: bool) -> dict[str, Any]:
    config_file = Path(config_path).resolve(strict=True)
    config = load_json(config_file)
    required = {"schemaVersion", "wav", "transcriptFile", "consent"}
    allowed = required | {"vachaGender"}
    if not required.issubset(config) or not set(config).issubset(allowed) \
            or config.get("schemaVersion") != 1:
        raise SidecarError("TTS_REFERENCE_INVALID")
    consent = config.get("consent")
    if not isinstance(consent, dict) or set(consent) != {"ownedOrLicensed", "purpose"}:
        raise SidecarError("TTS_REFERENCE_INVALID")
    if consent.get("ownedOrLicensed") is not True \
            or consent.get("purpose") != "local-noncommercial-evaluation":
        raise SidecarError("TTS_REFERENCE_INVALID")
    root = config_file.parent
    try:
        wav_path = contained_file(root, config.get("wav"))
        transcript_path = contained_file(root, config.get("transcriptFile"))
        wav_info = inspect_pcm_wave(wav_path, max_seconds=10.0)
    except (OSError, TypeError, ValueError, SidecarError):
        raise SidecarError("TTS_REFERENCE_INVALID") from None
    if float(wav_info["durationSeconds"]) < 5.0:
        raise SidecarError("TTS_REFERENCE_INVALID")
    try:
        transcript = transcript_path.read_text(encoding="utf-8").strip()
    except (OSError, UnicodeError):
        raise SidecarError("TTS_REFERENCE_INVALID") from None
    if require_transcript and (not transcript or len(transcript) > 2_000):
        raise SidecarError("TTS_REFERENCE_INVALID")
    gender = config.get("vachaGender")
    if gender is not None and gender not in {"female", "male"}:
        raise SidecarError("TTS_REFERENCE_INVALID")
    return {
        "wavPath": wav_path,
        "transcript": transcript,
        "wav": wav_info,
        "vachaGender": gender,
    }


__all__ = [
    "contained_file",
    "enforce_offline_runtime",
    "load_json",
    "load_private_reference",
    "output_path",
    "sha256_file",
    "verify_install",
]
