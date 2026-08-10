from __future__ import annotations

import io
import json
import sys
import unittest
from pathlib import Path

SIDECAR_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(SIDECAR_ROOT))

from common.protocol import (
    MAX_LINE_BYTES,
    ProtocolError,
    SidecarError,
    decode_request,
    serve,
)


class FakeAdapter:
    def __init__(self):
        self.loaded = False

    def load(self):
        self.loaded = True

    def synthesize(self, text, output_name):
        if not self.loaded:
            raise AssertionError("not loaded")
        return {"durationSeconds": 1.0}

    def unload(self):
        self.loaded = False


class RecoverableAdapter(FakeAdapter):
    def synthesize(self, text, output_name):
        if text == "fail":
            raise SidecarError("TTS_SYNTHESIS_FAILED")
        return super().synthesize(text, output_name)


def line(value):
    return json.dumps(value, separators=(",", ":")).encode() + b"\n"


class ProtocolTests(unittest.TestCase):
    def test_decodes_exact_request_shape(self):
        request = decode_request(line({
            "requestId": "abc-123",
            "type": "synthesize",
            "providerId": "provider",
            "text": " สวัสดี ",
            "outputName": "output.wav",
        }))
        self.assertEqual(request["text"], "สวัสดี")

    def test_rejects_unknown_fields_and_non_object(self):
        with self.assertRaises(ProtocolError):
            decode_request(line({"requestId": "a", "type": "hello", "extra": 1}))
        with self.assertRaises(ProtocolError):
            decode_request(b"[]\n")

    def test_rejects_malformed_utf8_and_oversized_line(self):
        with self.assertRaises(ProtocolError):
            decode_request(b"\xff\n")
        with self.assertRaises(ProtocolError):
            decode_request(b"x" * MAX_LINE_BYTES + b"\n")

    def test_full_lifecycle_uses_stdout_only_for_json(self):
        requests = b"".join([
            line({"requestId": "1", "type": "load", "providerId": "p"}),
            line({"requestId": "2", "type": "synthesize", "providerId": "p",
                  "text": "hello", "outputName": "result.wav"}),
            line({"requestId": "3", "type": "unload", "providerId": "p"}),
            line({"requestId": "4", "type": "shutdown"}),
        ])
        output = io.BytesIO()
        self.assertEqual(serve("p", FakeAdapter, input_stream=io.BytesIO(requests),
                               output_stream=output), 0)
        responses = [json.loads(item) for item in output.getvalue().splitlines()]
        self.assertEqual([item["requestId"] for item in responses], ["1", "2", "3", "4"])
        self.assertEqual(responses[1]["output"], "result.wav")
        self.assertEqual(responses[1]["state"], "ready")

    def test_duplicate_request_id_is_protocol_error(self):
        request = line({"requestId": "same", "type": "hello"})
        output = io.BytesIO()
        self.assertEqual(serve("p", FakeAdapter, input_stream=io.BytesIO(request + request),
                               output_stream=output), 0)
        responses = [json.loads(item) for item in output.getvalue().splitlines()]
        self.assertTrue(responses[0]["ok"])
        self.assertEqual(responses[1]["error"]["code"], "SIDECAR_PROTOCOL_ERROR")

    def test_synthesis_error_does_not_discard_a_loaded_model(self):
        requests = b"".join([
            line({"requestId": "1", "type": "load", "providerId": "p"}),
            line({"requestId": "2", "type": "synthesize", "providerId": "p",
                  "text": "fail", "outputName": "failed.wav"}),
            line({"requestId": "3", "type": "synthesize", "providerId": "p",
                  "text": "ok", "outputName": "ok.wav"}),
        ])
        output = io.BytesIO()
        self.assertEqual(serve("p", RecoverableAdapter, input_stream=io.BytesIO(requests),
                               output_stream=output), 0)
        responses = [json.loads(item) for item in output.getvalue().splitlines()]
        self.assertEqual(responses[1]["state"], "ready")
        self.assertFalse(responses[1]["ok"])
        self.assertTrue(responses[2]["ok"])

    def test_malformed_line_exits_without_echo(self):
        output = io.BytesIO()
        self.assertEqual(serve("p", FakeAdapter, input_stream=io.BytesIO(b"bad\xff\n"),
                               output_stream=output), 2)
        self.assertEqual(output.getvalue(), b"")


if __name__ == "__main__":
    unittest.main()
