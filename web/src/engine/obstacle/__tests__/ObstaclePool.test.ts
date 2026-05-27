import { describe, it, expect } from 'vitest';
import { ObstaclePool, disposeMeshes } from '../ObstaclePool';
import { POOL_MAX_PER_KIND } from '../types';
import type { Obstacle, ObstacleKind } from '../types';

/** Create a minimal mock obstacle for pool testing. */
function makeMockObstacle(kind: ObstacleKind, overrides?: Partial<Obstacle>): Obstacle {
  let enabled = true;
  let disposed = false;
  const mockMesh = {
    isDisposed: () => disposed,
    setEnabled: (v: boolean) => { enabled = v; },
    dispose: () => { disposed = true; },
    // Allow test to read state
    get _enabled() { return enabled; },
  } as any;

  return {
    kind,
    mesh: mockMesh,
    extraMeshes: [],
    x: 0, z: 0,
    halfW: 0.5, halfD: 0.5,
    selfSpeed: 0,
    collected: false,
    coin: kind === 'coin',
    boost: kind === 'boost',
    heal: kind === 'heart',
    slowdown: kind === 'barrel',
    damage: kind === 'npc' || kind === 'barrier',
    spinAngle: 0,
    bobPhase: 0,
    ...overrides,
  };
}

describe('ObstaclePool', () => {
  it('should return null when pool is empty', () => {
    const pool = new ObstaclePool();
    expect(pool.acquire('coin')).toBeNull();
    expect(pool.acquire('npc')).toBeNull();
  });

  it('should release and acquire an obstacle', () => {
    const pool = new ObstaclePool();
    const obs = makeMockObstacle('coin');

    const released = pool.release(obs);
    expect(released).toBe(true);

    const acquired = pool.acquire('coin');
    expect(acquired).not.toBeNull();
    expect(acquired!.kind).toBe('coin');
    expect(acquired!.collected).toBe(false);
    expect(acquired!.spinAngle).toBe(0);
  });

  it('should not mix obstacle kinds', () => {
    const pool = new ObstaclePool();
    pool.release(makeMockObstacle('coin'));

    expect(pool.acquire('npc')).toBeNull();
    expect(pool.acquire('coin')).not.toBeNull();
  });

  it('should refuse release when pool is full', () => {
    const pool = new ObstaclePool();

    // Fill pool to max
    for (let i = 0; i < POOL_MAX_PER_KIND; i++) {
      expect(pool.release(makeMockObstacle('barrel'))).toBe(true);
    }

    // Pool full — should return false
    expect(pool.release(makeMockObstacle('barrel'))).toBe(false);
  });

  it('should disable mesh on release and re-enable on acquire', () => {
    const pool = new ObstaclePool();
    const obs = makeMockObstacle('boost');

    pool.release(obs);
    // After release, mesh should be disabled
    expect((obs.mesh as any)._enabled).toBe(false);

    const acquired = pool.acquire('boost');
    // After acquire, mesh should be re-enabled
    expect((acquired!.mesh as any)._enabled).toBe(true);
  });

  it('should dispose all pooled meshes on dispose()', () => {
    const pool = new ObstaclePool();
    const obs1 = makeMockObstacle('coin');
    const obs2 = makeMockObstacle('coin');

    pool.release(obs1);
    pool.release(obs2);
    pool.dispose();

    expect(obs1.mesh.isDisposed()).toBe(true);
    expect(obs2.mesh.isDisposed()).toBe(true);

    // Pool should be empty after dispose
    expect(pool.acquire('coin')).toBeNull();
  });
});

describe('disposeMeshes', () => {
  it('should dispose mesh and all extra meshes', () => {
    let meshDisposed = false;
    let extra1Disposed = false;
    let extra2Disposed = false;

    const obs = makeMockObstacle('npc', {
      mesh: {
        isDisposed: () => meshDisposed,
        dispose: () => { meshDisposed = true; },
        setEnabled: () => {},
      } as any,
      extraMeshes: [
        {
          isDisposed: () => extra1Disposed,
          dispose: () => { extra1Disposed = true; },
          setEnabled: () => {},
        } as any,
        {
          isDisposed: () => extra2Disposed,
          dispose: () => { extra2Disposed = true; },
          setEnabled: () => {},
        } as any,
      ],
    });

    disposeMeshes(obs);
    expect(meshDisposed).toBe(true);
    expect(extra1Disposed).toBe(true);
    expect(extra2Disposed).toBe(true);
  });

  it('should not throw on already-disposed meshes', () => {
    const obs = makeMockObstacle('coin', {
      mesh: {
        isDisposed: () => true,
        dispose: () => {},
        setEnabled: () => {},
      } as any,
    });

    expect(() => disposeMeshes(obs)).not.toThrow();
  });
});
