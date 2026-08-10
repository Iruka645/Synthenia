from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SIDECAR_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SIDECAR_ROOT))

from common.protocol import SidecarError
from common.security import (
    contained_file,
    load_private_reference,
    output_path,
    sha256_file,
    verify_install,
)
from common.wav import write_pcm16_mono_exclusive


class SecurityTests(unittest.TestCase):
    def test_runtime_audit_guard_denies_sockets_and_child_processes(self):
        program = """
from common.security import enforce_offline_runtime
import socket, subprocess, sys
enforce_offline_runtime()
blocked = 0
try:
    socket.socket()
except PermissionError:
    blocked += 1
try:
    subprocess.run([sys.executable, '-V'], check=False)
except PermissionError:
    blocked += 1
raise SystemExit(0 if blocked == 2 else 1)
"""
        environment = dict(os.environ)
        environment["PYTHONPATH"] = str(SIDECAR_ROOT)
        result = subprocess.run(
            [sys.executable, "-c", program],
            env=environment,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr, "")

    def test_containment_and_output_names(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "safe.bin").write_bytes(b"safe")
            self.assertEqual(contained_file(root, "safe.bin"), root / "safe.bin")
            with self.assertRaises(SidecarError):
                contained_file(root, "../safe.bin")
            with self.assertRaises(SidecarError):
                output_path(root, "../escape.wav")
            target = output_path(root, "tts_provider_123.wav")
            self.assertEqual(target.parent, root)
            target.write_bytes(b"exists")
            with self.assertRaises(SidecarError):
                output_path(root, target.name)

    def test_private_reference_requires_consent_duration_and_transcript(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            write_pcm16_mono_exclusive(root / "reference.wav", [0] * 40_000, 8_000)
            (root / "transcript.txt").write_text("ข้อความอ้างอิง", encoding="utf-8")
            config = {
                "schemaVersion": 1,
                "wav": "reference.wav",
                "transcriptFile": "transcript.txt",
                "vachaGender": "female",
                "consent": {
                    "ownedOrLicensed": True,
                    "purpose": "local-noncommercial-evaluation",
                },
            }
            config_path = root / "reference.json"
            config_path.write_text(json.dumps(config), encoding="utf-8")
            result = load_private_reference(config_path, require_transcript=True)
            self.assertEqual(result["transcript"], "ข้อความอ้างอิง")
            self.assertEqual(result["vachaGender"], "female")
            config["consent"]["ownedOrLicensed"] = False
            config_path.write_text(json.dumps(config), encoding="utf-8")
            with self.assertRaises(SidecarError):
                load_private_reference(config_path, require_transcript=True)

    def test_install_verification_hashes_manifest_lock_receipt_and_artifact(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            provider_root = root / "provider"
            model_root = provider_root / "models"
            receipt_root = provider_root / "receipts"
            model_root.mkdir(parents=True)
            receipt_root.mkdir()
            artifact = model_root / "model.bin"
            artifact.write_bytes(b"verified-model")
            lock = root / "requirements.lock"
            lock.write_text("example==1.0 --hash=sha256:" + "0" * 64 + "\n")
            artifact_hash = sha256_file(artifact)
            manifest = {
                "schemaVersion": 1,
                "provider": {"id": "p"},
                "sources": [],
                "artifacts": [{
                    "relativePath": "model.bin",
                    "sizeBytes": artifact.stat().st_size,
                    "sha256": artifact_hash,
                }],
                "dependencies": {"sha256": sha256_file(lock)},
                "security": {"trustRemoteCode": False, "runtimeNetwork": False},
                "gates": {
                    "pinsVerified": True,
                    "licensesResolved": True,
                    "checksumsComplete": True,
                    "enablementAllowed": True,
                },
            }
            manifest_path = root / "manifest.json"
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            receipt = {
                "schemaVersion": 1,
                "providerId": "p",
                "manifestSha256": sha256_file(manifest_path),
                "lockSha256": sha256_file(lock),
                "artifacts": [{
                    "relativePath": "model.bin",
                    "sizeBytes": artifact.stat().st_size,
                    "sha256": artifact_hash,
                }],
            }
            (receipt_root / "install-state.json").write_text(json.dumps(receipt))
            result = verify_install("p", manifest_path, lock, provider_root, model_root)
            self.assertEqual(result["artifacts"]["model.bin"], artifact)
            artifact.write_bytes(b"tampered")
            with self.assertRaises(SidecarError):
                verify_install("p", manifest_path, lock, provider_root, model_root)

    def test_false_manifest_gate_stops_before_artifact_access(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            manifest = {
                "schemaVersion": 1,
                "provider": {"id": "p"},
                "sources": [],
                "artifacts": [],
                "dependencies": {},
                "security": {"trustRemoteCode": False, "runtimeNetwork": False},
                "gates": {"enablementAllowed": False},
            }
            manifest_path = root / "manifest.json"
            manifest_path.write_text(json.dumps(manifest))
            with self.assertRaises(SidecarError):
                verify_install("p", manifest_path, root / "missing.lock",
                               root / "missing-provider", root / "missing-model")


if __name__ == "__main__":
    unittest.main()
