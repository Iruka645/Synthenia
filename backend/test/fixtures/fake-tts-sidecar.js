const fs = require('fs');
const path = require('path');
const readline = require('readline');

const mode = process.env.TTS_FAKE_MODE || 'normal';
const delayMs = Number.parseInt(process.env.TTS_FAKE_DELAY_MS || '20', 10);
const audioRoot = process.env.TTS_AUDIO_ROOT;

function response(requestId, value) {
  process.stdout.write(`${JSON.stringify({ requestId, ...value })}\n`);
}

function writeMonoWav(outputName) {
  if (!audioRoot) throw new Error('Missing test audio root');
  fs.mkdirSync(audioRoot, { recursive: true });
  const sampleRate = 16000;
  const samples = 800;
  const dataBytes = samples * 2;
  const buffer = Buffer.alloc(44 + dataBytes);
  buffer.write('RIFF', 0, 'ascii');
  buffer.writeUInt32LE(buffer.length - 8, 4);
  buffer.write('WAVE', 8, 'ascii');
  buffer.write('fmt ', 12, 'ascii');
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36, 'ascii');
  buffer.writeUInt32LE(dataBytes, 40);
  fs.writeFileSync(path.join(audioRoot, outputName), buffer);
}

async function handle(message) {
  if (!message || typeof message.requestId !== 'string' || typeof message.type !== 'string') {
    process.stdout.write('{malformed\n');
    return;
  }
  if (message.type === 'load') {
    if (mode === 'load_hang') return;
    if (mode === 'load_fail') {
      response(message.requestId, { ok: false, state: 'failed', error: { code: 'SIDECAR_START_FAILED' } });
    } else {
      response(message.requestId, { ok: true, state: 'ready' });
    }
    return;
  }
  if (message.type === 'unload') {
    if (mode === 'unload_fail') {
      response(message.requestId, { ok: false, state: 'failed', error: { code: 'TTS_SWITCH_FAILED' } });
    } else {
      response(message.requestId, { ok: true, state: 'unavailable' });
    }
    return;
  }
  if (message.type === 'shutdown') {
    response(message.requestId, { ok: true, state: 'unavailable' });
    setImmediate(() => process.exit(0));
    return;
  }
  if (message.type !== 'synthesize') {
    response(message.requestId, { ok: false, state: 'failed', error: { code: 'SIDECAR_PROTOCOL_ERROR' } });
    return;
  }

  if (mode === 'hang') return;
  if (mode === 'crash') process.exit(2);
  if (mode === 'malformed') {
    process.stdout.write('{malformed\n');
    return;
  }
  if (mode === 'unexpected_field') {
    response(message.requestId, { ok: true, state: 'ready', output: message.outputName, extra: true });
    return;
  }
  if (mode === 'busy') {
    response(message.requestId, { ok: false, state: 'busy', error: { code: 'TTS_BUSY' } });
    return;
  }
  if (mode === 'invalid_wav') {
    fs.writeFileSync(path.join(audioRoot, message.outputName), 'not a wav');
    response(message.requestId, { ok: true, state: 'ready', output: message.outputName });
    return;
  }

  const finish = () => {
    writeMonoWav(message.outputName);
    response(message.requestId, {
      ok: true,
      state: 'ready',
      output: message.outputName,
      metrics: { durationMs: delayMs, audioDurationSeconds: 0.05, rtf: 0.4 },
    });
  };
  if (mode === 'late') setTimeout(finish, delayMs);
  else finish();
}

const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
input.on('line', (line) => {
  let message;
  try { message = JSON.parse(line); }
  catch { process.stdout.write('{malformed\n'); return; }
  handle(message).catch(() => process.exit(3));
});
