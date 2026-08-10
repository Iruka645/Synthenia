const PROVIDER_STATES = new Set([
  'not_installed',
  'unavailable',
  'loading',
  'ready',
  'busy',
  'failed',
]);

const PROVIDER_KINDS = new Set(['legacy', 'neural']);
const RETRYABLE_SELECTION_ERRORS = new Set([
  'SIDECAR_START_FAILED',
  'SIDECAR_EXITED',
  'TTS_SWITCH_FAILED',
  'TTS_TIMEOUT',
]);

const STATUS_COPY = Object.freeze({
  not_installed: {
    label: 'ยังไม่ได้ติดตั้ง',
    detail: 'ต้องติดตั้งและตรวจสอบไฟล์โมเดลก่อนจึงจะเลือกได้',
  },
  unavailable: {
    label: 'พร้อมเริ่มระบบ',
    detail: 'ติดตั้งแล้ว และจะโหลดโมเดลเมื่อเลือกใช้งาน',
  },
  loading: {
    label: 'กำลังโหลด',
    detail: 'กำลังโหลดโมเดลเข้าสู่หน่วยความจำ',
  },
  ready: {
    label: 'พร้อมใช้งาน',
    detail: 'พร้อมสังเคราะห์เสียง',
  },
  busy: {
    label: 'กำลังทำงาน',
    detail: 'กำลังสังเคราะห์เสียง กรุณารอสักครู่',
  },
  failed: {
    label: 'เริ่มระบบไม่สำเร็จ',
    detail: 'สามารถลองเลือก provider นี้ใหม่อีกครั้ง',
  },
});

const ERROR_COPY = Object.freeze({
  TTS_NOT_INSTALLED: 'ยังไม่ได้ติดตั้ง provider นี้',
  TTS_INSTALL_INVALID: 'ไฟล์ติดตั้งหรือหลักฐานความถูกต้องยังไม่ผ่านการตรวจสอบ',
  TTS_NOT_READY: 'provider ยังไม่พร้อมสังเคราะห์เสียง',
  TTS_BUSY: 'ระบบเสียงกำลังทำงาน กรุณารอสักครู่',
  TTS_TIMEOUT: 'provider ใช้เวลาตอบสนองนานเกินกำหนด',
  TTS_UNKNOWN_PROVIDER: 'ไม่พบ provider ที่เลือก',
  TTS_SWITCH_FAILED: 'ไม่สามารถสลับ provider ได้',
  TTS_PERSIST_FAILED: 'สลับ provider ไม่สำเร็จและคืนค่าเดิมแล้ว',
  TTS_SYNTHESIS_FAILED: 'ไม่สามารถสร้างเสียงทดสอบได้',
  TTS_INVALID_INPUT: 'ข้อความทดสอบไม่ถูกต้อง',
  TTS_ABORTED: 'ยกเลิกการทดสอบเสียงแล้ว',
  SIDECAR_START_FAILED: 'ไม่สามารถเริ่มระบบของ provider ได้',
  SIDECAR_PROTOCOL_ERROR: 'provider ส่งข้อมูลตอบกลับไม่ถูกต้อง',
  SIDECAR_EXITED: 'provider หยุดทำงานระหว่างสร้างเสียง',
});

function cleanText(value, fallback, maxLength = 80) {
  if (typeof value !== 'string') return fallback;
  const clean = value.trim();
  if (!clean || clean.length > maxLength) return fallback;
  return clean;
}

function unavailableCopy(errorCode) {
  if (errorCode === 'TTS_INSTALL_INVALID') {
    return {
      label: 'ติดตั้งไม่สมบูรณ์',
      detail: ERROR_COPY.TTS_INSTALL_INVALID,
    };
  }
  return STATUS_COPY.unavailable;
}

export function normalizeTTSProvider(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = cleanText(raw.id, '', 64);
  if (!id || !/^[a-z0-9][a-z0-9.-]*$/.test(id)) return null;

  const kind = PROVIDER_KINDS.has(raw.kind) ? raw.kind : 'unknown';
  const stateKnown = PROVIDER_STATES.has(raw.state);
  const reportedState = stateKnown ? raw.state : 'unavailable';
  const reportedErrorCode = cleanText(raw.errorCode, '', 64) || undefined;
  const installed = kind === 'legacy' ? true : raw.installed === true;
  const installationMismatch = kind === 'neural' && (
    (!installed && reportedState !== 'not_installed')
    || (installed && reportedState === 'not_installed')
  );
  const errorCode = reportedErrorCode
    || (installationMismatch ? 'TTS_INSTALL_INVALID' : undefined)
    || (!stateKnown ? 'TTS_NOT_READY' : undefined);
  const state = installationMismatch
    ? 'unavailable'
    : reportedState;
  const active = raw.active === true;
  const selectionErrorAllowed = state === 'failed'
    ? RETRYABLE_SELECTION_ERRORS.has(errorCode)
    : !errorCode;
  const copy = state === 'unavailable'
    ? unavailableCopy(errorCode)
    : state === 'failed' && !selectionErrorAllowed
      ? {
        label: 'ระบบหยุดทำงาน',
        detail: 'ต้องรีเฟรชสถานะหรือตรวจสอบระบบก่อนลองใหม่',
      }
      : STATUS_COPY[state];
  const selectable = kind === 'legacy'
    ? state === 'ready'
    : kind === 'neural'
      && installed
      && selectionErrorAllowed
      && !['loading', 'busy'].includes(state);

  return Object.freeze({
    id,
    label: cleanText(raw.label, id, 80),
    kind,
    state,
    installed,
    active,
    errorCode,
    selectable,
    statusLabel: copy.label,
    statusDetail: copy.detail,
  });
}

export function normalizeTTSProviders(rawProviders) {
  if (!Array.isArray(rawProviders)) return [];
  const seen = new Set();
  const normalized = [];
  for (const raw of rawProviders.slice(0, 16)) {
    const provider = normalizeTTSProvider(raw);
    if (!provider || seen.has(provider.id)) continue;
    seen.add(provider.id);
    normalized.push(provider);
  }
  return normalized;
}

export function findTTSProvider(providers, providerId) {
  if (!Array.isArray(providers)) return null;
  return providers.find((provider) => provider.id === providerId) || null;
}

export function assertTTSProviderSelectable(providers, providerId) {
  const provider = findTTSProvider(providers, providerId);
  if (!provider || !provider.selectable) {
    const error = new Error(provider?.statusDetail || ERROR_COPY.TTS_UNKNOWN_PROVIDER);
    error.code = provider?.errorCode || (provider?.state === 'not_installed'
      ? 'TTS_NOT_INSTALLED'
      : 'TTS_NOT_READY');
    throw error;
  }
  return provider;
}

export async function dispatchTTSProviderSwitch(providers, providerId, dispatch) {
  assertTTSProviderSelectable(providers, providerId);
  if (typeof dispatch !== 'function') throw new TypeError('TTS switch dispatcher is required');
  return dispatch(providerId);
}

export function canPreviewTTSProvider(providers, providerId) {
  const provider = findTTSProvider(providers, providerId);
  return provider?.active === true && provider.state === 'ready';
}

export function getSafeTTSErrorMessage(error, fallback = 'ระบบเสียงไม่สามารถทำรายการนี้ได้') {
  const code = cleanText(error?.code, '', 64);
  return ERROR_COPY[code] || fallback;
}

export function getSafeTTSErrorCode(error, fallback = 'UNKNOWN') {
  const code = cleanText(error?.code, '', 64);
  return Object.hasOwn(ERROR_COPY, code) ? code : fallback;
}

export function toSafeTTSError(error, fallbackCode = 'TTS_SYNTHESIS_FAILED') {
  const code = getSafeTTSErrorCode(error, fallbackCode);
  const safeError = new Error(ERROR_COPY[code] || ERROR_COPY.TTS_SYNTHESIS_FAILED);
  safeError.code = code;
  if (Number.isInteger(error?.status)) safeError.status = error.status;
  return safeError;
}

export { PROVIDER_STATES };
