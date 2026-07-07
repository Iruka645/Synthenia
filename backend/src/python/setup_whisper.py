import os
import sys
import urllib.request
import zipfile
import json

def download_file(url, filepath):
    print(f"Downloading {url} to {filepath}...")
    
    req = urllib.request.Request(
        url, 
        headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'}
    )
    
    with urllib.request.urlopen(req) as response, open(filepath, 'wb') as out_file:
        meta = response.info()
        file_size = int(meta.get("Content-Length", 0))
        
        chunk_size = 1024 * 1024 # 1MB chunks
        downloaded = 0
        
        while True:
            chunk = response.read(chunk_size)
            if not chunk:
                break
            downloaded += len(chunk)
            out_file.write(chunk)
            if file_size:
                percent = (downloaded / file_size) * 100
                print(f"Downloaded: {downloaded / (1024*1024):.2f}MB / {file_size / (1024*1024):.2f}MB ({percent:.2f}%)", end='\r')
        print("\nDownload complete.")

def main():
    current_dir = os.path.dirname(os.path.abspath(__file__))
    # Target whisper directory: backend/src/bin/whisper
    whisper_dir = os.path.abspath(os.path.join(current_dir, "..", "bin", "whisper"))
    models_dir = os.path.join(whisper_dir, "models")
    
    # Ensure directories exist
    os.makedirs(models_dir, exist_ok=True)
    
    # Fetch latest release details
    print("Fetching latest whisper.cpp release information...")
    try:
        api_url = "https://api.github.com/repos/ggerganov/whisper.cpp/releases/latest"
        req = urllib.request.Request(api_url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            release_data = json.loads(response.read().decode())
            tag_name = release_data['tag_name']
            print(f"Latest release found: {tag_name}")
    except Exception as e:
        print(f"Failed to fetch release info: {e}. Defaulting to v1.9.1", file=sys.stderr)
        tag_name = "v1.9.1"
        
    # 1. Download Whisper.cpp Binaries for Windows
    zip_url = f"https://github.com/ggerganov/whisper.cpp/releases/download/{tag_name}/whisper-bin-x64.zip"
    zip_path = os.path.join(whisper_dir, "whisper-bin.zip")
    
    try:
        download_file(zip_url, zip_path)
        
        print("Extracting binaries...")
        with zipfile.ZipFile(zip_path, 'r') as zip_ref:
            zip_ref.extractall(whisper_dir)
        
        os.remove(zip_path)
        print("Binaries extracted successfully.")
    except Exception as e:
        print(f"Error downloading/extracting binaries: {e}", file=sys.stderr)
        sys.exit(1)

    # Delete deprecated base model if exists
    old_model_path = os.path.join(models_dir, "ggml-base.bin")
    if os.path.exists(old_model_path):
        print(f"Removing old model: {old_model_path}")
        try:
            os.remove(old_model_path)
        except Exception as e:
            print(f"Warning: Could not remove old model file: {e}")

    # 2. Download ggml-small.bin model
    model_url = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"
    model_path = os.path.join(models_dir, "ggml-small.bin")
    
    try:
        if not os.path.exists(model_path):
            download_file(model_url, model_path)
            print("Model ggml-small.bin downloaded successfully.")
        else:
            print("Model ggml-small.bin already exists, skipping download.")
    except Exception as e:
        print(f"Error downloading model: {e}", file=sys.stderr)
        sys.exit(1)
        
    print("Whisper.cpp setup completed successfully!")

if __name__ == "__main__":
    main()
