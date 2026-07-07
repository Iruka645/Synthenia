const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');

class VoiceConversionService {
  constructor() {
    this.pythonPath = path.join(__dirname, '..', '..', 'voice-conversion', 'venv', 'Scripts', 'python.exe');
    this.vcDir = path.join(__dirname, '..', '..', 'voice-conversion');
    this.audioDir = path.join(__dirname, '..', '..', '..', 'audio');
    
    this.serverPort = process.env.RVC_SERVER_PORT || 5005;
    this.serverUrl = process.env.RVC_SERVER_URL || `http://127.0.0.1:${this.serverPort}`;
    this.serverProcess = null;
    this._listenersRegistered = false;
  }

  startServer() {
    if (this.serverProcess) {
      console.log('[VoiceConversion] RVC server is already running.');
      return;
    }

    console.log(`[VoiceConversion] Starting RVC sidecar server on port ${this.serverPort}...`);
    const serverScriptPath = path.join(this.vcDir, 'rvc_server.py');

    this.serverProcess = spawn(this.pythonPath, [
      serverScriptPath,
      '--port', this.serverPort.toString()
    ], {
      cwd: this.vcDir,
      stdio: 'pipe'
    });

    this.serverProcess.stdout.on('data', (data) => {
      console.log(`[RVC Server]: ${data.toString().trim()}`);
    });

    this.serverProcess.stderr.on('data', (data) => {
      console.error(`[RVC Server Err]: ${data.toString().trim()}`);
    });

    this.serverProcess.on('close', (code) => {
      console.log(`[RVC Server] Process exited with code ${code}`);
      this.serverProcess = null;
    });

    // Register cleanup logic once to prevent listener leaks on multiple startServer calls
    if (!this._listenersRegistered) {
      this._listenersRegistered = true;

      const cleanup = () => {
        this.stopServer();
      };

      process.on('exit', cleanup);
      
      process.once('SIGINT', () => {
        cleanup();
        process.exit(0);
      });
      
      process.once('SIGTERM', () => {
        cleanup();
        process.exit(0);
      });

      process.once('SIGUSR2', () => {
        cleanup();
        process.kill(process.pid, 'SIGUSR2');
      });
    }
  }

  stopServer() {
    if (this.serverProcess) {
      console.log('[VoiceConversion] Stopping RVC sidecar server...');
      this.serverProcess.kill();
      this.serverProcess = null;
    }
  }

  async convert(audioFilename, pitch = 0, indexRate = 0.4) {
    if (!audioFilename) {
      throw new Error('No audio filename provided for conversion');
    }

    const inputPath = path.join(this.audioDir, audioFilename);
    if (!fs.existsSync(inputPath)) {
      console.warn(`[VoiceConversion] Input file not found: ${inputPath}. Returning original.`);
      return audioFilename;
    }

    // Generate output filename with .wav extension
    const baseName = path.basename(audioFilename, path.extname(audioFilename));
    const outputFilename = `converted_${baseName}_${Date.now()}.wav`;
    const outputPath = path.join(this.audioDir, outputFilename);

    console.log(`[VoiceConversion] Converting ${audioFilename} to ${outputFilename} using RVC server (pitch: ${pitch}, indexRate: ${indexRate})...`);

    try {
      const response = await axios.post(`${this.serverUrl}/convert`, {
        input_path: inputPath,
        output_path: outputPath,
        f0up_key: pitch,
        index_rate: indexRate
      }, {
        timeout: 90000 // 90 seconds timeout
      });

      if (response.data && response.data.status === 'success') {
        // Verify if output file exists and is not empty
        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          console.log(`[VoiceConversion] Conversion successful: ${outputFilename}`);
          return outputFilename;
        } else {
          throw new Error('Output file was not created or is empty');
        }
      } else {
        throw new Error(response.data?.message || 'Server returned failure status');
      }
    } catch (error) {
      let errMsg = error.message;
      if (error.response && error.response.data && error.response.data.detail) {
        errMsg = typeof error.response.data.detail === 'string' 
          ? error.response.data.detail 
          : JSON.stringify(error.response.data.detail);
      }
      console.error(`[VoiceConversion] Conversion failed: ${errMsg}. Falling back to original audio.`);
      // Clean up output file if it was partially created
      if (fs.existsSync(outputPath)) {
        try {
          fs.unlinkSync(outputPath);
        } catch (unlinkErr) {
          console.error('[VoiceConversion] Failed to clean up partial output file:', unlinkErr);
        }
      }
      return audioFilename; // Fallback to original audio filename
    }
  }
}

module.exports = new VoiceConversionService();
