/**
 * Shared types for the road system modules.
 */

import { Mesh } from '@babylonjs/core/Meshes/mesh';

/** Configuration parameters for the road system. */
export interface RoadConfig {
  /** Road width in 3D units. Default: 12. */
  width: number;
  /** Number of lanes. Default: 3. */
  laneCount: number;
  /** Visible road segment length. Default: 200. */
  segmentLength: number;
}

/** Default road configuration matching the original Game3D values. */
export const kDefaultRoadConfig: Readonly<RoadConfig> = {
  width: 12,
  laneCount: 3,
  segmentLength: 200,
};

/** A roadside object that cycles along the Z axis. */
export interface RoadsideEntry {
  mesh: Mesh;
  initZ: number;
}
