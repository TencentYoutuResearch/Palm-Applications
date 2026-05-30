import { describe, it, expect } from 'vitest';
import {
  SPAWN_WEIGHTS,
  DIFFICULTY_STAGES,
  CAR_HALF_W,
  CAR_HALF_D,
  SPAWN_Z,
  DESPAWN_Z,
  NPC_DODGE_SCORE,
  POOL_MAX_PER_KIND,
} from '../types';

describe('obstacle/types constants', () => {
  describe('SPAWN_WEIGHTS', () => {
    it('should sum base probabilities to less than 1 (remainder = coin)', () => {
      const total = SPAWN_WEIGHTS.reduce((sum, w) => sum + w.base, 0);
      expect(total).toBeLessThan(1);
      expect(total).toBeGreaterThan(0);
    });

    it('should have all valid obstacle kinds', () => {
      const kinds = SPAWN_WEIGHTS.map((w) => w.kind);
      expect(kinds).toContain('npc');
      expect(kinds).toContain('barrier');
      expect(kinds).toContain('barrel');
      expect(kinds).toContain('boost');
      expect(kinds).toContain('heart');
    });

    it('should maintain probabilities < 1 at highest stage (stage 5)', () => {
      const stage = 5;
      const total = SPAWN_WEIGHTS.reduce((sum, w) => {
        let chance = w.base + stage * w.perStage;
        if (w.min !== undefined) chance = Math.max(w.min, chance);
        return sum + chance;
      }, 0);
      expect(total).toBeLessThan(1);
    });

    it('should have non-negative min where specified', () => {
      for (const w of SPAWN_WEIGHTS) {
        if (w.min !== undefined) {
          expect(w.min).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe('DIFFICULTY_STAGES', () => {
    it('should have strictly increasing time thresholds', () => {
      for (let i = 1; i < DIFFICULTY_STAGES.length; i++) {
        expect(DIFFICULTY_STAGES[i].timeThreshold).toBeGreaterThan(
          DIFFICULTY_STAGES[i - 1].timeThreshold,
        );
      }
    });

    it('should have strictly decreasing spawn intervals', () => {
      for (let i = 1; i < DIFFICULTY_STAGES.length; i++) {
        expect(DIFFICULTY_STAGES[i].spawnInterval).toBeLessThan(
          DIFFICULTY_STAGES[i - 1].spawnInterval,
        );
      }
    });

    it('should start at time 0', () => {
      expect(DIFFICULTY_STAGES[0].timeThreshold).toBe(0);
    });

    it('should have non-empty names and descriptions', () => {
      for (const stage of DIFFICULTY_STAGES) {
        expect(stage.name.length).toBeGreaterThan(0);
        expect(stage.description.length).toBeGreaterThan(0);
      }
    });
  });

  describe('collision and spawn constants', () => {
    it('should have positive car collision half-extents', () => {
      expect(CAR_HALF_W).toBeGreaterThan(0);
      expect(CAR_HALF_D).toBeGreaterThan(0);
    });

    it('should spawn behind camera and despawn behind player', () => {
      expect(SPAWN_Z).toBeLessThan(0);
      expect(DESPAWN_Z).toBeGreaterThan(0);
    });

    it('should have positive dodge score', () => {
      expect(NPC_DODGE_SCORE).toBeGreaterThan(0);
    });

    it('should have positive pool limit', () => {
      expect(POOL_MAX_PER_KIND).toBeGreaterThan(0);
    });
  });
});
