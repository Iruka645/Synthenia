const { spawn } = require('child_process');
const path = require('path');
const BaseProvider = require('./baseProvider');

class KhanomTanProvider extends BaseProvider {
  async synthesize(text) {
    return new Promise((resolve, reject) => {
      // Python environment inside backend/tts-engine
      const pythonPath = path.join(__dirname, '..', '..', '..', '..', 'tts-engine', 'venv', 'Scripts', 'python.exe');
      const scriptPath = path.join(__dirname, '..', '..', '..', 'python', 'khanomtan_tts.py');
      const ttsEngineDir = path.join(__dirname, '..', '..', '..', '..', 'tts-engine');

      const pyProcess = spawn(pythonPath, [scriptPath, text], {
        cwd: ttsEngineDir
      });

      let stdoutData = '';
      let stderrData = '';

      pyProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      pyProcess.stderr.on('data', (data) => {
        stderrData += data.toString();
      });

      // KhanomTan uses full PyTorch YourTTS which is heavier than ONNX models
      // We set a 25-second timeout as per the plan guidelines
      const timeoutId = setTimeout(() => {
        pyProcess.kill();
        reject(new Error('KhanomTan synthesis timeout (60s)'));
      }, 60000);

      pyProcess.on('close', (code) => {
        clearTimeout(timeoutId);
        
        if (code !== 0) {
          console.error(`Python KhanomTan process exited with code ${code}. Error: ${stderrData}`);
          return reject(new Error(stderrData || `KhanomTan execution failed with code ${code}`));
        }
        
        const filename = stdoutData.trim();
        if (!filename) {
          return reject(new Error('KhanomTan script did not return a filename'));
        }
        
        resolve(filename);
      });
    });
  }
}

module.exports = KhanomTanProvider;
