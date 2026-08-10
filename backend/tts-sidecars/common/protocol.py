"""Bounded JSONL protocol for inherited stdin/stdout TTS sidecars."""

from __future__ import annotations

import json
import re
import sys
import time
from typing import Any, BinaryIO, Callable

MAX_LINE_BYTES = 64 * 1024
MAX_REQUESTS_PER_PROCESS = 100_000
MAX_TEXT_CODEPOINTS = 1_000

_REQUEST_ID = re.compile(r"^[A-Za-z0-9_-]{1,128}$")
_FIELDS = {
    "hello": frozenset({"requestId", "type"}),
    "load": frozenset({"requestId", "type", "providerId"}),
    "synthesize": frozenset(
        {"requestId", "type", "providerId", "text", "outputName"}
    ),
    "unload": frozenset({"requestId", "type", "providerId"}),
    "shutdown": frozenset({"requestId", "type"}),
}


class SidecarError(Exception):
    """An internal error carrying only a public, allowlisted code."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


class ProtocolError(SidecarError):
    def __init__(self):
        super().__init__("SIDECAR_PROTOCOL_ERROR")


def decode_request(raw: bytes) -> dict[str, Any]:
    if not raw or len(raw) > MAX_LINE_BYTES or not raw.endswith(b"\n"):
        raise ProtocolError()
    try:
        text = raw[:-1].decode("utf-8", errors="strict")
        value = json.loads(text)
    except (UnicodeDecodeError, json.JSONDecodeError):
        raise ProtocolError() from None
    if not isinstance(value, dict):
        raise ProtocolError()
    request_type = value.get("type")
    allowed = _FIELDS.get(request_type)
    if allowed is None or set(value) != allowed:
        raise ProtocolError()
    request_id = value.get("requestId")
    if not isinstance(request_id, str) or not _REQUEST_ID.fullmatch(request_id):
        raise ProtocolError()
    if request_type in {"load", "synthesize", "unload"}:
        provider_id = value.get("providerId")
        if not isinstance(provider_id, str) or not provider_id:
            raise ProtocolError()
    if request_type == "synthesize":
        synthesis_text = value.get("text")
        output_name = value.get("outputName")
        if not isinstance(synthesis_text, str) or not synthesis_text.strip():
            raise SidecarError("TTS_INVALID_INPUT")
        if len(synthesis_text.strip()) > MAX_TEXT_CODEPOINTS:
            raise SidecarError("TTS_INVALID_INPUT")
        if not isinstance(output_name, str):
            raise ProtocolError()
        value["text"] = synthesis_text.strip()
    return value


def encode_response(value: dict[str, Any]) -> bytes:
    try:
        encoded = json.dumps(
            value, ensure_ascii=False, separators=(",", ":"), allow_nan=False
        ).encode("utf-8") + b"\n"
    except (TypeError, ValueError):
        raise ProtocolError() from None
    if len(encoded) > MAX_LINE_BYTES:
        raise ProtocolError()
    return encoded


def _response(request_id: str, *, ok: bool, state: str | None = None,
              output: str | None = None, metrics: dict[str, float] | None = None,
              error_code: str | None = None) -> dict[str, Any]:
    value: dict[str, Any] = {"requestId": request_id, "ok": ok}
    if state is not None:
        value["state"] = state
    if output is not None:
        value["output"] = output
    if metrics is not None:
        value["metrics"] = metrics
    if error_code is not None:
        value["error"] = {"code": error_code}
    return value


def serve(provider_id: str, adapter_factory: Callable[[], Any], *,
          input_stream: BinaryIO | None = None,
          output_stream: BinaryIO | None = None) -> int:
    """Serve one provider over stdio. No socket or runtime acquisition exists here."""

    reader = input_stream or sys.stdin.buffer
    writer = output_stream or sys.stdout.buffer
    adapter = adapter_factory()
    seen: set[str] = set()
    state = "unavailable"

    while True:
        raw = reader.readline(MAX_LINE_BYTES + 2)
        if raw == b"":
            break
        if len(raw) > MAX_LINE_BYTES or not raw.endswith(b"\n"):
            return 2
        request: dict[str, Any] = {}
        try:
            request = decode_request(raw)
            request_id = request["requestId"]
            if request_id in seen or len(seen) >= MAX_REQUESTS_PER_PROCESS:
                raise ProtocolError()
            seen.add(request_id)
            request_type = request["type"]

            if request_type in {"load", "synthesize", "unload"} \
                    and request["providerId"] != provider_id:
                raise ProtocolError()
            if request_type == "hello":
                response = _response(request_id, ok=True, state=state)
            elif request_type == "load":
                state = "loading"
                adapter.load()
                state = "ready"
                response = _response(request_id, ok=True, state=state)
            elif request_type == "synthesize":
                if state != "ready":
                    raise SidecarError("TTS_NOT_READY")
                state = "busy"
                started = time.monotonic()
                result = adapter.synthesize(request["text"], request["outputName"])
                elapsed_ms = (time.monotonic() - started) * 1000.0
                state = "ready"
                response = _response(
                    request_id,
                    ok=True,
                    state=state,
                    output=request["outputName"],
                    metrics={
                        "durationMs": elapsed_ms,
                        "audioDurationSeconds": float(result["durationSeconds"]),
                        "rtf": elapsed_ms / 1000.0 / float(result["durationSeconds"]),
                    },
                )
            elif request_type == "unload":
                adapter.unload()
                state = "unavailable"
                response = _response(request_id, ok=True, state=state)
            else:
                adapter.unload()
                state = "unavailable"
                response = _response(request_id, ok=True, state=state)
                writer.write(encode_response(response))
                writer.flush()
                break
        except SidecarError as error:
            if request.get("type") == "synthesize" and state == "busy":
                state = "ready"
            elif state in {"loading", "busy"}:
                state = "failed"
            request_id = request.get("requestId", "invalid")
            if request_id == "invalid":
                return 2
            response = _response(request_id, ok=False, state=state, error_code=error.code)
        except Exception:
            if state in {"loading", "busy"}:
                state = "failed"
            request_id = request.get("requestId", "invalid")
            if request_id == "invalid":
                return 2
            response = _response(
                request_id, ok=False, state=state, error_code="TTS_SYNTHESIS_FAILED"
            )

        writer.write(encode_response(response))
        writer.flush()
    try:
        adapter.unload()
    except Exception:
        pass
    return 0


__all__ = [
    "MAX_LINE_BYTES",
    "ProtocolError",
    "SidecarError",
    "decode_request",
    "encode_response",
    "serve",
]
