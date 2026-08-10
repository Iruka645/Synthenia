import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  assertTTSProviderSelectable,
  canPreviewTTSProvider,
  dispatchTTSProviderSwitch,
  getSafeTTSErrorMessage,
  normalizeTTSProvider,
  normalizeTTSProviders,
} from '../src/services/ttsContracts.js';
import { createTTSPreviewOwner } from '../src/services/ttsPreviewOwner.js';

test('provider status normalization distinguishes legacy, installable, and blocked providers', () => {
  const providers = normalizeTTSProviders([
    { id: 'gtts', label: 'Google TTS', kind: 'legacy', state: 'ready', active: true },
    {
      id: 'jaitts-f5tts',
      label: 'JaiTTS F5-TTS',
      kind: 'neural',
      state: 'unavailable',
      installed: true,
      active: false,
    },
    {
      id: 'vachaspeech-0.6b',
      label: 'VachaSpeech',
      kind: 'neural',
      state: 'not_installed',
      installed: false,
      active: false,
    },
  ]);

  assert.equal(providers[0].installed, true);
  assert.equal(providers[0].selectable, true);
  assert.equal(providers[1].selectable, true);
  assert.equal(providers[1].statusLabel, 'พร้อมเริ่มระบบ');
  assert.equal(providers[2].selectable, false);
  assert.equal(providers[2].statusLabel, 'ยังไม่ได้ติดตั้ง');
});

test('invalid or contradictory provider states fail closed', () => {
  const unknownKind = normalizeTTSProvider({
    id: 'future-provider',
    label: 'Future',
    kind: 'remote',
    state: 'ready',
    installed: true,
  });
  assert.equal(unknownKind.selectable, false);

  const unknownState = normalizeTTSProvider({
    id: 'jaitts-f5tts',
    label: 'Jai',
    kind: 'neural',
    state: 'future_state',
    installed: true,
  });
  assert.equal(unknownState.state, 'unavailable');
  assert.equal(unknownState.selectable, false);

  const contradictory = normalizeTTSProvider({
    id: 'jaitts-f5tts',
    label: 'Jai',
    kind: 'neural',
    state: 'ready',
    installed: false,
  });
  assert.equal(contradictory.state, 'unavailable');
  assert.equal(contradictory.errorCode, 'TTS_INSTALL_INVALID');
  assert.equal(contradictory.selectable, false);
  assert.equal(contradictory.statusDetail.includes('ตรวจสอบ'), true);

  const reciprocal = normalizeTTSProvider({
    id: 'vachaspeech-0.6b',
    label: 'Vacha',
    kind: 'neural',
    state: 'not_installed',
    installed: true,
  });
  assert.equal(reciprocal.state, 'unavailable');
  assert.equal(reciprocal.errorCode, 'TTS_INSTALL_INVALID');
  assert.equal(reciprocal.selectable, false);
});

test('every neural installed-state combination enforces the bidirectional invariant', () => {
  const states = ['not_installed', 'unavailable', 'loading', 'ready', 'busy', 'failed'];
  for (const installed of [false, true]) {
    for (const state of states) {
      const provider = normalizeTTSProvider({
        id: 'jaitts-f5tts',
        kind: 'neural',
        state,
        installed,
      });
      const contradictory = installed ? state === 'not_installed' : state !== 'not_installed';
      assert.equal(
        provider.errorCode === 'TTS_INSTALL_INVALID',
        contradictory,
        `installed=${installed} state=${state}`,
      );
      if (contradictory) assert.equal(provider.selectable, false);
      if (installed && state === 'failed') assert.equal(provider.selectable, false);
    }
  }
});

test('provider collections are bounded, de-duplicated, and reject invalid identifiers', () => {
  const providers = normalizeTTSProviders([
    { id: '../escape', kind: 'legacy', state: 'ready' },
    { id: 'gtts', kind: 'legacy', state: 'ready' },
    { id: 'gtts', label: 'duplicate', kind: 'legacy', state: 'ready' },
    ...Array.from({ length: 20 }, (_, index) => ({
      id: `provider-${index}`,
      kind: 'legacy',
      state: 'ready',
    })),
  ]);
  assert.equal(providers.filter((provider) => provider.id === 'gtts').length, 1);
  assert.equal(providers.length <= 15, true);
  assert.equal(providers.some((provider) => provider.id === '../escape'), false);
});

test('selection and preview guards use normalized readiness', () => {
  const providers = normalizeTTSProviders([
    { id: 'gtts', kind: 'legacy', state: 'ready', active: true },
    {
      id: 'jaitts-f5tts',
      kind: 'neural',
      state: 'unavailable',
      installed: true,
      active: false,
    },
    {
      id: 'vachaspeech-0.6b',
      kind: 'neural',
      state: 'not_installed',
      installed: false,
      active: false,
    },
  ]);

  assert.equal(assertTTSProviderSelectable(providers, 'jaitts-f5tts').id, 'jaitts-f5tts');
  assert.throws(
    () => assertTTSProviderSelectable(providers, 'vachaspeech-0.6b'),
    (error) => error.code === 'TTS_NOT_INSTALLED',
  );
  assert.equal(canPreviewTTSProvider(providers, 'gtts'), true);
  assert.equal(canPreviewTTSProvider(providers, 'jaitts-f5tts'), false);
});

test('invalid normalized providers cannot dispatch a switch request', async () => {
  const providers = normalizeTTSProviders([{
    id: 'jaitts-f5tts',
    kind: 'neural',
    state: 'not_installed',
    installed: true,
  }]);
  let dispatchCount = 0;
  await assert.rejects(
    dispatchTTSProviderSwitch(providers, 'jaitts-f5tts', async () => {
      dispatchCount += 1;
    }),
    (error) => error.code === 'TTS_INSTALL_INVALID',
  );
  assert.equal(dispatchCount, 0);
});

test('known runtime start failures can be retried while unknown failures stay blocked', () => {
  const retryable = normalizeTTSProvider({
    id: 'jaitts-f5tts',
    kind: 'neural',
    state: 'failed',
    installed: true,
    errorCode: 'SIDECAR_START_FAILED',
  });
  const unknown = normalizeTTSProvider({
    id: 'vachaspeech-0.6b',
    kind: 'neural',
    state: 'failed',
    installed: true,
    errorCode: 'UNKNOWN_FAILURE',
  });
  assert.equal(retryable.selectable, true);
  assert.equal(unknown.selectable, false);
});

test('failed status needs a recognized retry code before switch dispatch', async () => {
  for (const errorCode of [undefined, '', 'X'.repeat(65), 'UNKNOWN_FAILURE']) {
    const providers = normalizeTTSProviders([{
      id: 'jaitts-f5tts',
      kind: 'neural',
      state: 'failed',
      installed: true,
      errorCode,
    }]);
    let dispatchCount = 0;
    assert.equal(providers[0].selectable, false);
    await assert.rejects(dispatchTTSProviderSwitch(
      providers,
      'jaitts-f5tts',
      async () => { dispatchCount += 1; },
    ));
    assert.equal(dispatchCount, 0);
  }
});

test('unknown errors never expose raw upstream messages', () => {
  const secret = new Error('D:\\private\\model path leaked');
  secret.code = 'UNKNOWN_UPSTREAM_FAILURE';
  const message = getSafeTTSErrorMessage(secret);
  assert.equal(message.includes('private'), false);
  assert.equal(getSafeTTSErrorMessage({ code: 'TTS_BUSY' }).includes('กรุณา'), true);
});

function readySnapshot() {
  return {
    currentProvider: 'gtts',
    providers: normalizeTTSProviders([{
      id: 'gtts',
      kind: 'legacy',
      state: 'ready',
      active: true,
    }]),
  };
}

test('preview owner rejects non-ready state before HTTP and ignores stale config providers', async () => {
  let snapshot = {
    currentProvider: 'jaitts-f5tts',
    providers: normalizeTTSProviders([{
      id: 'jaitts-f5tts',
      kind: 'neural',
      state: 'loading',
      installed: true,
      active: false,
    }]),
  };
  const requests = [];
  const owner = createTTSPreviewOwner({
    getSnapshot: () => snapshot,
    requestPreview: async (request) => {
      requests.push(request);
      return { audioUrl: '/audio/test.wav' };
    },
    createAudio: () => ({ play: async () => {}, pause: () => {} }),
  });

  await assert.rejects(
    owner.play({ text: 'blocked', providerId: 'stale-config-provider' }),
    (error) => error.code === 'TTS_NOT_READY',
  );
  assert.equal(requests.length, 0);

  snapshot = readySnapshot();
  await owner.play({ text: 'ready', providerId: 'stale-config-provider' });
  assert.equal(requests[0].providerId, 'gtts');
  owner.dispose();
});

test('preview owner aborts and pauses only the initiating source on cleanup', async () => {
  let pauseCount = 0;
  const playingStates = [];
  const owner = createTTSPreviewOwner({
    getSnapshot: readySnapshot,
    requestPreview: async () => ({ audioUrl: '/audio/test.wav' }),
    createAudio: () => ({
      play: async () => {},
      pause: () => { pauseCount += 1; },
      onended: null,
      onerror: null,
    }),
    onPlayingChange: (value) => playingStates.push(value),
  });

  await owner.play({ text: 'preview', source: 'voice-conversion-tab' });
  assert.equal(owner.stop('tts-selector'), false);
  assert.equal(pauseCount, 0);
  assert.equal(owner.stop('voice-conversion-tab'), true);
  assert.equal(pauseCount, 1);
  assert.deepEqual(playingStates, [true, false]);

  await owner.play({ text: 'preview', source: 'voice-conversion-tab' });
  owner.dispose();
  assert.equal(pauseCount, 2);
});

test('late audio.play completion rejects after stop or dispose without logging success', async () => {
  for (const action of ['stop', 'dispose']) {
    let resolvePlay;
    let markPlayStarted;
    let pauseCount = 0;
    const logs = [];
    const playingStates = [];
    const playStarted = new Promise((resolve) => { markPlayStarted = resolve; });
    const deferredPlay = new Promise((resolve) => { resolvePlay = resolve; });
    const owner = createTTSPreviewOwner({
      getSnapshot: readySnapshot,
      requestPreview: async () => ({ audioUrl: '/audio/deferred.wav' }),
      createAudio: () => ({
        play: () => {
          markPlayStarted();
          return deferredPlay;
        },
        pause: () => { pauseCount += 1; },
        onended: null,
        onerror: null,
      }),
      onPlayingChange: (value) => playingStates.push(value),
      log: (message) => logs.push(message),
    });

    const result = owner.play({ text: 'deferred', source: 'voice-conversion-tab' });
    await playStarted;
    if (action === 'stop') owner.stop('voice-conversion-tab');
    else owner.dispose();
    resolvePlay();
    await assert.rejects(result, (error) => error.code === 'TTS_ABORTED');
    assert.equal(pauseCount, 1);
    assert.equal(owner.isPlaying(), false);
    assert.deepEqual(logs, []);
    if (action === 'stop') assert.deepEqual(playingStates, [true, false]);
  }
});

test('preview owner exposes and logs only a safe error when transport details contain secrets', async () => {
  const sentinel = 'API_KEY_SENTINEL:D:\\private\\reference.wav:secret transcript';
  const rawError = new Error(sentinel);
  rawError.code = 'UNKNOWN_UPSTREAM_FAILURE';
  rawError.originalError = {
    config: { headers: { 'x-api-key': sentinel } },
    response: { data: sentinel },
  };
  const logs = [];
  const rendered = [];
  const owner = createTTSPreviewOwner({
    getSnapshot: readySnapshot,
    requestPreview: async () => { throw rawError; },
    createAudio: () => ({ play: async () => {}, pause: () => {} }),
    onError: (message) => rendered.push(message),
    log: (message) => logs.push(message),
  });

  let exposed;
  await assert.rejects(owner.play({ text: sentinel }), (error) => {
    exposed = error;
    return error.code === 'TTS_SYNTHESIS_FAILED';
  });
  const observable = JSON.stringify({
    logs,
    rendered,
    error: { message: exposed.message, code: exposed.code, keys: Object.keys(exposed) },
  });
  assert.equal(observable.includes('API_KEY_SENTINEL'), false);
  assert.equal(observable.includes('private'), false);
  assert.deepEqual(logs, ['[TTSPreview] failed code=TTS_SYNTHESIS_FAILED']);
});

test('reachable Voice Conversion preview has no direct HTTP, Audio, or raw-error path', () => {
  const tabSource = fs.readFileSync(
    new URL('../src/components/tabs/VoiceConversionTab.jsx', import.meta.url),
    'utf8',
  );
  const apiSource = fs.readFileSync(new URL('../src/services/api.js', import.meta.url), 'utf8');
  assert.equal(tabSource.includes('previewTTS'), false);
  assert.equal(tabSource.includes('new Audio'), false);
  assert.equal(tabSource.includes('originalError'), false);
  assert.equal(tabSource.includes('playTest(testText'), true);
  assert.equal(tabSource.includes('stopPreview(PREVIEW_SOURCE)'), true);
  assert.equal(apiSource.includes('normalizedError.originalError'), false);
});

test('each reachable selector has a stable source and source-scoped unmount cleanup', () => {
  const selectorSource = fs.readFileSync(
    new URL('../src/components/TTSProviderSelector.jsx', import.meta.url),
    'utf8',
  );
  const appSource = fs.readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
  const tabSource = fs.readFileSync(
    new URL('../src/components/tabs/TTSConfigTab.jsx', import.meta.url),
    'utf8',
  );
  assert.equal(selectorSource.includes('stopPreview(previewSource)'), true);
  assert.equal(selectorSource.includes("source: previewSource"), true);
  assert.equal(appSource.includes('previewSource="app-tts-selector"'), true);
  assert.equal(tabSource.includes('previewSource="control-panel-tts-selector"'), true);
  assert.notEqual('app-tts-selector', 'control-panel-tts-selector');
});
