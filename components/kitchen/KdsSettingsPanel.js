import {
  KDS_DENSITY_OPTIONS,
  KDS_FILTER_PRESETS,
  KDS_SOUND_TYPES,
  KDS_SORT_OPTIONS,
  DEFAULT_KDS_SETTINGS,
} from "../../lib/kdsSettings";
import { previewKitchenSound } from "../../lib/playNotificationSound";
import { Settings, X, Volume2 } from "lucide-react";

function KdsSettingsToggle({ checked, onChange, label, description }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-xl px-1 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-neutral-900/60"
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{label}</p>
        {description ? (
          <p className="mt-0.5 text-[11px] leading-snug text-gray-500 dark:text-neutral-400">
            {description}
          </p>
        ) : null}
      </div>
      <span
        className={`relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors ${
          checked ? "bg-primary" : "bg-gray-200 dark:bg-neutral-700"
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            checked ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
    </button>
  );
}

export default function KdsSettingsPanel({
  open,
  onClose,
  settings,
  onChange,
  onSave,
  onReset,
}) {
  if (!open) return null;

  const draft = settings;

  const set = (patch) => onChange({ ...draft, ...patch });

  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-label="Close settings"
        onClick={onClose}
      />
      <aside
        className="relative flex h-full w-full max-w-[420px] flex-col bg-white shadow-2xl dark:bg-neutral-950 dark:shadow-black/50 animate-[kdsSettingsSlideIn_0.22s_ease-out]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kds-settings-title"
      >
        <style jsx>{`
          @keyframes kdsSettingsSlideIn {
            from {
              transform: translateX(100%);
              opacity: 0.85;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
        `}</style>

        <header className="flex shrink-0 items-start gap-3 border-b border-gray-100 px-5 py-4 dark:border-neutral-800">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Settings className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 pt-0.5">
            <h2
              id="kds-settings-title"
              className="text-base font-bold text-gray-900 dark:text-white"
            >
              Kitchen display settings
            </h2>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-neutral-400">
              Saved on this device for your account
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <div className="space-y-7">
            {/* Sound */}
            <section>
              <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400 dark:text-neutral-500">
                Sound
              </h3>
              <p className="mb-2 text-[11px] leading-snug text-gray-500 dark:text-neutral-400">
                Alert when a new ticket appears in New Orders.
              </p>
              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                <KdsSettingsToggle
                  label="New order sound"
                  description="Play alert when a ticket arrives"
                  checked={draft.soundEnabled}
                  onChange={(v) => set({ soundEnabled: v })}
                />
                {draft.soundEnabled && (
                  <>
                    <div className="py-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          Volume
                        </span>
                        <span className="text-xs font-bold tabular-nums text-primary">
                          {draft.soundVolume}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={20}
                        max={100}
                        value={draft.soundVolume}
                        onChange={(e) =>
                          set({ soundVolume: Number(e.target.value) })
                        }
                        className="h-1.5 w-full cursor-pointer accent-primary"
                      />
                    </div>
                    <div className="py-2">
                      <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                        Alert tone
                      </p>
                      <div className="space-y-1.5">
                        {KDS_SOUND_TYPES.map((tone) => {
                          const on = draft.soundType === tone.id;
                          return (
                            <button
                              key={tone.id}
                              type="button"
                              onClick={() => set({ soundType: tone.id })}
                              className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left transition-all ${
                                on
                                  ? "border-primary bg-primary/5 dark:bg-primary/10"
                                  : "border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold text-gray-900 dark:text-white">
                                  {tone.label}
                                </p>
                                <p className="text-[10px] text-gray-500 dark:text-neutral-400">
                                  {tone.description}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  previewKitchenSound(tone.id, draft.soundVolume);
                                }}
                                className="shrink-0 rounded-lg border border-gray-200 p-1.5 text-gray-500 hover:text-primary dark:border-neutral-700"
                                title="Preview"
                              >
                                <Volume2 className="h-3.5 w-3.5" />
                              </button>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <KdsSettingsToggle
                      label="Repeat until seen"
                      description={`Re-alert every ${draft.soundRepeatSeconds}s while ticket stays in New Orders`}
                      checked={draft.soundRepeat}
                      onChange={(v) => set({ soundRepeat: v })}
                    />
                    {draft.soundRepeat && (
                      <div className="pb-2 pl-1">
                        <label className="text-[11px] font-semibold text-gray-500 dark:text-neutral-400">
                          Repeat interval (seconds)
                        </label>
                        <input
                          type="number"
                          min={10}
                          max={120}
                          value={draft.soundRepeatSeconds}
                          onChange={(e) =>
                            set({
                              soundRepeatSeconds: Math.min(
                                120,
                                Math.max(10, Number(e.target.value) || 25),
                              ),
                            })
                          }
                          className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                        />
                      </div>
                    )}
                  </>
                )}
              </div>
            </section>

            {/* Display */}
            <section>
              <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400 dark:text-neutral-500">
                Display density
              </h3>
              <div className="mb-3 flex rounded-xl bg-gray-100 p-1 dark:bg-neutral-900">
                {KDS_DENSITY_OPTIONS.map((opt) => {
                  const on = draft.density === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => set({ density: opt.id })}
                      className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                        on
                          ? "bg-white text-gray-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                          : "text-gray-500 hover:text-gray-700 dark:text-neutral-400"
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
              <p className="mb-2 text-[11px] text-gray-400 dark:text-neutral-500">
                {KDS_DENSITY_OPTIONS.find((o) => o.id === draft.density)?.description}
              </p>
              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                <KdsSettingsToggle
                  label="Customer name"
                  checked={draft.showCustomer}
                  onChange={(v) => set({ showCustomer: v })}
                />
                <KdsSettingsToggle
                  label="Waiter / order taker"
                  checked={draft.showWaiter}
                  onChange={(v) => set({ showWaiter: v })}
                />
                <KdsSettingsToggle
                  label="Order reference ID"
                  checked={draft.showOrderId}
                  onChange={(v) => set({ showOrderId: v })}
                />
                <KdsSettingsToggle
                  label="Table number"
                  checked={draft.showTable}
                  onChange={(v) => set({ showTable: v })}
                />
                <KdsSettingsToggle
                  label="Delivery address"
                  checked={draft.showAddress}
                  onChange={(v) => set({ showAddress: v })}
                />
              </div>
            </section>

            {/* Workflow */}
            <section>
              <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400 dark:text-neutral-500">
                Workflow
              </h3>
              <div className="mb-3">
                <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
                  Sort tickets by
                </p>
                <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-neutral-900">
                  {KDS_SORT_OPTIONS.map((opt) => {
                    const on = draft.sortBy === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => set({ sortBy: opt.id })}
                        className={`flex-1 rounded-lg py-2 text-xs font-bold transition-all ${
                          on
                            ? "bg-white text-gray-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                            : "text-gray-500 dark:text-neutral-400"
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-neutral-800">
                <KdsSettingsToggle
                  label="Pin urgent orders"
                  description="Orders past urgent threshold float to the top"
                  checked={draft.pinUrgent}
                  onChange={(v) => set({ pinUrgent: v })}
                />
                <KdsSettingsToggle
                  label="Hide Ready column"
                  description="Focus on New + Preparing only"
                  checked={draft.hideReadyColumn}
                  onChange={(v) => set({ hideReadyColumn: v })}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  { key: "urgencyWarning", label: "Warning (min)" },
                  { key: "urgencyUrgent", label: "Urgent (min)" },
                  { key: "urgencyCritical", label: "Critical (min)" },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-[10px] font-bold uppercase tracking-wide text-gray-400">
                      {label}
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={draft[key]}
                      onChange={(e) =>
                        set({
                          [key]: Math.min(
                            120,
                            Math.max(1, Number(e.target.value) || DEFAULT_KDS_SETTINGS[key]),
                          ),
                        })
                      }
                      className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                    />
                  </div>
                ))}
              </div>
            </section>

            {/* Filter presets */}
            <section>
              <h3 className="mb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-gray-400 dark:text-neutral-500">
                Filter preset
              </h3>
              <p className="mb-2 text-[11px] leading-snug text-gray-500 dark:text-neutral-400">
                Quick view applied on load and from the top bar.
              </p>
              <div className="space-y-1.5">
                {KDS_FILTER_PRESETS.map((preset) => {
                  const on = draft.filterPreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => set({ filterPreset: preset.id })}
                      className={`flex w-full flex-col rounded-xl border px-3 py-2.5 text-left transition-all ${
                        on
                          ? "border-primary bg-primary/5 dark:bg-primary/10"
                          : "border-gray-200 dark:border-neutral-700 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-xs font-bold text-gray-900 dark:text-white">
                        {preset.label}
                      </span>
                      <span className="text-[10px] text-gray-500 dark:text-neutral-400">
                        {preset.description}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-3">
                <KdsSettingsToggle
                  label="Use as default on open"
                  description="Remember this filter when you return to KDS"
                  checked={draft.defaultFilterPreset === draft.filterPreset}
                  onChange={(v) =>
                    set({
                      defaultFilterPreset: v ? draft.filterPreset : "all",
                    })
                  }
                />
              </div>
            </section>
          </div>
        </div>

        <footer className="flex shrink-0 gap-2 border-t border-gray-100 px-5 py-4 dark:border-neutral-800">
          <button
            type="button"
            onClick={onReset}
            className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
          >
            Reset defaults
          </button>
          <button
            type="button"
            onClick={onSave}
            className="ml-auto flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary/90"
          >
            Save settings
          </button>
        </footer>
      </aside>
    </div>
  );
}
