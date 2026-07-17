/**
 * Notification sounds via Web Audio API — no audio files required.
 */
let sharedNotifyCtx = null;

function getNotifyAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedNotifyCtx || sharedNotifyCtx.state === "closed") {
    sharedNotifyCtx = new AudioCtx();
  }
  return sharedNotifyCtx;
}

function withResumedContext(play) {
  const ctx = getNotifyAudioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx
      .resume()
      .then(() => play(ctx))
      .catch(() => {});
    return;
  }
  play(ctx);
}

function playTone(ctx, { freq, start, dur, peak = 0.22, type = "sine", endFreq }) {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now + start);
  if (endFreq && endFreq !== freq) {
    osc.frequency.exponentialRampToValueAtTime(
      Math.max(40, endFreq),
      now + start + dur * 0.85,
    );
  }
  gain.gain.setValueAtTime(0.0001, now + start);
  gain.gain.exponentialRampToValueAtTime(peak, now + start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now + start);
  osc.stop(now + start + dur + 0.04);
}

function playBellPair(ctx, { low, high, start, peak, decay = 0.55 }) {
  playTone(ctx, {
    freq: low,
    start,
    dur: decay,
    peak,
    type: "sine",
    endFreq: low * 0.92,
  });
  playTone(ctx, {
    freq: high,
    start: start + 0.22,
    dur: decay + 0.15,
    peak: peak * 0.92,
    type: "sine",
    endFreq: high * 0.9,
  });
  // Harmonic shimmer for metallic bell character
  playTone(ctx, {
    freq: low * 2.4,
    start: start + 0.02,
    dur: decay * 0.45,
    peak: peak * 0.22,
    type: "triangle",
  });
  playTone(ctx, {
    freq: high * 2.2,
    start: start + 0.24,
    dur: decay * 0.4,
    peak: peak * 0.18,
    type: "triangle",
  });
}

function volumeToPeak(volumePct) {
  const raw = Number(volumePct);
  const pct = Number.isFinite(raw) ? Math.min(100, Math.max(1, Math.round(raw))) : 85;
  return Math.max(0.08, (pct / 100) * 0.62);
}

function playServiceBell(ctx, peak) {
  playBellPair(ctx, { low: 830, high: 1245, start: 0, peak });
  playBellPair(ctx, { low: 880, high: 1318, start: 0.72, peak: peak * 0.88 });
}

function playKitchenAlert(ctx, peak) {
  const hits = [
    { freq: 740, start: 0, dur: 0.16 },
    { freq: 988, start: 0.2, dur: 0.16 },
    { freq: 1318, start: 0.4, dur: 0.22 },
  ];
  hits.forEach(({ freq, start, dur }) => {
    playTone(ctx, { freq, start, dur, peak, type: "square" });
    playTone(ctx, {
      freq: freq * 0.5,
      start,
      dur: dur + 0.05,
      peak: peak * 0.35,
      type: "sine",
    });
  });
  playTone(ctx, { freq: 1568, start: 0.68, dur: 0.35, peak: peak * 0.85, type: "sine" });
}

function playClassicDing(ctx, peak) {
  playTone(ctx, { freq: 1046, start: 0, dur: 0.2, peak, type: "sine" });
  playTone(ctx, { freq: 1318, start: 0.18, dur: 0.35, peak: peak * 0.95, type: "sine" });
  playTone(ctx, {
    freq: 1568,
    start: 0.32,
    dur: 0.45,
    peak: peak * 0.7,
    type: "triangle",
  });
}

const KITCHEN_SOUND_PLAYERS = {
  service_bell: playServiceBell,
  kitchen_alert: playKitchenAlert,
  classic_ding: playClassicDing,
};

/** Loud FOH alert when an order becomes ready (order-taker / POS). */
export function playOrderReadySound(opts = {}) {
  try {
    const peak = volumeToPeak(opts.volume ?? 90);
    withResumedContext((ctx) => {
      // Bright two-burst alert — designed to cut through a busy dining floor
      playTone(ctx, { freq: 988, start: 0, dur: 0.14, peak, type: "sine" });
      playTone(ctx, {
        freq: 1318,
        start: 0.12,
        dur: 0.22,
        peak: peak * 0.95,
        type: "sine",
      });
      playTone(ctx, {
        freq: 1568,
        start: 0.28,
        dur: 0.35,
        peak: peak * 0.75,
        type: "triangle",
      });
      // Soft second ring so it reads as a notification, not a POS beep
      playTone(ctx, {
        freq: 1046,
        start: 0.55,
        dur: 0.14,
        peak: peak * 0.7,
        type: "sine",
      });
      playTone(ctx, {
        freq: 1397,
        start: 0.68,
        dur: 0.4,
        peak: peak * 0.85,
        type: "sine",
      });
    });
  } catch {
    /* ignore autoplay / AudioContext errors */
  }
}

/**
 * Kitchen new-order alert — loud notification bell (not a soft beep).
 * @param {{ soundType?: string, volume?: number }} [opts]
 */
export function playKitchenNewOrderSound(opts = {}) {
  try {
    const soundType = opts.soundType || "service_bell";
    const peak = volumeToPeak(opts.volume ?? 85);
    const play = KITCHEN_SOUND_PLAYERS[soundType] || playServiceBell;
    withResumedContext((ctx) => play(ctx, peak));
  } catch {
    /* ignore autoplay / AudioContext errors */
  }
}

/** Preview any kitchen sound from settings. */
export function previewKitchenSound(soundType, volume) {
  playKitchenNewOrderSound({ soundType, volume });
}

/** Call after a user gesture so later kitchen alerts can play. */
export function unlockNotificationAudio() {
  try {
    const ctx = getNotifyAudioContext();
    if (ctx?.state === "suspended") ctx.resume().catch(() => {});
  } catch {
    /* ignore */
  }
}
