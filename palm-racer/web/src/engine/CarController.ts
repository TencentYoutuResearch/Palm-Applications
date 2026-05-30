/**
 * CarController - Car state management and physics simulation.
 *
 * Extracts the car physics from the original game3d.js, including:
 * - LaFerrari-inspired acceleration curves (963 hp + electric motor assist)
 * - Carbon-ceramic braking model
 * - Steering tilt and invincibility logic
 *
 * All physics values are preserved exactly from the original implementation.
 */

/** Full car state exposed for rendering and game logic. */
export interface CarState {
  /** Lateral position on the road (-halfRoad .. halfRoad). */
  x: number;
  /** Current speed in km/h. */
  speed: number;
  /** Target speed in km/h (set by input). */
  targetSpeed: number;
  /** Maximum speed in km/h (LaFerrari >350). */
  maxSpeed: number;
  /** Steering tilt angle (radians, small values). */
  tilt: number;
  /** Whether the car is currently invincible after a collision. */
  invincible: boolean;
  /** Remaining invincibility time in seconds. */
  invincibleTimer: number;
}

/** Linear interpolation helper. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp value to [min, max]. */
function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/**
 * CarController manages the car physics state and update logic.
 *
 * Each frame, call `update()` with delta time and input values.
 * The controller modifies `state` in place, which can then be read
 * by the renderer (CarModel) and game logic.
 */
export class CarController {
  state: CarState;

  /** Collision push force applied externally (decays over time). */
  private collisionPush_: number = 0;

  constructor() {
    this.state = {
      x: 0,
      speed: 0,
      targetSpeed: 0,
      maxSpeed: 350, // LaFerrari top speed >350 km/h
      tilt: 0,
      invincible: false,
      invincibleTimer: 0,
    };
  }

  /**
   * Update car physics for one frame.
   *
   * @param dt - Delta time in seconds (should be clamped to <= 0.05).
   * @param steerX - Target lateral position in road-space units.
   *   When NaN or undefined, the car coasts to a stop (no hand detected).
   * @param targetSpeed - Desired target speed in km/h from input.
   *   Negative value means no update to target speed.
   * @param isBraking - Whether the brake (fist gesture) is active.
   * @param halfRoad - Half road width minus car body margin (e.g. roadWidth/2 - 1.2).
   */
  update(
    dt: number,
    steerX: number | undefined,
    targetSpeed: number,
    isBraking: boolean,
    halfRoad: number,
  ): void {
    const car = this.state;

    // --- Steering / lateral position ---
    if (steerX !== undefined && !Number.isNaN(steerX)) {
      const prevX = car.x;
      // Steering follow — works during braking too (brake + steer is realistic)
      car.x = lerp(car.x, steerX, isBraking ? 0.12 : 0.18);

      const dx = car.x - prevX;
      if (!isBraking) {
        // Normal: slight lean during lane changes
        car.tilt = lerp(car.tilt, clamp(dx * 1.2, -0.08, 0.08), 0.12);
      } else {
        // Braking: tilt returns to zero quickly (body pitches forward, not sideways)
        car.tilt = lerp(car.tilt, 0, 0.15);
      }

      // Update target speed from input
      if (targetSpeed >= 0) {
        car.targetSpeed = targetSpeed;
      }
    } else {
      // No hand detected: coast to stop
      car.tilt = lerp(car.tilt, 0, 0.1);
      car.targetSpeed = Math.max(0, car.targetSpeed - 60 * dt); // -60 km/h per second
      // Extra deceleration to ensure speed drops noticeably
      const noHandDecel = 30 + car.speed * 0.08; // 30 base + speed-proportional
      car.speed = Math.max(0, car.speed - noHandDecel * dt);
    }

    // --- Speed physics (LaFerrari performance model) ---
    // 0-100: ~3.0s, 0-200: ~7.0s, 0-300: ~15.0s, top: 350 km/h
    // 100-0 brake: ~2.5s, 300-0 brake: ~8s
    if (isBraking) {
      // Braking: LaFerrari carbon-ceramic brakes
      // Real data: 100-0 ~2.3s (~43 km/h/s), ~1.2g deceleration
      const brakeDecel = 43; // base braking deceleration km/h/s
      const aeroAssist = car.speed > 200 ? (car.speed - 200) * 0.02 : 0;
      car.speed = Math.max(0, car.speed - (brakeDecel + aeroAssist) * dt);
      if (car.speed < 3) {
        car.speed = 0;
      }
      car.targetSpeed = car.speed;
    } else if (car.targetSpeed > car.speed) {
      // Acceleration: LaFerrari 963 hp + electric motor assist
      // Low-speed torque burst (electric assist), mid-range sustained, high-speed aero drag
      const speed = car.speed;
      const maxSpd = car.maxSpeed;
      let accel: number; // km/h per second

      if (speed < 100) {
        // 0-100: ~3s -> avg ~33 km/h/s, higher initial torque
        accel = 38 - speed * 0.06; // 38 -> 32 km/h/s
      } else if (speed < 200) {
        // 100-200: ~4s -> avg ~25 km/h/s
        accel = 28 - (speed - 100) * 0.05; // 28 -> 23 km/h/s
      } else if (speed < 300) {
        // 200-300: ~8s -> avg ~12.5 km/h/s (aero drag proportional to v^2)
        accel = 18 - (speed - 200) * 0.08; // 18 -> 10 km/h/s
      } else {
        // 300-350: top speed zone, extremely slow acceleration
        accel = 6 * (1 - (speed - 300) / (maxSpd - 300)); // 6 -> 0 km/h/s
      }

      accel = Math.max(0.5, accel); // minimum acceleration
      const newSpeed = car.speed + accel * dt;
      // Do not exceed target speed or max speed
      car.speed = Math.min(newSpeed, car.targetSpeed, maxSpd);
    } else {
      // Throttle released: natural deceleration (engine braking + rolling resistance + aero drag)
      const speed = car.speed;
      const engineBrake = 5; // low-speed rolling resistance ~5 km/h/s
      const aeroDrag = speed > 100 ? (speed - 100) * 0.03 : 0;
      const totalDecel = engineBrake + aeroDrag;
      const newSpeed = car.speed - totalDecel * dt;
      car.speed = Math.max(newSpeed, car.targetSpeed, 0);
    }

    // --- Collision push (smooth decay) ---
    if (this.collisionPush_ !== 0) {
      car.x += this.collisionPush_ * dt * 8;
      this.collisionPush_ *= 0.9;
      if (Math.abs(this.collisionPush_) < 0.01) {
        this.collisionPush_ = 0;
      }
    }

    // --- Clamp to road bounds ---
    car.x = clamp(car.x, -halfRoad, halfRoad);

    // --- Invincibility timer ---
    if (car.invincible) {
      car.invincibleTimer -= dt;
      if (car.invincibleTimer <= 0) {
        car.invincible = false;
        car.invincibleTimer = 0;
      }
    }
  }

  /**
   * Trigger invincibility after taking damage.
   *
   * @param duration - Invincibility duration in seconds (default 2.0).
   */
  takeDamage(duration: number = 2.0): void {
    this.state.invincible = true;
    this.state.invincibleTimer = duration;
  }

  /**
   * Apply a lateral collision push force.
   *
   * @param force - Push magnitude (positive = right, negative = left).
   */
  applyCollisionPush(force: number): void {
    this.collisionPush_ = force;
  }

  /** Reset car state to initial values. */
  reset(): void {
    this.state.x = 0;
    this.state.speed = 0;
    this.state.targetSpeed = 0;
    this.state.tilt = 0;
    this.state.invincible = false;
    this.state.invincibleTimer = 0;
    this.collisionPush_ = 0;
  }
}
