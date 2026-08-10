from __future__ import annotations

import tempfile
import sys
import unittest
import wave
from pathlib import Path

SIDECAR_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SIDECAR_ROOT))

from common.wav import WavError, inspect_pcm_wave, normalize_pcm_wave_exclusive, write_pcm16_mono_exclusive


class WavTests(unittest.TestCase):
    def test_writes_and_inspects_exclusive_pcm(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "voice.wav"
            info = write_pcm16_mono_exclusive(target, [0.0] * 8_000, 8_000)
            self.assertEqual(info["channels"], 1)
            self.assertEqual(info["sampleWidth"], 2)
            self.assertEqual(info["durationSeconds"], 1.0)
            with self.assertRaises(FileExistsError):
                write_pcm16_mono_exclusive(target, [0], 8_000)

    def test_rejects_stereo(self):
        with tempfile.TemporaryDirectory() as directory:
            target = Path(directory) / "stereo.wav"
            with wave.open(str(target), "wb") as output:
                output.setnchannels(2)
                output.setsampwidth(2)
                output.setframerate(8_000)
                output.writeframes(b"\x00\x00" * 16_000)
            with self.assertRaises(WavError):
                inspect_pcm_wave(target)

    def test_normalizes_only_valid_pcm_to_new_destination(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "source.wav"
            destination = Path(directory) / "destination.wav"
            write_pcm16_mono_exclusive(source, [100] * 800, 8_000)
            result = normalize_pcm_wave_exclusive(source, destination)
            self.assertEqual(result["frames"], 800)
            self.assertTrue(source.exists())
            self.assertTrue(destination.exists())


if __name__ == "__main__":
    unittest.main()
