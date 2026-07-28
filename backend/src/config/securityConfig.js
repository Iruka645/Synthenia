const mode = (process.env.SYNTHENIA_MODE || 'local').trim().toLowerCase();
const host = (process.env.HOST || '127.0.0.1').trim();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:6060,http://127.0.0.1:6060')
  .split(',').map(value => value.trim()).filter(Boolean);

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

if (!['local', 'lan', 'public'].includes(mode)) {
  throw new Error(`Invalid SYNTHENIA_MODE: ${mode}`);
}
if (mode === 'local' && ['0.0.0.0', '::'].includes(host)) {
  throw new Error('SYNTHENIA_MODE=local must bind to a loopback host');
}

module.exports = {
  mode,
  host,
  port: toPositiveInt(process.env.PORT, 4040),
  allowedOrigins,
  jsonLimit: process.env.MAX_JSON_BODY || '64kb',
  urlEncodedLimit: process.env.MAX_URLENCODED_BODY || '32kb',
  maxAudioBytes: toPositiveInt(process.env.MAX_AUDIO_UPLOAD_MB, 20) * 1024 * 1024,
  audioRetentionHours: toPositiveInt(process.env.AUDIO_RETENTION_HOURS, 24),
  uploadRetentionMinutes: toPositiveInt(process.env.UPLOAD_RETENTION_MINUTES, 15),
};
