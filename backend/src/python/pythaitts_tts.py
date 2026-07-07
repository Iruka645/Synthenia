import sys
import os
import time
from pythaitts import TTS

def main():
    if len(sys.argv) < 2:
        print("Error: Missing text argument", file=sys.stderr)
        sys.exit(1)
        
    text = sys.argv[1].strip()
    if not text:
        print("Error: Text argument is empty", file=sys.stderr)
        sys.exit(1)

    # Determine audio directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    audio_dir = os.path.abspath(os.path.join(current_dir, "..", "..", "..", "audio"))
    
    # Create audio folder if it doesn't exist
    if not os.path.exists(audio_dir):
        os.makedirs(audio_dir)
        
    # Generate unique filename using timestamp
    filename = f"tts_pythaitts_{int(time.time() * 1000)}.wav"
    filepath = os.path.join(audio_dir, filename)

    try:
        # Generate Text-to-Speech using pythaitts (lunarlist_onnx)
        tts = TTS(pretrained="lunarlist_onnx")
        tts.tts(text, filename=filepath)
        
        # Print only the filename to stdout
        print(filename)
        sys.exit(0)
    except Exception as e:
        print(f"Error generating PyThaiTTS: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
