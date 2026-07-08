export class AudioAnalyser {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.source = null;
    this.dataArray = null;
    this.animationFrameId = null;
  }

  initContext() {
    try {
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume();
        console.log('[AudioAnalyser] AudioContext resumed successfully.');
      }
    } catch (e) {
      console.warn('[AudioAnalyser] Failed to initialize AudioContext:', e);
    }
  }

  analyse(audioElement, onVolumeChange) {
    this.stop();

    try {
      this.initContext();

      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      const bufferLength = this.analyser.frequencyBinCount;
      this.dataArray = new Uint8Array(bufferLength);

      // Connect HTML Audio Element to Analyser
      // Note: audioElement.crossOrigin = "anonymous" must be set before setting src
      this.source = this.audioContext.createMediaElementSource(audioElement);
      this.source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);

      const updateVolume = () => {
        if (!this.analyser) return;

        this.analyser.getByteFrequencyData(this.dataArray);
        
        // Calculate average volume
        let total = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
          total += this.dataArray[i];
        }
        const average = total / this.dataArray.length;
        
        // Normalize volume to 0.0 - 1.0 range
        // Max byte frequency value is 255
        const normalizedVolume = average / 128; // Scale sensitivity slightly higher so it mouth opens wide
        const clampedVolume = Math.min(1.0, Math.max(0.0, normalizedVolume));

        onVolumeChange(clampedVolume);

        this.animationFrameId = requestAnimationFrame(updateVolume);
      };

      updateVolume();
    } catch (err) {
      console.warn('Could not initialize audio analyser (cross-origin or block restriction):', err);
    }
  }

  stop() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    
    // We disconnect the source, but keep the AudioContext alive for subsequent audios
    if (this.source) {
      try {
        this.source.disconnect();
      } catch (e) {
        // Safe check
      }
      this.source = null;
    }
    this.analyser = null;
  }
}

export default AudioAnalyser;
