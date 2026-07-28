const visionConfig = {
  contractVersion: 1,
  modes: Object.freeze(['manual', 'periodic']),
  mimeTypes: Object.freeze(['image/png', 'image/jpeg', 'image/webp']),
  maxEncodedBytes: 1_500_000,
  maxWidth: 1_280,
  maxHeight: 720,
  periodicBaseDelayMs: 5_000,
  adaptiveDelayFactor: 1.25,
  maxAdaptiveDelayMs: 60_000,
  analysisTimeoutMs: 480_000,
  observationTtlMs: 120_000,
  maxSummaryChars: 800,
  maxConcurrentAnalyses: 1,
  captureMaxAgeMs: 5 * 60 * 1_000,
  captureMaxFutureSkewMs: 30 * 1_000,
};

module.exports = Object.freeze(visionConfig);
