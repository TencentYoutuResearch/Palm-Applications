/**
 * ObstaclePool - Object pool for reusing obstacle meshes.
 *
 * Disables meshes on return instead of disposing them, and re-enables
 * on acquire. Falls back to disposal when the pool is full.
 */

import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Obstacle, ObstacleKind } from './types';
import { POOL_MAX_PER_KIND } from './types';

export class ObstaclePool {
  private pool: Map<ObstacleKind, Obstacle[]> = new Map();

  /** Try to acquire an obstacle from the pool, or return null. */
  acquire(kind: ObstacleKind): Obstacle | null {
    const bucket = this.pool.get(kind);
    if (bucket && bucket.length > 0) {
      const obs = bucket.pop()!;
      obs.collected = false;
      obs.spinAngle = 0;
      obs.bobPhase = Math.random() * Math.PI * 2;
      // Re-enable meshes
      if (obs.mesh && !obs.mesh.isDisposed()) {
        obs.mesh.setEnabled(true);
      }
      for (const m of obs.extraMeshes) {
        if (m && !m.isDisposed()) {
          m.setEnabled(true);
        }
      }
      return obs;
    }
    return null;
  }

  /** Return an obstacle to the pool (disable meshes instead of disposing). */
  release(obs: Obstacle): boolean {
    let bucket = this.pool.get(obs.kind);
    if (!bucket) {
      bucket = [];
      this.pool.set(obs.kind, bucket);
    }
    if (bucket.length >= POOL_MAX_PER_KIND) {
      // Pool full -> caller should dispose
      return false;
    }
    if (obs.mesh && !obs.mesh.isDisposed()) {
      obs.mesh.setEnabled(false);
    }
    for (const m of obs.extraMeshes) {
      if (m && !m.isDisposed()) {
        m.setEnabled(false);
      }
    }
    obs.collected = false;
    bucket.push(obs);
    return true;
  }

  /** Dispose all pooled meshes and clear the pool. */
  dispose(): void {
    this.pool.forEach((bucket) => {
      for (const obs of bucket) {
        disposeMeshes(obs);
      }
    });
    this.pool.clear();
  }
}

/** Dispose an obstacle's mesh and all extra meshes. */
export function disposeMeshes(obs: Obstacle): void {
  if (obs.mesh && !obs.mesh.isDisposed()) {
    obs.mesh.dispose();
  }
  for (const m of obs.extraMeshes) {
    if (m && !m.isDisposed()) {
      m.dispose();
    }
  }
}
