export class AudioRecorder {
  constructor() {
    this.audioContext = null;
    this.processor = null;
    this.input = null;
    this.stream = null;
    this.samples = [];
  }

  async start() {
    this.samples = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Request a 16kHz AudioContext so the browser automatically resamples the input
    this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 16000,
    });
    
    this.input = this.audioContext.createMediaStreamSource(this.stream);
    
    // Buffer size 4096, 1 input channel, 1 output channel
    this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
    
    this.processor.onaudioprocess = (e) => {
      const channelData = e.inputBuffer.getChannelData(0);
      // Clone channel data because channelData array buffer is reused by the browser
      this.samples.push(new Float32Array(channelData));
    };
    
    // Create a dummy gain node with gain = 0 to prevent audio feedback loop
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 0;
    
    this.input.connect(this.processor);
    this.processor.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
  }

  async stop() {
    if (this.processor) {
      this.processor.disconnect();
      this.input.disconnect();
      this.processor.onaudioprocess = null;
    }
    
    if (this.audioContext) {
      await this.audioContext.close();
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
    }
    
    return this.exportWAV();
  }

  exportWAV() {
    // Flatten Float32Array buffers
    let totalLength = 0;
    for (let i = 0; i < this.samples.length; i++) {
      totalLength += this.samples[i].length;
    }
    
    const result = new Float32Array(totalLength);
    let offset = 0;
    for (let i = 0; i < this.samples.length; i++) {
      result.set(this.samples[i], offset);
      offset += this.samples[i].length;
    }
    
    // Create WAV buffer (44 bytes header + PCM data)
    const buffer = new ArrayBuffer(44 + result.length * 2);
    const view = new DataView(buffer);
    
    /* RIFF identifier */
    this.writeString(view, 0, 'RIFF');
    /* file length */
    view.setUint32(4, 36 + result.length * 2, true);
    /* RIFF type */
    this.writeString(view, 8, 'WAVE');
    /* format chunk identifier */
    this.writeString(view, 12, 'fmt ');
    /* format chunk length */
    view.setUint32(16, 16, true);
    /* sample format (raw PCM) */
    view.setUint16(20, 1, true);
    /* channel count */
    view.setUint16(22, 1, true);
    /* sample rate */
    view.setUint32(24, 16000, true);
    /* byte rate (sample rate * block align) */
    view.setUint32(28, 16000 * 2, true);
    /* block align (channel count * bytes per sample) */
    view.setUint16(32, 2, true);
    /* bits per sample */
    view.setUint16(34, 16, true);
    /* data chunk identifier */
    this.writeString(view, 36, 'data');
    /* data chunk length */
    view.setUint32(40, result.length * 2, true);
    
    // Write PCM audio samples
    let index = 44;
    for (let i = 0; i < result.length; i++) {
      // Float to 16-bit PCM conversion
      let s = Math.max(-1, Math.min(1, result[i]));
      view.setInt16(index, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      index += 2;
    }
    
    return new Blob([view], { type: 'audio/wav' });
  }

  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }
}

export default AudioRecorder;
