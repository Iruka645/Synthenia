"""VachaSpeech adapter. It never permits the library's floating default model."""

from __future__ import annotations

import gc
import inspect
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

PROVIDER_ID = "vachaspeech-0.6b"
MODEL_ID = "VIZINTZOR/VachaSpeech-0.6B"


class _VachaBackend:
    def __init__(self, context: dict[str, Any]):
        from vachaspeech import VachaSpeech  # type: ignore[import-not-found]

        model_root = str(context["modelRoot"])
        parameters = inspect.signature(VachaSpeech).parameters
        if "model_path" in parameters:
            self.engine = VachaSpeech(model_path=model_root)
        elif "model_name" in parameters:
            self.engine = VachaSpeech(model_name=model_root)
        elif "model_id" in parameters:
            self.engine = VachaSpeech(model_id=model_root)
        else:
            # Calling VachaSpeech() would use a floating network-backed default.
            raise SidecarError("TTS_INSTALL_INVALID")

    def synthesize(self, text: str, reference: dict[str, Any], temporary: Path) -> None:
        gender = reference.get("vachaGender")
        if gender not in {"female", "male"}:
            raise SidecarError("TTS_REFERENCE_INVALID")
        tokens = self.engine.generate(text, gender=gender)
        self.engine.decode(tokens, ref_audio=str(reference["wavPath"]), output=str(temporary))

    def close(self) -> None:
        self.engine = None


class VachaSpeechAdapter:
    def __init__(self, *, backend_factory: Callable[[dict[str, Any]], Any] | None = None,
                 install_verifier: Callable[..., dict[str, Any]] = verify_install,
                 reference_loader: Callable[..., dict[str, Any]] = load_private_reference):
        self._backend_factory = backend_factory or _VachaBackend
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
            if install["manifest"]["provider"].get("modelId") != MODEL_ID:
                raise SidecarError("TTS_INSTALL_INVALID")
            reference = self._reference_loader(reference_config, require_transcript=False)
            if reference.get("vachaGender") not in {"female", "male"}:
                raise SidecarError("TTS_REFERENCE_INVALID")
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


__all__ = ["MODEL_ID", "PROVIDER_ID", "VachaSpeechAdapter"]
