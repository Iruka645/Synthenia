const { spawn } = require('child_process');
const path = require('path');
const BaseProvider = require('./baseProvider');
const { TTSError } = require('../neural/contracts');

const MAX_STDOUT_BYTES = 512;

class GTTSProvider extends BaseProvider {
  constructor(options = {}) {
    super();
    this.spawnImpl = options.spawnImpl || spawn;
    this.pythonPath = options.pythonPath
      || path.join(__dirname, '..', '..', '..', 'python', 'venv', 'Scripts', 'python.exe');
    this.scriptPath = options.scriptPath
      || path.join(__dirname, '..', '..', '..', 'python', 'gtts_tts.py');
  }

  async synthesize(text) {
    return new Promise((resolve, reject) => {
      let stdoutData = '';
      let stdoutBytes = 0;
      let settled = false;
      let timeoutId;

      const settle = (error, value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        if (error) reject(error);
        else resolve(value);
      };

      const fail = (code) => {
        if (settled) return;
        console.error(`[gTTS Provider] code=${code}`);
        settle(new TTSError(code));
      };

      let pyProcess;
      try {
        pyProcess = this.spawnImpl(this.pythonPath, [this.scriptPath, text], {
          shell: false,
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch {
        fail('TTS_SYNTHESIS_FAILED');
        return;
      }

      timeoutId = setTimeout(() => {
        pyProcess.kill();
        fail('TTS_TIMEOUT');
      }, 30000);

      pyProcess.stdout.on('data', (data) => {
        const chunk = Buffer.from(data);
        stdoutBytes += chunk.length;
        if (stdoutBytes > MAX_STDOUT_BYTES) {
          pyProcess.kill();
          fail('TTS_SYNTHESIS_FAILED');
          return;
        }
        stdoutData += chunk.toString('utf8');
      });

      // Always drain child stderr to avoid backpressure, but never retain or expose it.
      pyProcess.stderr.on('data', () => {});

      pyProcess.once('error', () => fail('TTS_SYNTHESIS_FAILED'));

      pyProcess.once('close', (code) => {
        if (code !== 0) {
          fail('TTS_SYNTHESIS_FAILED');
          return;
        }

        const filename = stdoutData.trim();
        if (!filename) {
          fail('TTS_SYNTHESIS_FAILED');
          return;
        }

        settle(null, filename);
      });
    });
  }
}

module.exports = GTTSProvider;
