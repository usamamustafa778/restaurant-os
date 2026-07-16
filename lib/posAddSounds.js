/** POS cart-add beep presets (Web Audio oscillators — no audio files). */

export const POS_ADD_SOUND_PRESETS = [
  {
    id: "chime",
    label: "Chime",
    description: "Two-tone rise — clear and friendly",
  },
  {
    id: "click",
    label: "Click",
    description: "Short crisp tap",
  },
  {
    id: "pop",
    label: "Pop",
    description: "Soft low bubble",
  },
  {
    id: "ding",
    label: "Ding",
    description: "Bell-style single note",
  },
  {
    id: "blip",
    label: "Blip",
    description: "Quick double pulse",
  },
];

export const POS_ADD_SOUND_IDS = POS_ADD_SOUND_PRESETS.map((p) => p.id);

export function normalizePosAddSoundId(value) {
  const id = String(value || "").toLowerCase().trim();
  return POS_ADD_SOUND_IDS.includes(id) ? id : "chime";
}

/**
 * @param {AudioContext} ctx
 * @param {string} soundId
 * @param {number} peakGain 0–1 peak amplitude
 */
export function playPosAddTone(ctx, soundId, peakGain = 0.28) {
  const peak = Math.max(0.02, Math.min(0.5, peakGain));
  const now = ctx.currentTime;
  const id = normalizePosAddSoundId(soundId);

  const tone = (freq, start, dur, type = "sine", gainMul = 1) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now + start);
    const p = peak * gainMul;
    gain.gain.setValueAtTime(0.0001, now + start);
    gain.gain.exponentialRampToValueAtTime(p, now + start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + start);
    osc.stop(now + start + dur + 0.02);
  };

  switch (id) {
    case "click":
      tone(1800, 0, 0.045, "square", 0.55);
      break;
    case "pop":
      tone(320, 0, 0.09, "sine", 1);
      tone(180, 0.02, 0.08, "triangle", 0.45);
      break;
    case "ding":
      tone(1319, 0, 0.22, "sine", 1);
      tone(2637, 0, 0.12, "sine", 0.35);
      break;
    case "blip":
      tone(880, 0, 0.06, "sine", 0.9);
      tone(1175, 0.08, 0.07, "sine", 0.85);
      break;
    case "chime":
    default:
      tone(880, 0, 0.1, "sine", 0.85);
      tone(1319, 0.11, 0.14, "sine", 1);
      break;
  }
}

let sharedPosFeedbackCtx = null;

/**
 * Play the branch POS feedback beep when Sound on add is enabled.
 * @param {{ posSoundOnAdd?: boolean, posSoundVolume?: number, posSoundBeep?: string } | null | undefined} branchOrSettings
 * @param {{ force?: boolean, volume?: number, beepId?: string }} [opts]
 */
export function playPosFeedbackSound(branchOrSettings, opts = {}) {
  if (typeof window === "undefined") return;
  const enabled =
    opts.force === true || branchOrSettings?.posSoundOnAdd === true;
  if (!enabled) return;

  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    let ctx = sharedPosFeedbackCtx;
    if (!ctx || ctx.state === "closed") {
      ctx = new AudioCtx();
      sharedPosFeedbackCtx = ctx;
    }

    const raw =
      opts.volume !== undefined && opts.volume !== null
        ? Number(opts.volume)
        : Number(branchOrSettings?.posSoundVolume);
    const volPct = Number.isFinite(raw)
      ? Math.min(100, Math.max(1, Math.round(raw)))
      : 70;
    const peak = Math.max(0.02, (volPct / 100) * 0.42);
    const beepId = normalizePosAddSoundId(
      opts.beepId ?? branchOrSettings?.posSoundBeep,
    );

    const start = () => playPosAddTone(ctx, beepId, peak);
    if (ctx.state === "suspended") {
      ctx
        .resume()
        .then(() => start())
        .catch(() => {});
      return;
    }
    start();
  } catch {
    /* ignore */
  }
}
