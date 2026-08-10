"""JaiTTS adapter. Heavy imports occur only after all local gates pass."""

from __future__ import annotations

import gc
import os
import sys
import uuid
from pathlib import Path
from typing import Any, Callable

from common.protocol import SidecarError
from common.security import (
    load_private_reference,
    output_path,
    verify_install,
)
from common.wav import normalize_pcm_wave_exclusive

PROVIDER_ID = "jaitts-f5tts"


class _F5Backend:
    def __init__(self, context: dict[str, Any]):
        from f5_tts.api import F5TTS  # type: ignore[import-not-found]

        artifacts = context["install"]["artifacts"]
        checkpoint = next((path for name, path in artifacts.items() if name.endswith("model.pt")), None)
        vocabulary = next((path for name, path in artifacts.items() if name.endswith("vocab.txt")), None)
        if checkpoint is None or vocabulary is None:
            raise SidecarError("TTS_INSTALL_INVALID")
        self.engine = F5TTS(
            model="F5TTS_v1_Base",
            ckpt_file=str(checkpoint),
            vocab_file=str(vocabulary),
            device="cuda",
        )

    def synthesize(self, text: str, reference: dict[str, Any], temporary: Path) -> None:
        self.engine.infer(
            ref_file=str(reference["wavPath"]),
            ref_text=reference["transcript"],
            gen_text=text,
            file_wave=str(temporary),
        )

    def close(self) -> None:
        self.engine = None


class JaiTTSAdapter:
    def __init__(self, *, backend_factory: Callable[[dict[str, Any]], Any] | None = None,
                 install_verifier: Callable[..., dict[str, Any]] = verify_install,
                 reference_loader: Callable[..., dict[str, Any]] = load_private_reference):
        self._backend_factory = backend_factory or _F5Backend
        self._install_verifier = install_verifier
        self._reference_loader = reference_loader
        self._backend: Any | None = None
        self._reference: dict[str, Any] | None = None
        self._audio_root: Path | None = None

    def load(self) -> None:
        if self._backend is not None:
            return
        provider_dir = Path(__file__).resolve().parent
        try:
            provider_root = _absolute_env("TTS_PROVIDER_ROOT")
            model_root = _absolute_env("TTS_MODEL_ROOT")
            audio_root = _absolute_env("TTS_AUDIO_ROOT")
            reference_config = _absolute_env("TTS_REFERENCE_CONFIG")
            install = self._install_verifier(
                PROVIDER_ID,
                provider_dir / "manifest.json",
                provider_dir / "requirements.lock",
                provider_root,
                model_root,
            )
            reference = self._reference_loader(reference_config, require_transcript=True)
            backend = self._backend_factory({
                "install": install,
                "modelRoot": model_root,
                "providerRoot": provider_root,
            })
        except SidecarError:
            raise
        except Exception:
            raise SidecarError("TTS_INSTALL_INVALID") from None
        self._audio_root = audio_root
        self._reference = reference
        self._backend = backend

    def synthesize(self, text: str, output_name: str) -> dict[str, float | int]:
        if self._backend is None or self._reference is None or self._audio_root is None:
            raise SidecarError("TTS_NOT_READY")
        destination = output_path(self._audio_root, output_name)
        temporary = self._audio_root / f".{uuid.uuid4().hex}.partial.wav"
        try:
            self._backend.synthesize(text, self._reference, temporary)
            return normalize_pcm_wave_exclusive(temporary, destination)
        except SidecarError:
            raise
        except Exception:
            raise SidecarError("TTS_SYNTHESIS_FAILED") from None
        finally:
            try:
                temporary.unlink(missing_ok=True)
            except OSError:
                pass

    def unload(self) -> None:
        backend, self._backend = self._backend, None
        self._reference = None
        self._audio_root = None
        if backend is not None:
            try:
                backend.close()
            except Exception:
                pass
        gc.collect()
        try:
            torch = sys.modules.get("torch")
            if torch is None:
                return
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except Exception:
            pass


def _absolute_env(name: str) -> Path:
    value = os.environ.get(name)
    if not value or not Path(value).is_absolute():
        raise SidecarError("TTS_INSTALL_INVALID")
    return Path(value)


__all__ = ["JaiTTSAdapter", "PROVIDER_ID"]
