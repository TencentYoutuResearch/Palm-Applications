import { describe, it, expect } from 'vitest';
import {
  MAX_RETRIES,
  RETRY_INTERVAL,
  CAMERA_TIMEOUT,
  SEARCH_TIMEOUT,
  STABILIZE_DELAY,
  ANTI_CHEAT_FAIL_THRESHOLD,
} from '../../config/platformConfig';

describe('platformConfig', () => {
  it('should have positive retry parameters', () => {
    expect(MAX_RETRIES).toBeGreaterThan(0);
    expect(RETRY_INTERVAL).toBeGreaterThan(0);
  });

  it('should have positive timeout values', () => {
    expect(CAMERA_TIMEOUT).toBeGreaterThan(0);
    expect(SEARCH_TIMEOUT).toBeGreaterThan(0);
  });

  it('should have different stabilize delays for native and web', () => {
    expect(STABILIZE_DELAY.native).toBeGreaterThan(0);
    expect(STABILIZE_DELAY.web).toBeGreaterThan(0);
    // Native cameras need more stabilization time
    expect(STABILIZE_DELAY.native).toBeGreaterThan(STABILIZE_DELAY.web);
  });

  it('should have positive anti-cheat threshold', () => {
    expect(ANTI_CHEAT_FAIL_THRESHOLD).toBeGreaterThanOrEqual(1);
  });
});
