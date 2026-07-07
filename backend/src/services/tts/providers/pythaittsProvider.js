const { spawn } = require('child_process');
const path = require('path');
const BaseProvider = require('./baseProvider');

class PyThaiTTSProvider extends BaseProvider {
  async synthesize(text) {
    return new Promise((resolve, reject) => {
      // Python environment inside backend/tts-engine
      const pythonPath = path.join(__dirname, '..', '..', '..', '..', 'tts-engine', 'venv', 'Scripts', 'python.exe');
      const scriptPath = path.join(__dirname, '..', '..', '..', 'python', 'pythaitts_tts.py');
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

      pyProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`Python PyThaiTTS process exited with code ${code}. Error: ${stderrData}`);
          return reject(new Error(stderrData || `PyThaiTTS execution failed with code ${code}`));
        }
        
        const filename = stdoutData.trim();
        if (!filename) {
          return reject(new Error('PyThaiTTS script did not return a filename'));
        }
        
        resolve(filename);
      });
    });
  }
}

module.exports = PyThaiTTSProvider;
