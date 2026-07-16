/**
 * Short attention chime for order-ready (and similar) alerts.
 * Uses Web Audio API — no asset files required.
 */
export function playOrderReadySound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const tones = [
      { freq: 880, start: 0, dur: 0.12 },
      { freq: 1175, start: 0.14, dur: 0.16 },
    ];

    tones.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + start);
      gain.gain.exponentialRampToValueAtTime(0.22, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur + 0.02);
    });

    setTimeout(() => {
      try {
        ctx.close();
      } catch {
        /* ignore */
      }
    }, 500);
  } catch {
    /* ignore autoplay / AudioContext errors */
  }
}
