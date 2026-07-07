# rvc_server.py
import sys
import dataclasses
import torch

# Monkeypatch dataclasses to allow mutable defaults (bypasses Python 3.11+ strict checks)
orig_get_field = dataclasses._get_field
def patched_get_field(cls, name, type, kw_only):
    try:
        return orig_get_field(cls, name, type, kw_only)
    except ValueError as e:
        if "mutable default" in str(e):
            default_val = getattr(cls, name, dataclasses.MISSING)
            # If the default is wrapped in a field() object, get the real default
            if isinstance(default_val, dataclasses.Field):
                default_val = default_val.default
            
            if default_val is not dataclasses.MISSING and default_val is not None:
                try:
                    default_val.__class__.__hash__ = object.__hash__
                except Exception:
                    pass
            return orig_get_field(cls, name, type, kw_only)
        raise
dataclasses._get_field = patched_get_field

# Monkeypatch torch.load to default weights_only to False (required for loading fairseq models in PyTorch 2.6+)
orig_torch_load = torch.load
def patched_torch_load(*args, **kwargs):
    if 'weights_only' not in kwargs:
        kwargs['weights_only'] = False
    return orig_torch_load(*args, **kwargs)
torch.load = patched_torch_load

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import asyncio
from rvc_python.infer import RVCInference

app = FastAPI(title="RVC Sidecar Server")

# Global variables for model
rvc = None
lock = asyncio.Lock()

class ConvertRequest(BaseModel):
    input_path: str
    output_path: str
    f0up_key: int = 0
    index_rate: float = 0.4

@app.on_event("startup")
async def startup_event():
    global rvc
    print("Loading RVC Model...", flush=True)
    try:
        # Initialize RVC Inference (Force CPU)
        rvc = RVCInference(device="cpu")
        # Load model and retrieval index
        rvc.load_model("models/syn_voice.pth", index_path="models/syn_voice.index")
        print("RVC Model loaded successfully.", flush=True)
    except Exception as e:
        print(f"Error loading RVC model: {e}", flush=True)
        # We don't crash the server, but the convert endpoint will fail

@app.post("/convert")
async def convert(request: ConvertRequest):
    global rvc
    if rvc is None:
        raise HTTPException(status_code=500, detail="RVC Model not loaded or failed to load")

    # Use asyncio.Lock to ensure only one inference runs at a time
    async with lock:
        try:
            print(f"Starting conversion: {request.input_path} -> {request.output_path} (pitch: {request.f0up_key}, index_rate: {request.index_rate})", flush=True)
            # Set parameters
            rvc.set_params(
                f0up_key=request.f0up_key,
                f0method="rmvpe",
                index_rate=request.index_rate
            )
            # Run inference in a separate thread so it doesn't block the FastAPI event loop
            await asyncio.to_thread(
                rvc.infer_file,
                input_path=request.input_path,
                output_path=request.output_path
            )
            print("Conversion completed successfully.", flush=True)
            return {"status": "success", "message": "Voice conversion completed successfully."}
        except Exception as e:
            print(f"Error during voice conversion: {e}", flush=True)
            raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": rvc is not None}

if __name__ == "__main__":
    import uvicorn
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=5005)
    args = parser.parse_args()
    print(f"Starting uvicorn server on port {args.port}...", flush=True)
    uvicorn.run(app, host="127.0.0.1", port=args.port)
