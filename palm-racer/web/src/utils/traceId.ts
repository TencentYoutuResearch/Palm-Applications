/**
 * Trace ID generator for HTTP requests.
 *
 * Produces a 32-char lower-case hex string (UUID v4 without dashes),
 * matching the backend convention used in palm.service.impl.go:
 *   strings.ReplaceAll(uuid.New().String(), "-", "")
 *
 * Safe in all browsers / WebViews: falls back to Math.random when
 * crypto.randomUUID / crypto.getRandomValues are unavailable.
 */

function fromRandomUUID(): string | null {
  const c: Crypto | undefined = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === 'function') {
    return c.randomUUID().replace(/-/g, '');
  }
  return null;
}

function fromGetRandomValues(): string | null {
  const c: Crypto | undefined = (globalThis as any).crypto;
  if (!c || typeof c.getRandomValues !== 'function') return null;
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  // RFC 4122 v4 bits (not strictly required for a trace id, but keeps
  // the value distinguishable as a v4 uuid).
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function fromMathRandom(): string {
  let hex = '';
  for (let i = 0; i < 32; i++) {
    hex += Math.floor(Math.random() * 16).toString(16);
  }
  return hex;
}

/** Generate a new trace id (32-char lower-case hex). */
export function generateTraceId(): string {
  return fromRandomUUID() ?? fromGetRandomValues() ?? fromMathRandom();
}
