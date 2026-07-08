const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class STTService {
  transcribe(audioFilePath) {
    return new Promise((resolve, reject) => {
      // Check if file exists
      if (!fs.existsSync(audioFilePath)) {
        return reject(new Error(`Audio file not found: ${audioFilePath}`));
      }

      const execPath = path.join(__dirname, '..', 'bin', 'whisper', 'Release', 'whisper-cli.exe');
      // Resolve model path: check for medium, fallback to small
      let modelPath = path.join(__dirname, '..', 'bin', 'whisper', 'models', 'ggml-medium.bin');
      if (!fs.existsSync(modelPath)) {
        console.warn(`[STTService] ggml-medium.bin not found. Falling back to ggml-small.bin.`);
        modelPath = path.join(__dirname, '..', 'bin', 'whisper', 'models', 'ggml-small.bin');
      }

      // Check if executable exists
      if (!fs.existsSync(execPath)) {
        return reject(new Error(`whisper-cli.exe not found at ${execPath}`));
      }

      // Check if the selected model exists
      if (!fs.existsSync(modelPath)) {
        return reject(new Error(`Whisper model not found at ${modelPath}`));
      }

      // Spawn whisper-cli.exe
      const args = [
        '-m', modelPath,
        '-f', audioFilePath,
        '-l', 'th',      // Thai language
        '-nt',            // No timestamps
        '-np',            // No prints (only output result text)
        '-t', '4',        // Number of threads
        '--prompt', 'Syn, chatbot Syn, robot Syn, AI Syn' // Use English to prevent Windows command line encoding issues
      ];

      const child = spawn(execPath, args);

      let stdoutData = '';
      let stderrData = '';

      child.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      child.on('close', (code) => {
        if (code !== 0) {
          console.error(`Whisper process exited with code ${code}. Error: ${stderrData}`);
          return reject(new Error(stderrData || `Whisper execution failed with code ${code}`));
        }

        // Clean up the output string
        let text = stdoutData.trim();
        
        if (text) {
          // 1. Standardize spelling variations of "สวัสดี" (e.g., สวัตย์ดี, สวัดดี, สวัสดิ์ดี) to "สวัสดี"
          text = text.replace(/สะ?[ววัดดิ์ทธ์ยวษ์]+ดี/g, 'สวัสดี');

          // 2. Replace "สิน" (Sin) with "ซิน" (Syn) using lookbehinds and lookaheads
          // Excludes common vocabulary: สินค้า, สินทรัพย์, ทรัพย์สิน, หนี้สิน, สินเชื่อ, สินสอด, สินบน, สินไหม, สินน้ำใจ
          text = text.replace(/(?<!ทรัพย์|หนี้)สิน(?!ค้า|ทรัพย์|สอด|บน|เชื่อ|ไหม|น้ำใจ)/g, 'ซิน');
        }

        resolve(text);
      });
    });
  }
}

module.exports = new STTService();
