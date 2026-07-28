const { validateObservation } = require('../../contracts/vision');
const config = require('../../config/visionConfig');

function cloneObservation(observation) {
  return {
    ...observation,
    timing: { ...observation.timing },
  };
}

class ShortTermObservationStore {
  constructor({ clock = () => Date.now(), ttlMs = config.observationTtlMs } = {}) {
    this.clock = clock;
    this.ttlMs = ttlMs;
    this.observation = null;
  }

  set(observation) {
    const normalized = validateObservation(observation, { now: this.clock() });
    this.observation = cloneObservation(normalized);
  }

  getLatest() {
    if (!this.observation) return null;
    if (Date.parse(this.observation.expiresAt) <= this.clock()) {
      this.clear();
      return null;
    }
    return cloneObservation(this.observation);
  }

  clear() {
    this.observation = null;
  }
}

module.exports = { ShortTermObservationStore };
