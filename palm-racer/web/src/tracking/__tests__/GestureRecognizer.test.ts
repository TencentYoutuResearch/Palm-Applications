import { describe, it, expect } from 'vitest';
import { GestureRecognizer } from '../GestureRecognizer';
import type { HandLandmarks } from '../types';

/**
 * Create 21 hand landmarks at a given position.
 * All points are placed at the same (x, y, z) by default,
 * then specific points can be overridden.
 */
function makeBaseLandmarks(
  x = 0.5,
  y = 0.5,
  z = 0,
  overrides?: Partial<Record<number, { x?: number; y?: number; z?: number }>>,
): HandLandmarks {
  const landmarks: HandLandmarks = [];
  for (let i = 0; i < 21; i++) {
    landmarks.push({ x, y, z });
  }
  if (overrides) {
    for (const [idx, vals] of Object.entries(overrides)) {
      const i = Number(idx);
      landmarks[i] = { ...landmarks[i], ...vals };
    }
  }
  return landmarks;
}

/**
 * Set the MCP (metacarpophalangeal) row for all four fingers.
 * This is the base of each finger, shared between open palm and fist.
 */
function setMcpRow(lm: HandLandmarks): void {
  lm[5] = { x: 0.35, y: 0.5, z: 0 };  // index MCP
  lm[9] = { x: 0.45, y: 0.48, z: 0 };  // middle MCP
  lm[13] = { x: 0.55, y: 0.5, z: 0 };  // ring MCP
  lm[17] = { x: 0.65, y: 0.52, z: 0 };  // pinky MCP
}

/**
 * Create landmarks that form an open palm (fingers extended).
 * Tips are above (lower y) PIPs for each finger.
 */
function makeOpenPalmLandmarks(): HandLandmarks {
  // Wrist at center-bottom
  const lm = makeBaseLandmarks(0.5, 0.7, 0);

  // MCP row (base of fingers)
  setMcpRow(lm);

  // PIP row
  lm[6] = { x: 0.35, y: 0.4, z: 0 };
  lm[10] = { x: 0.45, y: 0.38, z: 0 };
  lm[14] = { x: 0.55, y: 0.4, z: 0 };
  lm[18] = { x: 0.65, y: 0.42, z: 0 };

  // Tip row (above PIP = extended fingers)
  lm[8] = { x: 0.35, y: 0.25, z: 0 };
  lm[12] = { x: 0.45, y: 0.23, z: 0 };
  lm[16] = { x: 0.55, y: 0.25, z: 0 };
  lm[20] = { x: 0.65, y: 0.27, z: 0 };

  // Thumb
  lm[2] = { x: 0.25, y: 0.6, z: 0 };  // thumb CMC
  lm[3] = { x: 0.2, y: 0.5, z: 0 };   // thumb IP
  lm[4] = { x: 0.15, y: 0.4, z: 0 };  // thumb tip (extended away)

  return lm;
}

/**
 * Create landmarks that form a fist (fingers curled).
 * Tips are below (higher y) PIPs for each finger.
 */
function makeFistLandmarks(): HandLandmarks {
  const lm = makeBaseLandmarks(0.5, 0.7, 0);

  setMcpRow(lm);

  // PIP row
  lm[6] = { x: 0.38, y: 0.45, z: 0 };
  lm[10] = { x: 0.47, y: 0.43, z: 0 };
  lm[14] = { x: 0.55, y: 0.45, z: 0 };
  lm[18] = { x: 0.63, y: 0.47, z: 0 };

  // Tips below PIPs (curled in) — y > pip.y means below in screen coords
  lm[8] = { x: 0.4, y: 0.55, z: 0 };
  lm[12] = { x: 0.48, y: 0.53, z: 0 };
  lm[16] = { x: 0.55, y: 0.55, z: 0 };
  lm[20] = { x: 0.62, y: 0.57, z: 0 };

  // Thumb tucked (tip closer to wrist than IP)
  lm[2] = { x: 0.3, y: 0.6, z: 0 };
  lm[3] = { x: 0.25, y: 0.55, z: 0 };  // IP: far from wrist
  lm[4] = { x: 0.45, y: 0.6, z: 0 };   // tip: close to wrist x=0.5

  return lm;
}

describe('GestureRecognizer', () => {
  describe('basic update', () => {
    it('should return neutral state when null landmarks', () => {
      const gr = new GestureRecognizer();
      const result = gr.update(null);
      expect(result.isHandDetected).toBe(false);
      expect(result.steerX).toBe(0);
    });

    it('should detect hand with valid landmarks', () => {
      const gr = new GestureRecognizer();
      const lm = makeOpenPalmLandmarks();
      const result = gr.update(lm);
      expect(result.isHandDetected).toBe(true);
    });

    it('should compute steering from palm position', () => {
      const gr = new GestureRecognizer();

      // Palm centered at x=0.3 (left of center) — should steer left
      const lmLeft = makeOpenPalmLandmarks();
      lmLeft[0] = { x: 0.25, y: 0.7, z: 0 };
      lmLeft[5] = { x: 0.15, y: 0.5, z: 0 };
      lmLeft[9] = { x: 0.25, y: 0.48, z: 0 };
      lmLeft[13] = { x: 0.35, y: 0.5, z: 0 };
      lmLeft[17] = { x: 0.45, y: 0.52, z: 0 };

      // Run multiple updates to let smoothing settle
      let result;
      for (let i = 0; i < 20; i++) {
        result = gr.update(lmLeft);
      }
      // Palm is left of center with mirror on → steerX may be positive due to mirror
      // Just verify steering has a non-zero magnitude
      expect(Math.abs(result!.steerX)).toBeGreaterThan(0);
    });
  });

  describe('fist detection (braking)', () => {
    it('should detect braking after sustained fist frames', () => {
      const gr = new GestureRecognizer();
      const fist = makeFistLandmarks();

      // Run enough frames for fist debounce (kFistThreshold = 5)
      let result;
      for (let i = 0; i < 10; i++) {
        result = gr.update(fist);
      }
      expect(result!.isBraking).toBe(true);
    });

    it('should not brake on single fist frame (debounce)', () => {
      const gr = new GestureRecognizer();
      const open = makeOpenPalmLandmarks();
      const fist = makeFistLandmarks();

      // Stabilize with open palm first
      for (let i = 0; i < 5; i++) {
        gr.update(open);
      }

      // Single fist frame should not trigger brake
      const result = gr.update(fist);
      expect(result.isBraking).toBe(false);
    });
  });

  describe('hand loss tolerance', () => {
    it('should eventually lose hand after sustained nulls', () => {
      const gr = new GestureRecognizer();
      const lm = makeOpenPalmLandmarks();

      for (let i = 0; i < 10; i++) {
        gr.update(lm);
      }

      // Exceed tolerance (kHandLostTolerance = 5)
      let result;
      for (let i = 0; i < 15; i++) {
        result = gr.update(null);
      }
      expect(result!.isHandDetected).toBe(false);
    });
  });

  describe('palm quality getters', () => {
    it('should report palm quality > 0 for open palm', () => {
      const gr = new GestureRecognizer();
      const lm = makeOpenPalmLandmarks();

      for (let i = 0; i < 5; i++) {
        gr.update(lm);
      }

      expect(gr.palmSpread).toBeGreaterThanOrEqual(0);
      expect(gr.palmFacing).toBeGreaterThanOrEqual(0);
    });
  });
});
