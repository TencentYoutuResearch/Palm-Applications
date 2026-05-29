/**
 * @file constants.ts
 * @description Centralized frontend configuration constants extracted from
 * various modules to improve maintainability and consistency.
 *
 * Covers timing, audio synthesis, media pipeline, and bridging constants.
 */

// ==============================================================================
// Platform & Timeout Configuration
// ==============================================================================

/** Maximum number of recognition attempts before giving up. */
export const MAX_RETRIES = 10;

/** Interval between recognition attempts (ms). */
export const RETRY_INTERVAL = 1500;

/** Timeout for opening camera (ms). */
export const CAMERA_TIMEOUT = 8000;

/** Timeout for a single 1:N search call (ms). */
export const SEARCH_TIMEOUT = 5000;

/**
 * Per-platform stabilization delays.
 * Native cameras (CameraX) need more time to stabilize than PC webcams.
 */
export const STABILIZE_DELAY = {
  /** Delay before first capture on native platform (ms). */
  native: 800,
  /** Delay before first capture on web platform (ms). */
  web: 300,
} as const;

/** Anti-cheat consecutive failure threshold before flagging as cheat. */
export const ANTI_CHEAT_FAIL_THRESHOLD = 2;

// ==============================================================================
// JSBridge Timeouts (Native Integration)
// ==============================================================================

/** Timeout for JSBridge initialization (ms). */
export const JSBRIDGE_INIT_TIMEOUT = 3000;

/** Default timeout for JSBridge call operations (ms). */
export const JSBRIDGE_DEFAULT_CALL_TIMEOUT = 15000;

// ==============================================================================
// MediaPipe Timeouts
// ==============================================================================

/** Timeout for MediaPipe library loading (ms). */
export const MEDIAPIPE_LIB_LOAD_TIMEOUT = 15000;

/** Timeout for MediaPipe model initialization (ms). */
export const MEDIAPIPE_MODEL_INIT_TIMEOUT = 30000;

/** Frame processing throttle interval: process every Nth frame. */
export const MEDIAPIPE_FRAME_SKIP = 3;

/** MediaPipe library loading check interval (ms). */
export const MEDIAPIPE_CHECK_INTERVAL = 200;

// ==============================================================================
// Audio Synthesis Constants (SoundManager)
// ==============================================================================

/** Engine sound oscillator frequency (Hz). */
export const AUDIO_ENGINE_BASE_FREQ = 80;

/** Engine filter low-pass frequency (Hz). */
export const AUDIO_ENGINE_FILTER_FREQ = 300;

/** Engine filter Q factor. */
export const AUDIO_ENGINE_FILTER_Q = 2;

/** Engine ramp-up duration (seconds). */
export const AUDIO_ENGINE_RAMPUP_DURATION = 0.3;

/** Engine ramp-up target gain. */
export const AUDIO_ENGINE_RAMPUP_GAIN = 0.06;

/** Engine stop ramp-down duration (seconds). */
export const AUDIO_ENGINE_STOP_RAMPDOWN = 0.5;

/** Engine stop delay after ramp-down (ms). */
export const AUDIO_ENGINE_STOP_DELAY = 600;

/** Crash sound noise buffer duration ratio. */
export const AUDIO_CRASH_BUFFER_RATIO = 0.3;

/** Crash sound noise decay ratio. */
export const AUDIO_CRASH_DECAY_RATIO = 0.15;

/** Crash sound initial gain. */
export const AUDIO_CRASH_INITIAL_GAIN = 0.25;

/** Crash sound decay gain target. */
export const AUDIO_CRASH_DECAY_GAIN = 0.001;

/** Crash sound duration (seconds). */
export const AUDIO_CRASH_DURATION = 0.3;

/** Crash sound filter frequency (Hz). */
export const AUDIO_CRASH_FILTER_FREQ = 800;

/** Coin sound high frequency (Hz). */
export const AUDIO_COIN_HIGH_FREQ = 1320;

/** Coin sound low frequency (Hz). */
export const AUDIO_COIN_LOW_FREQ = 880;

/** Coin sound second note delay (seconds). */
export const AUDIO_COIN_DELAY = 0.08;

/** Coin sound initial gain. */
export const AUDIO_COIN_INITIAL_GAIN = 0.12;

/** Coin sound duration (seconds). */
export const AUDIO_COIN_DURATION = 0.15;

/** Boost sound initial frequency (Hz). */
export const AUDIO_BOOST_START_FREQ = 200;

/** Boost sound target frequency (Hz). */
export const AUDIO_BOOST_END_FREQ = 800;

/** Boost sound ramp duration (seconds). */
export const AUDIO_BOOST_RAMP_DURATION = 0.2;

/** Boost sound initial gain. */
export const AUDIO_BOOST_INITIAL_GAIN = 0.1;

/** Boost sound gain peak. */
export const AUDIO_BOOST_PEAK_GAIN = 0.15;

/** Boost sound ramp-to-peak time (seconds). */
export const AUDIO_BOOST_RAMP_TO_PEAK = 0.1;

/** Boost sound total duration (seconds). */
export const AUDIO_BOOST_TOTAL_DURATION = 0.35;

/** Boost sound filter start frequency (Hz). */
export const AUDIO_BOOST_FILTER_START = 400;

/** Boost sound filter end frequency (Hz). */
export const AUDIO_BOOST_FILTER_END = 2000;

/** Slowdown sound start frequency (Hz). */
export const AUDIO_SLOWDOWN_START_FREQ = 400;

/** Slowdown sound end frequency (Hz). */
export const AUDIO_SLOWDOWN_END_FREQ = 60;

/** Slowdown sound duration (seconds). */
export const AUDIO_SLOWDOWN_DURATION = 0.4;

/** Slowdown sound initial gain. */
export const AUDIO_SLOWDOWN_INITIAL_GAIN = 0.12;

/** Slowdown sound filter start frequency (Hz). */
export const AUDIO_SLOWDOWN_FILTER_START = 1000;

/** Slowdown sound filter end frequency (Hz). */
export const AUDIO_SLOWDOWN_FILTER_END = 100;

/** Countdown tick frequency (Hz). */
export const AUDIO_COUNTDOWN_TICK_FREQ = 660;

/** Countdown tick gain. */
export const AUDIO_COUNTDOWN_TICK_GAIN = 0.15;

/** Countdown tick duration (seconds). */
export const AUDIO_COUNTDOWN_TICK_DURATION = 0.15;

/** Countdown "go" frequencies (Hz). */
export const AUDIO_COUNTDOWN_GO_FREQS = [440, 554.37, 659.25, 880] as const;

/** Countdown "go" note delay (seconds). */
export const AUDIO_COUNTDOWN_GO_DELAY = 0.03;

/** Countdown "go" note gain. */
export const AUDIO_COUNTDOWN_GO_GAIN = 0.08;

/** Countdown "go" note duration (seconds). */
export const AUDIO_COUNTDOWN_GO_DURATION = 0.3;

/** Game over frequencies (Hz). */
export const AUDIO_GAMEOVER_FREQS = [440, 415.30, 349.23, 261.63] as const;

/** Game over note delay (seconds). */
export const AUDIO_GAMEOVER_DELAY = 0.15;

/** Game over note gain. */
export const AUDIO_GAMEOVER_GAIN = 0.08;

/** Game over note duration (seconds). */
export const AUDIO_GAMEOVER_DURATION = 0.4;

/** Game over ramp-down duration (seconds). */
export const AUDIO_GAMEOVER_RAMPDOWN = 0.5;

/** Game over filter frequency (Hz). */
export const AUDIO_GAMEOVER_FILTER_FREQ = 600;

/** New record frequencies (Hz). */
export const AUDIO_NEWRECORD_FREQS = [523.25, 659.25, 783.99, 1046.50, 1318.51, 1046.50] as const;

/** New record note delay (seconds). */
export const AUDIO_NEWRECORD_DELAY = 0.08;

/** New record note gain. */
export const AUDIO_NEWRECORD_GAIN = 0.1;

/** New record note duration (seconds). */
export const AUDIO_NEWRECORD_DURATION = 0.25;

/** Heart sound frequencies (Hz). */
export const AUDIO_HEART_FREQS = [523.25, 659.25, 783.99] as const;

/** Heart sound note delay (seconds). */
export const AUDIO_HEART_DELAY = 0.06;

/** Heart sound ramp-up to peak time (seconds). */
export const AUDIO_HEART_RAMP_TO_PEAK = 0.05;

/** Heart sound total duration (seconds). */
export const AUDIO_HEART_TOTAL_DURATION = 0.4;

/** Heart sound initial gain (ramp starting point). */
export const AUDIO_HEART_INITIAL_GAIN = 0.1;

// ==============================================================================
// Road System Constants
// ==============================================================================

/** Conversion factor from km/h to m/s for speed calculations. */
export const ROAD_KMH_TO_MS = 0.278;

/** Z-axis threshold (meters) beyond which roadside objects recycle back to start. */
export const ROAD_ROADSIDE_RESET_THRESHOLD = 15;
