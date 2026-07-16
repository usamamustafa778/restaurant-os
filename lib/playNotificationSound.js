/**
 * Short attention chime for order-ready (and similar) alerts.
 * Uses Web Audio API — no audio files required.
 */
let sharedReadyCtx = null;

export function playOrderReadySound() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    let ctx = sharedReadyCtx;
    if (!ctx || ctx.state === "closed") {
      ctx = new AudioCtx();
      sharedReadyCtx = ctx;
    }

    const startTone = () => {
      const now = ctx.currentTime;
      const tones = [
        { freq: 880, start: 0, dur: 0.12 },
        { freq: 1175, start: 0.14, dur: 0.18 },
      ];

      tones.forEach(({ freq, start, dur }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + start);
        gain.gain.setValueAtTime(0.0001, now + start);
        gain.gain.exponentialRampToValueAtTime(0.28, now + start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + dur + 0.02);
      });
    };

    if (ctx.state === "suspended") {
      ctx
        .resume()
        .then(() => startTone())
        .catch(() => {});
      return;
    }
    startTone();
  } catch {
    /* ignore autoplay / AudioContext errors */
  }
}
