export type {
  ObstacleKind,
  CollisionResponse,
  Obstacle,
  RoadConfig,
  DifficultyStageConfig,
  SpawnWeight,
} from './types';

export {
  SPAWN_WEIGHTS,
  DIFFICULTY_STAGES,
  CAR_HALF_W,
  CAR_HALF_D,
  SPAWN_Z,
  DESPAWN_Z,
  NPC_DODGE_SCORE,
  POOL_MAX_PER_KIND,
} from './types';

export { ObstaclePool, disposeMeshes } from './ObstaclePool';
export { ObstacleMeshFactory } from './ObstacleMeshFactory';
