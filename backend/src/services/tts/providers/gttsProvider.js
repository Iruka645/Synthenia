const { spawn } = require('child_process');
const path = require('path');
const BaseProvider = require('./baseProvider');

class GTTSProvider extends BaseProvider {
  async synthesize(text) {
    return new Promise((resolve, reject) => {
      // Python environment inside backend/src/python
      const pythonPath = path.join(__dirname, '..', '..', '..', 'python', 'venv', 'Scripts', 'python.exe');
      const scriptPath = path.join(__dirname, '..', '..', '..', 'python', 'gtts_tts.py');
      
      const pyProcess = spawn(pythonPath, [scriptPath, text]);

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
          console.error(`Python gTTS process exited with code ${code}. Error: ${stderrData}`);
          return reject(new Error(stderrData || `gTTS execution failed with code ${code}`));
        }
        
        const filename = stdoutData.trim();
        if (!filename) {
          return reject(new Error('gTTS script did not return a filename'));
        }
        
        resolve(filename);
      });
    });
  }
}

module.exports = GTTSProvider;
