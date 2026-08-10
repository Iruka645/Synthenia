"""Strict mono PCM WAV helpers with exclusive destination creation."""

from __future__ import annotations

import os
import stat
import wave
from pathlib import Path
from typing import Iterable

MAX_OUTPUT_BYTES = 25 * 1024 * 1024
MAX_OUTPUT_SECONDS = 120.0


class WavError(ValueError):
    pass


def inspect_pcm_wave(path: Path, *, max_bytes: int = MAX_OUTPUT_BYTES,
                     max_seconds: float = MAX_OUTPUT_SECONDS) -> dict[str, float | int]:
    file_path = Path(path)
    info = os.lstat(file_path)
    if not stat.S_ISREG(info.st_mode) or info.st_size <= 44 or info.st_size > max_bytes:
        raise WavError("invalid wav")
    with wave.open(str(file_path), "rb") as source:
        channels = source.getnchannels()
        sample_width = source.getsampwidth()
        sample_rate = source.getframerate()
        frames = source.getnframes()
        compression = source.getcomptype()
    if channels != 1 or sample_width != 2 or compression != "NONE":
        raise WavError("invalid wav")
    if sample_rate < 8_000 or sample_rate > 96_000 or frames <= 0:
        raise WavError("invalid wav")
    duration = frames / sample_rate
    if duration <= 0 or duration > max_seconds:
        raise WavError("invalid wav")
    return {
        "channels": channels,
        "sampleWidth": sample_width,
        "sampleRate": sample_rate,
        "frames": frames,
        "durationSeconds": duration,
        "sizeBytes": info.st_size,
    }


def write_pcm16_mono_exclusive(path: Path, samples: Iterable[float | int],
                               sample_rate: int) -> dict[str, float | int]:
    if not isinstance(sample_rate, int) or sample_rate < 8_000 or sample_rate > 96_000:
        raise WavError("invalid wav")
    destination = Path(path)
    descriptor = None
    created = False
    try:
        descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        created = True
        with os.fdopen(descriptor, "wb") as raw:
            descriptor = None
            with wave.open(raw, "wb") as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(sample_rate)
                frame_buffer = bytearray()
                frame_count = 0
                for sample in samples:
                    if isinstance(sample, bool) or not isinstance(sample, (int, float)):
                        raise WavError("invalid wav")
                    if isinstance(sample, float):
                        value = max(-1.0, min(1.0, sample))
                        pcm = int(round(value * 32767.0))
                    else:
                        pcm = max(-32768, min(32767, sample))
                    frame_buffer.extend(int(pcm).to_bytes(2, "little", signed=True))
                    frame_count += 1
                    if len(frame_buffer) >= 64 * 1024:
                        output.writeframesraw(frame_buffer)
                        frame_buffer.clear()
                    if frame_count / sample_rate > MAX_OUTPUT_SECONDS:
                        raise WavError("invalid wav")
                if frame_buffer:
                    output.writeframesraw(frame_buffer)
                if frame_count == 0:
                    raise WavError("invalid wav")
        return inspect_pcm_wave(destination)
    except Exception:
        if descriptor is not None:
            os.close(descriptor)
        if created:
            try:
                destination.unlink(missing_ok=True)
            except OSError:
                pass
        raise


def normalize_pcm_wave_exclusive(source: Path, destination: Path) -> dict[str, float | int]:
    inspect_pcm_wave(source)
    descriptor = None
    created = False
    try:
        descriptor = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        created = True
        with wave.open(str(source), "rb") as input_wav, os.fdopen(descriptor, "wb") as raw:
            descriptor = None
            with wave.open(raw, "wb") as output_wav:
                output_wav.setparams(input_wav.getparams())
                while True:
                    frames = input_wav.readframes(16_384)
                    if not frames:
                        break
                    output_wav.writeframesraw(frames)
        return inspect_pcm_wave(destination)
    except Exception:
        if descriptor is not None:
            os.close(descriptor)
        if created:
            try:
                Path(destination).unlink(missing_ok=True)
            except OSError:
                pass
        raise


__all__ = [
    "MAX_OUTPUT_BYTES",
    "MAX_OUTPUT_SECONDS",
    "WavError",
    "inspect_pcm_wave",
    "normalize_pcm_wave_exclusive",
    "write_pcm16_mono_exclusive",
]
