from __future__ import annotations

import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

SIDECAR_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SIDECAR_ROOT))

from common.protocol import SidecarError
from common.wav import write_pcm16_mono_exclusive


def load_adapter(name, provider):
    spec = importlib.util.spec_from_file_location(name, SIDECAR_ROOT / provider / "adapter.py")
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


JAI = load_adapter("synthenia_test_jai_adapter", "jaitts")
VACHA = load_adapter("synthenia_test_vacha_adapter", "vachaspeech")


class FakeBackend:
    def __init__(self, context):
        self.closed = False

    def synthesize(self, text, reference, temporary):
        write_pcm16_mono_exclusive(temporary, [0] * 800, 8_000)

    def close(self):
        self.closed = True


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.audio = self.root / "audio"
        self.audio.mkdir()
        self.env = patch.dict(os.environ, {
            "TTS_PROVIDER_ROOT": str(self.root / "provider"),
            "TTS_MODEL_ROOT": str(self.root / "models"),
            "TTS_AUDIO_ROOT": str(self.audio),
            "TTS_REFERENCE_CONFIG": str(self.root / "reference.json"),
        }, clear=False)
        self.env.start()

    def tearDown(self):
        self.env.stop()
        self.temporary.cleanup()

    @staticmethod
    def install_jai(*args):
        return {"manifest": {"provider": {"id": JAI.PROVIDER_ID}}, "artifacts": {}}

    @staticmethod
    def install_vacha(*args):
        return {
            "manifest": {"provider": {"id": VACHA.PROVIDER_ID, "modelId": VACHA.MODEL_ID}},
            "artifacts": {},
        }

    @staticmethod
    def reference(*args, **kwargs):
        return {
            "wavPath": Path("private-reference.wav"),
            "transcript": "private transcript",
            "vachaGender": "female",
        }

    def test_jai_fake_backend_lifecycle(self):
        adapter = JAI.JaiTTSAdapter(
            backend_factory=FakeBackend,
            install_verifier=self.install_jai,
            reference_loader=self.reference,
        )
        adapter.load()
        result = adapter.synthesize("secret text", "tts_jaitts_123.wav")
        self.assertGreater(result["durationSeconds"], 0)
        self.assertTrue((self.audio / "tts_jaitts_123.wav").exists())
        adapter.unload()

    def test_vacha_exact_model_and_private_gender_gate(self):
        adapter = VACHA.VachaSpeechAdapter(
            backend_factory=FakeBackend,
            install_verifier=self.install_vacha,
            reference_loader=self.reference,
        )
        adapter.load()
        adapter.synthesize("secret text", "tts_vacha_123.wav")
        self.assertTrue((self.audio / "tts_vacha_123.wav").exists())
        adapter.unload()

    def test_vacha_rejects_wrong_model_before_backend_import(self):
        def wrong_model(*args):
            return {"manifest": {"provider": {"modelId": "floating-default"}}, "artifacts": {}}
        adapter = VACHA.VachaSpeechAdapter(
            backend_factory=lambda context: self.fail("backend must not load"),
            install_verifier=wrong_model,
            reference_loader=self.reference,
        )
        with self.assertRaises(SidecarError) as error:
            adapter.load()
        self.assertEqual(error.exception.code, "TTS_INSTALL_INVALID")

    def test_missing_absolute_environment_fails_closed(self):
        with patch.dict(os.environ, {"TTS_MODEL_ROOT": "relative"}, clear=False):
            adapter = JAI.JaiTTSAdapter(
                backend_factory=FakeBackend,
                install_verifier=self.install_jai,
                reference_loader=self.reference,
            )
            with self.assertRaises(SidecarError):
                adapter.load()

    def test_committed_unresolved_manifests_block_before_ml_imports(self):
        for adapter, module_name in [
            (JAI.JaiTTSAdapter(), "f5_tts"),
            (VACHA.VachaSpeechAdapter(), "vachaspeech"),
        ]:
            sys.modules.pop(module_name, None)
            with self.assertRaises(SidecarError) as error:
                adapter.load()
            self.assertEqual(error.exception.code, "TTS_INSTALL_INVALID")
            self.assertNotIn(module_name, sys.modules)


if __name__ == "__main__":
    unittest.main()
