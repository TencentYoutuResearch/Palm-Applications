/**
 * @file SoundManager.ts
 * @description Web Audio API procedural sound synthesis for PalmRacer.
 *
 * All sounds are synthesized programmatically — no external audio files needed.
 * AudioContext is lazily initialized on first user interaction (browser policy).
 */

import { logger } from '../utils/logger';
import {
  AUDIO_ENGINE_BASE_FREQ,
  AUDIO_ENGINE_FILTER_FREQ,
  AUDIO_ENGINE_FILTER_Q,
  AUDIO_ENGINE_RAMPUP_DURATION,
  AUDIO_ENGINE_RAMPUP_GAIN,
  AUDIO_ENGINE_STOP_RAMPDOWN,
  AUDIO_ENGINE_STOP_DELAY,
  AUDIO_CRASH_BUFFER_RATIO,
  AUDIO_CRASH_DECAY_RATIO,
  AUDIO_CRASH_INITIAL_GAIN,
  AUDIO_CRASH_DECAY_GAIN,
  AUDIO_CRASH_DURATION,
  AUDIO_CRASH_FILTER_FREQ,
  AUDIO_COIN_HIGH_FREQ,
  AUDIO_COIN_LOW_FREQ,
  AUDIO_COIN_DELAY,
  AUDIO_COIN_INITIAL_GAIN,
  AUDIO_COIN_DURATION,
  AUDIO_BOOST_START_FREQ,
  AUDIO_BOOST_END_FREQ,
  AUDIO_BOOST_RAMP_DURATION,
  AUDIO_BOOST_INITIAL_GAIN,
  AUDIO_BOOST_PEAK_GAIN,
  AUDIO_BOOST_RAMP_TO_PEAK,
  AUDIO_BOOST_TOTAL_DURATION,
  AUDIO_BOOST_FILTER_START,
  AUDIO_BOOST_FILTER_END,
  AUDIO_SLOWDOWN_START_FREQ,
  AUDIO_SLOWDOWN_END_FREQ,
  AUDIO_SLOWDOWN_DURATION,
  AUDIO_SLOWDOWN_INITIAL_GAIN,
  AUDIO_SLOWDOWN_FILTER_START,
  AUDIO_SLOWDOWN_FILTER_END,
  AUDIO_COUNTDOWN_TICK_FREQ,
  AUDIO_COUNTDOWN_TICK_GAIN,
  AUDIO_COUNTDOWN_TICK_DURATION,
  AUDIO_COUNTDOWN_GO_FREQS,
  AUDIO_COUNTDOWN_GO_DELAY,
  AUDIO_COUNTDOWN_GO_GAIN,
  AUDIO_COUNTDOWN_GO_DURATION,
  AUDIO_GAMEOVER_FREQS,
  AUDIO_GAMEOVER_DELAY,
  AUDIO_GAMEOVER_GAIN,
  AUDIO_GAMEOVER_DURATION,
  AUDIO_GAMEOVER_RAMPDOWN,
  AUDIO_GAMEOVER_FILTER_FREQ,
  AUDIO_NEWRECORD_FREQS,
  AUDIO_NEWRECORD_DELAY,
  AUDIO_NEWRECORD_GAIN,
  AUDIO_NEWRECORD_DURATION,
  AUDIO_HEART_FREQS,
  AUDIO_HEART_DELAY,
  AUDIO_HEART_RAMP_TO_PEAK,
  AUDIO_HEART_TOTAL_DURATION,
  AUDIO_HEART_INITIAL_GAIN,
} from '@/config/constants';

export class SoundManager {
  private ctx_: AudioContext | null = null;
  private enabled_ = true;
  private initialized_ = false;
  private volume_ = 1.0;

  // Engine sound nodes
  private engineOsc_: OscillatorNode | null = null;
  private engineGain_: GainNode | null = null;
  private engineFilter_: BiquadFilterNode | null = null;
  private engineRunning_ = false;

  /** Initialize AudioContext (must be called after user interaction). */
  init(): void {
    if (this.initialized_) return;
    try {
      this.ctx_ = new AudioContext();
      this.initialized_ = true;
      logger.debug('Sound', 'AudioContext initialized');
    } catch (e) {
      logger.warn('Sound', 'AudioContext init failed:', e);
      this.enabled_ = false;
    }
  }

  private ensureContext_(): boolean {
    if (!this.ctx_ || !this.enabled_) return false;
    if (this.ctx_.state === 'suspended') {
      this.ctx_.resume();
    }
    return this.ctx_.state === 'running' || this.ctx_.state === 'suspended';
  }

  get enabled(): boolean { return this.enabled_; }

  set enabled(val: boolean) {
    this.enabled_ = val;
    if (!val) this.stopEngine();
  }

  setVolume(vol: number): void {
    this.volume_ = Math.max(0, Math.min(1, vol));
    if (this.engineGain_ && this.ctx_) {
      this.engineGain_.gain.setValueAtTime(
        this.engineGain_.gain.value * this.volume_,
        this.ctx_.currentTime
      );
    }
  }

  dispose(): void {
    this.stopEngine();
    if (this.ctx_ && this.ctx_.state !== 'closed') {
      try { this.ctx_.close(); } catch { /* ignore */ }
    }
    this.ctx_ = null;
    this.initialized_ = false;
  }

  /** Play a sound effect by name. */
  playSfx(name: string): void {
    switch (name) {
      case 'coin': this.playCoin(); break;
      case 'boost': this.playBoost(); break;
      case 'crash': case 'slowdown': this.playCrash(); break;
      case 'heart': this.playCoin(); break;
    }
  }

  // ========== Engine sound ==========

  startEngine(): void {
    if (!this.ensureContext_() || this.engineRunning_ || !this.ctx_) return;
    try {
      const ctx = this.ctx_;

      this.engineOsc_ = ctx.createOscillator();
      this.engineOsc_.type = 'sawtooth';
      this.engineOsc_.frequency.value = AUDIO_ENGINE_BASE_FREQ;

      this.engineGain_ = ctx.createGain();
      this.engineGain_.gain.value = 0;

      this.engineFilter_ = ctx.createBiquadFilter();
      this.engineFilter_.type = 'lowpass';
      this.engineFilter_.frequency.value = AUDIO_ENGINE_FILTER_FREQ;
      this.engineFilter_.Q.value = AUDIO_ENGINE_FILTER_Q;

      this.engineOsc_.connect(this.engineFilter_);
      this.engineFilter_.connect(this.engineGain_);
      this.engineGain_.connect(ctx.destination);

      this.engineOsc_.start();
      this.engineRunning_ = true;

      this.engineGain_.gain.linearRampToValueAtTime(AUDIO_ENGINE_RAMPUP_GAIN, ctx.currentTime + AUDIO_ENGINE_RAMPUP_DURATION);
    } catch (e) {
      logger.warn('Sound', 'Engine start failed:', e);
    }
  }

  stopEngine(): void {
    if (!this.engineRunning_ || !this.ctx_) return;
    try {
      if (this.engineGain_) {
        this.engineGain_.gain.linearRampToValueAtTime(0, this.ctx_.currentTime + AUDIO_ENGINE_STOP_RAMPDOWN);
      }
      setTimeout(() => {
        try {
          this.engineOsc_?.stop();
          this.engineOsc_?.disconnect();
          this.engineOsc_ = null;
          this.engineFilter_?.disconnect();
          this.engineFilter_ = null;
          this.engineGain_?.disconnect();
          this.engineGain_ = null;
        } catch { /* ignore */ }
      }, 600);
      this.engineRunning_ = false;
    } catch (e) {
      logger.warn('Sound', 'Engine stop failed:', e);
    }
  }

  /**
   * Update engine sound per frame.
   * @param speed - Current speed 0-400 km/h.
   * @param isBraking - Whether braking is active.
   */
  updateEngine(speed: number, isBraking: boolean): void {
    if (!this.engineRunning_ || !this.engineOsc_ || !this.engineGain_ || !this.ctx_) return;
    const t = this.ctx_.currentTime;

    // Speed → frequency: 0km/h=60Hz, 400km/h=320Hz
    const targetFreq = 60 + (speed / 400) * 260;
    this.engineOsc_.frequency.linearRampToValueAtTime(targetFreq, t + 0.1);

    // Speed → filter frequency: faster = sharper
    if (this.engineFilter_) {
      const filterFreq = 200 + (speed / 400) * 1200;
      this.engineFilter_.frequency.linearRampToValueAtTime(filterFreq, t + 0.1);
    }

    // Speed → volume: quiet at low speed, louder at high speed
    let targetVol = 0.03 + (speed / 400) * 0.10;
    if (isBraking) {
      targetVol *= 0.5;
    }
    this.engineGain_.gain.linearRampToValueAtTime(targetVol, t + 0.1);
  }

  // ========== One-shot sound effects ==========

  playCrash(): void {
    if (!this.ensureContext_() || !this.ctx_) return;
    const ctx = this.ctx_;
    const t = ctx.currentTime;

    const bufferSize = ctx.sampleRate * AUDIO_CRASH_BUFFER_RATIO;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * AUDIO_CRASH_DECAY_RATIO));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(AUDIO_CRASH_INITIAL_GAIN, t);
    gain.gain.exponentialRampToValueAtTime(AUDIO_CRASH_DECAY_GAIN, t + AUDIO_CRASH_DURATION);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = AUDIO_CRASH_FILTER_FREQ;

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(t);
    noise.stop(t + AUDIO_CRASH_DURATION);
  }

  playCoin(): void {
    if (!this.ensureContext_() || !this.ctx_) return;
    const ctx = this.ctx_;
    const t = ctx.currentTime;

    [0, AUDIO_COIN_DELAY].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(i === 0 ? AUDIO_COIN_LOW_FREQ : AUDIO_COIN_HIGH_FREQ, t + delay);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(AUDIO_COIN_INITIAL_GAIN, t + delay);
      gain.gain.exponentialRampToValueAtTime(AUDIO_CRASH_DECAY_GAIN, t + delay + AUDIO_COIN_DURATION);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + AUDIO_COIN_DURATION);
    });
  }

  playBoost(): void {
    if (!this.ensureContext_() || !this.ctx_) return;
    const ctx = this.ctx_;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(AUDIO_BOOST_START_FREQ, t);
    osc.frequency.exponentialRampToValueAtTime(AUDIO_BOOST_END_FREQ, t + AUDIO_BOOST_RAMP_DURATION);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(AUDIO_BOOST_INITIAL_GAIN, t);
    gain.gain.linearRampToValueAtTime(AUDIO_BOOST_PEAK_GAIN, t + AUDIO_BOOST_RAMP_TO_PEAK);
    gain.gain.exponentialRampToValueAtTime(AUDIO_CRASH_DECAY_GAIN, t + AUDIO_BOOST_TOTAL_DURATION);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(AUDIO_BOOST_FILTER_START, t);
    filter.frequency.exponentialRampToValueAtTime(AUDIO_BOOST_FILTER_END, t + AUDIO_BOOST_RAMP_DURATION);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + AUDIO_BOOST_TOTAL_DURATION);
  }

  playHeart(): void {
    if (!this.ensureContext_() || !this.ctx_) return;
    const ctx = this.ctx_;
    const t = ctx.currentTime;

    AUDIO_HEART_FREQS.forEach((freq, i) => {
      const delay = i * AUDIO_HEART_DELAY;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t + delay);
      gain.gain.linearRampToValueAtTime(AUDIO_HEART_INITIAL_GAIN, t + delay + AUDIO_HEART_RAMP_TO_PEAK);
      gain.gain.exponentialRampToValueAtTime(AUDIO_CRASH_DECAY_GAIN, t + delay + AUDIO_HEART_TOTAL_DURATION);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + AUDIO_HEART_TOTAL_DURATION);
    });
  }

  playSlowdown(): void {
    if (!this.ensureContext_() || !this.ctx_) return;
    const ctx = this.ctx_;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(AUDIO_SLOWDOWN_START_FREQ, t);
    osc.frequency.exponentialRampToValueAtTime(AUDIO_SLOWDOWN_END_FREQ, t + AUDIO_SLOWDOWN_DURATION);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(AUDIO_SLOWDOWN_INITIAL_GAIN, t);
    gain.gain.exponentialRampToValueAtTime(AUDIO_CRASH_DECAY_GAIN, t + AUDIO_SLOWDOWN_DURATION);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(AUDIO_SLOWDOWN_FILTER_START, t);
    filter.frequency.exponentialRampToValueAtTime(AUDIO_SLOWDOWN_FILTER_END, t + AUDIO_SLOWDOWN_DURATION);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + AUDIO_SLOWDOWN_DURATION);
  }

  playCountdownTick(): void {
    if (!this.ensureContext_() || !this.ctx_) return;
    const ctx = this.ctx_;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = AUDIO_COUNTDOWN_TICK_FREQ;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(AUDIO_COUNTDOWN_TICK_GAIN, t);
    gain.gain.exponentialRampToValueAtTime(AUDIO_CRASH_DECAY_GAIN, t + AUDIO_COUNTDOWN_TICK_DURATION);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + AUDIO_COUNTDOWN_TICK_DURATION);
  }

  playCountdownGo(): void {
    if (!this.ensureContext_() || !this.ctx_) return;
    const ctx = this.ctx_;
    const t = ctx.currentTime;

    AUDIO_COUNTDOWN_GO_FREQS.forEach((freq, i) => {
      const delay = i * AUDIO_COUNTDOWN_GO_DELAY;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(AUDIO_COUNTDOWN_GO_GAIN, t + delay);
      gain.gain.exponentialRampToValueAtTime(AUDIO_CRASH_DECAY_GAIN, t + delay + AUDIO_COUNTDOWN_GO_DURATION);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + AUDIO_COUNTDOWN_GO_DURATION);
    });
  }

  playGameOver(): void {
    if (!this.ensureContext_() || !this.ctx_) return;
    const ctx = this.ctx_;
    const t = ctx.currentTime;

    AUDIO_GAMEOVER_FREQS.forEach((freq, i) => {
      const delay = i * AUDIO_GAMEOVER_DELAY;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(AUDIO_COUNTDOWN_GO_GAIN, t + delay);
      gain.gain.exponentialRampToValueAtTime(AUDIO_CRASH_DECAY_GAIN, t + delay + AUDIO_HEART_TOTAL_DURATION);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = AUDIO_GAMEOVER_FILTER_FREQ;

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + AUDIO_GAMEOVER_RAMPDOWN);
    });
  }

  playNewRecord(): void {
    if (!this.ensureContext_() || !this.ctx_) return;
    const ctx = this.ctx_;
    const t = ctx.currentTime;

    AUDIO_NEWRECORD_FREQS.forEach((freq, i) => {
      const delay = i * AUDIO_NEWRECORD_DELAY;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(AUDIO_NEWRECORD_GAIN, t + delay);
      gain.gain.exponentialRampToValueAtTime(AUDIO_CRASH_DECAY_GAIN, t + delay + AUDIO_NEWRECORD_DURATION);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t + delay);
      osc.stop(t + delay + AUDIO_NEWRECORD_DURATION);
    });
  }
}
