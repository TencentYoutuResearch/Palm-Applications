/**
 * @file promises.ts
 * @description Shared promise utility functions.
 *
 * Extracted from NativePlatform.ts to enable reuse across platform
 * implementations and other modules that need timeout racing.
 */

/**
 * Race a promise against a timeout.
 *
 * @param promise - The original promise to race.
 * @param ms - Timeout in milliseconds.
 * @param msg - Error message when timeout is reached.
 * @returns The resolved value of the original promise.
 * @throws Error with the given message if the timeout fires first.
 */
export function withTimeout<T>(promise: Promise<T>, ms: number, msg: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms)),
  ]);
}
