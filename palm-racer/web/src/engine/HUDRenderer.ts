/**
 * HUDRenderer - Cockpit-view 2D HUD overlay for PalmRacer 3D.
 *
 * Renders a steering wheel, dual analogue gauges (RPM + speed) and a
 * central digital speed readout on an HTML Canvas element that is
 * composited over the 3D viewport.
 */

export class HUDRenderer {
  private canvas_: HTMLCanvasElement;
  private ctx_: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas_ = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("HUDRenderer: failed to acquire 2D context");
    }
    this.ctx_ = ctx;
  }

  /**
   * Render one frame of the cockpit HUD.
   *
   * @param speed         - Current speed in km/h.
   * @param maxSpeed      - Maximum speed in km/h (used to calculate ratio).
   * @param steeringAngle - Steering wheel rotation in radians.
   * @param rpmRatio      - RPM gauge ratio 0..1 (optional, derived from speed if omitted).
   */
  render(
    speed: number,
    maxSpeed: number,
    steeringAngle: number,
    rpmRatio?: number
  ): void {
    const canvas = this.canvas_;
    const ctx = this.ctx_;

    // Adapt to device pixel ratio.
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const W = Math.round(rect.width * dpr);
    const H = Math.round(rect.height * dpr);
    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
    }
    ctx.clearRect(0, 0, W, H);

    const speedRatio = Math.min(speed / maxSpeed, 1);
    const rpm = rpmRatio !== undefined ? rpmRatio : 0.15 + speedRatio * 0.8;

    // ---- Steering Wheel (lower-centre) ----
    this.drawSteeringWheel_(ctx, W, H, steeringAngle);

    // ---- Dual gauges (above the wheel, left = RPM, right = speed) ----
    const gaugeY = H * 0.24;
    const gaugeR = Math.min(W, H) * 0.2;

    this.drawDial_(
      ctx, W * 0.17, gaugeY, gaugeR,
      rpm, 9, "RPM", "x1000",
      "#ff6020", "#ff3030"
    );
    this.drawDial_(
      ctx, W * 0.83, gaugeY, gaugeR,
      speedRatio, 350, "km/h", "",
      "#40aaff", "#2060ff"
    );

    // ---- Central digital speed ----
    const speedKmh = Math.round(speed);

    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(H * 0.1)}px "Segoe UI",Arial`;
    ctx.fillText(speedKmh.toString(), W * 0.5, H * 0.23);
    ctx.fillStyle = "#888";
    ctx.font = `${Math.round(H * 0.035)}px "Segoe UI",Arial`;
    ctx.fillText("km/h", W * 0.5, H * 0.30);
  }

  /** Clear the HUD canvas (used when switching away from cockpit mode). */
  clear(): void {
    this.ctx_.clearRect(0, 0, this.canvas_.width, this.canvas_.height);
  }

  /** Release any resources held by this renderer. */
  dispose(): void {
    this.ctx_.clearRect(0, 0, this.canvas_.width, this.canvas_.height);
  }

  // ------------------------------------------------------------------
  // Private drawing helpers
  // ------------------------------------------------------------------

  /**
   * Draw the steering wheel.
   */
  private drawSteeringWheel_(
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    steerAngle: number
  ): void {
    const wheelCX = W * 0.5;
    const wheelCY = H * 0.80;
    const wheelR = Math.min(W, H) * 0.28;

    ctx.save();
    ctx.translate(wheelCX, wheelCY);
    ctx.rotate(steerAngle);

    // Outer ring (thick).
    ctx.strokeStyle = "#2a2a2a";
    ctx.lineWidth = wheelR * 0.13;
    ctx.beginPath();
    ctx.arc(0, 0, wheelR, 0, Math.PI * 2);
    ctx.stroke();

    // Highlight layer.
    ctx.strokeStyle = "#3d3d3d";
    ctx.lineWidth = wheelR * 0.09;
    ctx.beginPath();
    ctx.arc(0, 0, wheelR, 0, Math.PI * 2);
    ctx.stroke();

    // Inner leather edge.
    ctx.strokeStyle = "#1e1e1e";
    ctx.lineWidth = wheelR * 0.03;
    ctx.beginPath();
    ctx.arc(0, 0, wheelR * 0.94, 0, Math.PI * 2);
    ctx.stroke();

    // Three spokes.
    const sw = wheelR * 0.08;
    const sLen = wheelR * 0.62;
    ctx.fillStyle = "#484848";
    // 3 o'clock
    ctx.beginPath();
    ctx.roundRect(wheelR * 0.18, -sw / 2, sLen, sw, 4);
    ctx.fill();
    // 9 o'clock
    ctx.beginPath();
    ctx.roundRect(-wheelR * 0.18 - sLen, -sw / 2, sLen, sw, 4);
    ctx.fill();
    // 6 o'clock
    ctx.beginPath();
    ctx.roundRect(-sw / 2, wheelR * 0.18, sw, sLen, 4);
    ctx.fill();

    // Centre hub (radial gradient metal).
    const hubR = wheelR * 0.24;
    const hubGrad = ctx.createRadialGradient(-3, -3, 0, 0, 0, hubR);
    hubGrad.addColorStop(0, "#5a5a5a");
    hubGrad.addColorStop(0.4, "#3a3a3a");
    hubGrad.addColorStop(1, "#1a1a1a");
    ctx.fillStyle = hubGrad;
    ctx.beginPath();
    ctx.arc(0, 0, hubR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 2;
    ctx.stroke();

    // Brand logo (yellow rectangle).
    const ls = wheelR * 0.1;
    ctx.fillStyle = "#e8c810";
    ctx.fillRect(-ls / 2, -ls * 0.6, ls, ls * 1.2);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-ls / 2, -ls * 0.6, ls, ls * 1.2);

    // 12 o'clock red marker.
    ctx.fillStyle = "#ff2020";
    const markerY = -wheelR - wheelR * 0.02;
    ctx.fillRect(-wheelR * 0.04, markerY, wheelR * 0.08, wheelR * 0.055);

    ctx.restore();
  }

  /**
   * Draw a single analogue dial / gauge.
   */
  private drawDial_(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    radius: number,
    value: number,
    maxVal: number,
    label: string,
    unit: string,
    c1: string,
    c2: string
  ): void {
    const sa = Math.PI * 0.75;
    const ea = Math.PI * 2.25;
    const sweep = ea - sa;

    // Background disc.
    const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    bg.addColorStop(0, "rgba(22,22,28,0.94)");
    bg.addColorStop(1, "rgba(10,10,14,0.96)");
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Outer ring.
    ctx.strokeStyle = "#444";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Base arc.
    ctx.strokeStyle = "#2a2a30";
    ctx.lineWidth = radius * 0.06;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.82, sa, ea);
    ctx.stroke();

    // Value arc.
    const va = sa + sweep * Math.min(value, 1);
    const ag = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
    ag.addColorStop(0, c1);
    ag.addColorStop(1, c2);
    ctx.strokeStyle = ag;
    ctx.lineWidth = radius * 0.06;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.82, sa, va);
    ctx.stroke();

    // Tick marks.
    for (let i = 0; i <= 10; i++) {
      const angle = sa + (sweep / 10) * i;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const isMaj = i % 2 === 0;
      const isRed = i >= 8;
      const oR = radius * 0.76;
      const iR = isMaj ? radius * 0.58 : radius * 0.66;

      // Minor ticks.
      if (i < 10) {
        for (let j = 1; j < 5; j++) {
          const a2 = angle + (sweep / 50) * j;
          ctx.strokeStyle = "#333";
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(a2) * radius * 0.71, cy + Math.sin(a2) * radius * 0.71);
          ctx.lineTo(cx + Math.cos(a2) * oR, cy + Math.sin(a2) * oR);
          ctx.stroke();
        }
      }

      ctx.strokeStyle = isRed ? "#ff3030" : "#999";
      ctx.lineWidth = isMaj ? 2.5 : 1.2;
      ctx.beginPath();
      ctx.moveTo(cx + cos * iR, cy + sin * iR);
      ctx.lineTo(cx + cos * oR, cy + sin * oR);
      ctx.stroke();

      if (isMaj) {
        const nv = Math.round((maxVal / 10) * i);
        ctx.fillStyle = isRed ? "#ff4040" : "#ddd";
        ctx.font = `bold ${Math.round(radius * 0.13)}px "Segoe UI",Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          nv.toString(),
          cx + cos * radius * 0.47,
          cy + sin * radius * 0.47
        );
      }
    }

    // Red zone.
    ctx.strokeStyle = "rgba(255,48,48,0.12)";
    ctx.lineWidth = radius * 0.15;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.68, sa + sweep * 0.8, ea);
    ctx.stroke();

    // Needle.
    const na = sa + sweep * Math.min(value, 1);
    const nLen = radius * 0.72;
    const nc = Math.cos(na);
    const ns = Math.sin(na);
    const pc = Math.cos(na + Math.PI / 2);
    const ps = Math.sin(na + Math.PI / 2);
    const hw = radius * 0.028;

    // Needle shadow.
    ctx.fillStyle = "rgba(255,32,32,0.25)";
    ctx.beginPath();
    ctx.moveTo(cx + pc * (hw + 1) + 2, cy + ps * (hw + 1) + 2);
    ctx.lineTo(cx - pc * (hw + 1) + 2, cy - ps * (hw + 1) + 2);
    ctx.lineTo(cx + nc * nLen + 2, cy + ns * nLen + 2);
    ctx.closePath();
    ctx.fill();

    // Needle body.
    ctx.fillStyle = "#ff2020";
    ctx.beginPath();
    ctx.moveTo(cx + pc * hw, cy + ps * hw);
    ctx.lineTo(cx - pc * hw, cy - ps * hw);
    ctx.lineTo(cx + nc * nLen, cy + ns * nLen);
    ctx.closePath();
    ctx.fill();

    // Needle tail (counterweight).
    const tl = radius * 0.12;
    ctx.fillStyle = "#cc1818";
    ctx.beginPath();
    ctx.moveTo(cx + pc * hw * 1.5, cy + ps * hw * 1.5);
    ctx.lineTo(cx - pc * hw * 1.5, cy - ps * hw * 1.5);
    ctx.lineTo(cx - nc * tl, cy - ns * tl);
    ctx.closePath();
    ctx.fill();

    // Centre cap.
    const ch = ctx.createRadialGradient(cx - 1, cy - 1, 0, cx, cy, radius * 0.06);
    ch.addColorStop(0, "#666");
    ch.addColorStop(1, "#222");
    ctx.fillStyle = ch;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 0.06, 0, Math.PI * 2);
    ctx.fill();

    // Labels.
    ctx.fillStyle = "#bbb";
    ctx.font = `bold ${Math.round(radius * 0.12)}px "Segoe UI",Arial`;
    ctx.textAlign = "center";
    ctx.fillText(label, cx, cy + radius * 0.32);
    if (unit) {
      ctx.font = `${Math.round(radius * 0.09)}px "Segoe UI",Arial`;
      ctx.fillStyle = "#777";
      ctx.fillText(unit, cx, cy + radius * 0.44);
    }
  }
}
