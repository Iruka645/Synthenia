"""VachaSpeech stdio sidecar entrypoint."""

from __future__ import annotations

import os
import sys
from pathlib import Path

SIDECAR_ROOT = Path(__file__).resolve().parents[1]
if str(SIDECAR_ROOT) not in sys.path:
    sys.path.insert(0, str(SIDECAR_ROOT))

os.environ["HF_HUB_OFFLINE"] = "1"
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
os.environ["DO_NOT_TRACK"] = "1"

from common.protocol import serve  # noqa: E402
from common.security import enforce_offline_runtime  # noqa: E402

enforce_offline_runtime()

from vachaspeech.adapter import PROVIDER_ID, VachaSpeechAdapter  # noqa: E402


if __name__ == "__main__":
    raise SystemExit(serve(PROVIDER_ID, VachaSpeechAdapter))
