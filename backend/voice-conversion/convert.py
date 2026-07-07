# convert.py
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

from rvc_python.infer import RVCInference

def main():
    if len(sys.argv) < 3:
        print("Usage: python convert.py <input_wav> <output_wav> [f0up_key] [index_rate]")
        sys.exit(1)
        
    input_wav = sys.argv[1]
    output_wav = sys.argv[2]

    # Default parameters
    f0up_key = 0
    index_rate = 0.4

    if len(sys.argv) > 3:
        try:
            f0up_key = int(sys.argv[3])
        except ValueError:
            pass

    if len(sys.argv) > 4:
        try:
            index_rate = float(sys.argv[4])
        except ValueError:
            pass

    # Initialize RVC Inference
    rvc = RVCInference(device="cpu")  # Force CPU mode as planned
    
    # Load model and retrieval index
    rvc.load_model("models/syn_voice.pth", index_path="models/syn_voice.index")

    # Set parameters using set_params
    rvc.set_params(
        f0up_key=f0up_key,
        f0method="rmvpe", # rmvpe is faster and cleaner on CPU
        index_rate=index_rate,
    )

    # Run inference
    rvc.infer_file(
        input_path=input_wav,
        output_path=output_wav
    )
    print("Voice conversion completed successfully.")

if __name__ == "__main__":
    main()
