import { useMemo, useState } from "react";
import {
  buildPickFromDealOption,
  comboItemToPosChoiceSlot,
  countSlotPicks,
  formatChoiceOptionLabel,
  getComboItemType,
  getSlotPickBounds,
  isDealSelectionComplete,
} from "../../lib/dealComboItems";

function ChoiceSlotBlock({ slot, slotIndex, selections, onChangeSelections }) {
  const { min, max } = getSlotPickBounds(slot);
  const currentCount = countSlotPicks(selections);
  const isSinglePick = min === 1 && max === 1;

  function selectOption(opt) {
    const pick = buildPickFromDealOption(opt, slot._menuItemById);
    if (!pick) return;
    onChangeSelections(slotIndex, [pick]);
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-800/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h4 className="text-sm font-bold text-gray-900 dark:text-white">
          {slot.label || "Choose item"}
        </h4>
        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
          {isSinglePick ? "Pick 1" : `Pick ${min}${min !== max ? `–${max}` : ""}`}
        </span>
      </div>
      <div className="space-y-2">
        {(slot.options || []).map((opt, optionIndex) => {
          const label = formatChoiceOptionLabel(opt, slot._menuItemById);
          const pickKey = `${opt.menuItemId}|${optionIndex}`;
          const selected =
            isSinglePick &&
            selections.some((p) => String(p.menuItemId) === String(opt.menuItemId));
          return (
            <button
              key={pickKey}
              type="button"
              onClick={() => selectOption(opt)}
              disabled={!isSinglePick && currentCount >= max}
              className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                selected
                  ? "border-orange-400 bg-orange-50 text-orange-900 dark:border-orange-500 dark:bg-orange-500/10 dark:text-orange-100"
                  : "border-gray-200 bg-white text-gray-800 hover:border-orange-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
              }`}
            >
              <span className="font-medium">{label}</span>
              {isSinglePick ? (
                <span
                  className={`h-4 w-4 rounded-full border-2 ${
                    selected
                      ? "border-orange-500 bg-orange-500"
                      : "border-gray-300 bg-white dark:border-neutral-600"
                  }`}
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function PosDealCustomizeModal({
  deal,
  menuItems = [],
  pendingQty = 1,
  onClose,
  onConfirm,
}) {
  const [selectionsBySlot, setSelectionsBySlot] = useState({});

  const menuItemById = useMemo(
    () => new Map(menuItems.map((m) => [String(m.id || m._id), m])),
    [menuItems],
  );

  const choiceSlots = useMemo(() => {
    return (deal?.comboItems || [])
      .map((ci, slotIndex) => {
        if (getComboItemType(ci) !== "choice") return null;
        const slot = comboItemToPosChoiceSlot(ci, menuItemById);
        if (!slot) return null;
        return { ...slot, slotIndex, _menuItemById: menuItemById };
      })
      .filter(Boolean);
  }, [deal, menuItemById]);

  const canConfirm = isDealSelectionComplete(deal, selectionsBySlot);
  const comboPrice = Number(deal?.comboPrice || 0);
  const totalPrice = comboPrice * Math.max(1, pendingQty);

  function updateSlotSelections(slotIndex, picks) {
    setSelectionsBySlot((prev) => ({ ...prev, [slotIndex]: picks }));
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative max-h-[90vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-gray-100 p-5 dark:border-neutral-800">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {deal?.name}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
                Choose options for each item in this deal
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-xl leading-none text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="space-y-4 p-5">
          {choiceSlots.map((slot) => {
            const picks =
              selectionsBySlot[slot.slotIndex] ||
              selectionsBySlot[String(slot.slotIndex)] ||
              [];
            return (
              <ChoiceSlotBlock
                key={`slot-${slot.slotIndex}`}
                slot={slot}
                slotIndex={slot.slotIndex}
                selections={picks}
                onChangeSelections={updateSlotSelections}
              />
            );
          })}
        </div>

        <div className="border-t border-gray-100 p-5 dark:border-neutral-800">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm?.(deal, pendingQty, selectionsBySlot)}
            className={`w-full rounded-xl py-3 text-base font-bold transition-colors ${
              canConfirm
                ? "bg-orange-500 text-white hover:bg-orange-600"
                : "cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-neutral-800 dark:text-neutral-500"
            }`}
          >
            {canConfirm
              ? `Add to cart — Rs ${totalPrice.toLocaleString()}`
              : "Complete all choices above"}
          </button>
        </div>
      </div>
    </div>
  );
}
