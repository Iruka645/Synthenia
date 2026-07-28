import test from 'node:test'
import assert from 'node:assert/strict'
import {
  VISION_MODES,
  createVisionError,
  normalizeVisionError,
  normalizeVisionState
} from '../src/services/visionContracts.js'

test('vision contract mirrors public modes and normalizes safe errors', () => {
  assert.deepEqual(VISION_MODES, ['manual', 'periodic'])
  assert.deepEqual(normalizeVisionError(createVisionError('VISION_BUSY')), {
    code: 'VISION_BUSY',
    message: 'Screen analysis is already running.',
    retryable: true
  })
  assert.equal(normalizeVisionError(new Error('provider secret')).code, 'VISION_ANALYSIS_FAILED')
  assert.equal(normalizeVisionError(new Error('provider secret')).message.includes('provider'), false)
})

test('state normalization keeps payloads out of UI state', () => {
  const state = normalizeVisionState({
    status: 'analyzing',
    mode: 'periodic',
    active: true,
    inFlight: true,
    summary: 'SCREEN_SECRET',
    bytes: 'raw bytes'
  })
  assert.deepEqual(state, {
    status: 'analyzing',
    mode: 'periodic',
    active: true,
    inFlight: true,
    delayMs: null,
    outcome: null,
    errorCode: null
  })
  assert.equal(JSON.stringify(state).includes('SCREEN_SECRET'), false)
})
