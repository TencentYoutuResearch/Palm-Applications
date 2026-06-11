/**
 * ComboSystem - Streak/combo tracking for PalmRacer 3D.
 *
 * Tracks consecutive collectible pickups.  The combo resets after a
 * configurable timeout (default 3 seconds) or on explicit reset (collision).
 */

export class ComboSystem {
  /** Current consecutive combo count. */
  count: number = 0;

  /** Current score multiplier derived from the combo. */
  multiplier: number = 1;

  /** Seconds remaining before the combo expires. */
  private timer_: number = 0;

  /** Timeout duration in seconds (default 3.0). */
  private timeout_: number;

  /** Maximum combo count that contributes to multiplier (cap at 10). */
  private static readonly MAX_COMBO = 10;

  /** Minimum combo count to earn bonus score. */
  private static readonly BONUS_THRESHOLD = 3;

  /** Base score awarded per collectible (used for bonus calculation). */
  private static readonly BASE_SCORE = 50;

  /**
   * @param timeout - Seconds before the combo expires (default 3.0).
   */
  constructor(timeout: number = 3.0) {
    this.timeout_ = timeout;
  }

  /**
   * Register a new combo hit (e.g. collecting a coin).
   *
   * @returns An object containing the new multiplier and any bonus score
   *          earned from the combo streak.
   */
  addCombo(): { multiplier: number; bonus: number } {
    this.count++;
    this.timer_ = this.timeout_;
    const capped = Math.min(this.count, ComboSystem.MAX_COMBO);
    this.multiplier = capped;

    let bonus = 0;
    if (this.count >= ComboSystem.BONUS_THRESHOLD) {
      bonus = Math.floor(
        ComboSystem.BASE_SCORE * (capped - 1) * 0.5
      );
    }

    return { multiplier: this.multiplier, bonus };
  }

  /**
   * Tick the combo timer each frame.
   * When the timer reaches zero the combo resets automatically.
   *
   * @param dt - Delta time in seconds.
   */
  update(dt: number): void {
    if (this.count > 0) {
      this.timer_ -= dt;
      if (this.timer_ <= 0) {
        this.reset();
      }
    }
  }

  /**
   * Forcefully reset the combo (e.g. on collision).
   */
  reset(): void {
    this.count = 0;
    this.multiplier = 1;
    this.timer_ = 0;
  }

  /** Whether the combo is currently active (count >= BONUS_THRESHOLD). */
  get isActive(): boolean {
    return this.count >= ComboSystem.BONUS_THRESHOLD;
  }

  /** Remaining time before the combo expires. */
  get timeRemaining(): number {
    return Math.max(0, this.timer_);
  }
}
