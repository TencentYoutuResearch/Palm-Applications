import { describe, it, expect, vi } from 'vitest';
import { withTimeout } from '../promises';

describe('withTimeout', () => {
  it('should resolve when promise completes before timeout', async () => {
    const result = await withTimeout(
      Promise.resolve('ok'),
      1000,
      'timeout',
    );
    expect(result).toBe('ok');
  });

  it('should reject when timeout fires before promise', async () => {
    const neverResolve = new Promise<string>(() => {});
    await expect(
      withTimeout(neverResolve, 50, 'custom timeout message'),
    ).rejects.toThrow('custom timeout message');
  });

  it('should resolve with correct value when promise resolves fast', async () => {
    const delayed = new Promise<number>((resolve) => {
      setTimeout(() => resolve(42), 10);
    });
    const result = await withTimeout(delayed, 1000, 'timeout');
    expect(result).toBe(42);
  });

  it('should reject when promise rejects before timeout', async () => {
    const failing = Promise.reject(new Error('original error'));
    await expect(
      withTimeout(failing, 1000, 'timeout'),
    ).rejects.toThrow('original error');
  });
});
