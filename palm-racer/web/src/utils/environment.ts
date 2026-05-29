/**
 * Platform detection utilities.
 *
 * Detects whether the app is running in the Android native shell (WebView)
 * or standalone in a browser. iOS browsers (mobile Safari) are supported
 * as standard Web clients — only Android ships a native WebView shell.
 */

export function isAndroid(): boolean {
  return /Android/i.test(navigator.userAgent);
}

export function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * Returns true if running inside the Android native WebView with JSBridge available.
 * Detection relies on the JSBridge object injected by the Android shell.
 */
export function isNative(): boolean {
  const win = window as unknown as Record<string, unknown>;
  // Android native shell injects window.JSBridge
  return typeof win.JSBridge === 'object';
}

export function isMobile(): boolean {
  return isAndroid() || isIOS();
}

export type Platform = 'android' | 'ios' | 'web';

export function getPlatform(): Platform {
  if (isAndroid()) return 'android';
  if (isIOS()) return 'ios';
  return 'web';
}
