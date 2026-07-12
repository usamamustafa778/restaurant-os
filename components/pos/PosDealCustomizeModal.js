import { useMemo, useState } from "react";
import {
  buildModifierSelectionsFromPicks,
  buildPickFromDealOption,
  choiceOptionNeedsVariation,
  comboItemToPosChoiceSlot,
  countSlotPicks,
  formatChoiceOptionLabel,
  getComboItemType,
  getRequiredVariationGroups,
  getSlotPickBounds,
  isDealSelectionComplete,
  normalizeChoiceOption,
} from "../../lib/dealComboItems";

function VariationPickerPanel({
  menuItem,
  variationPicks,
  onChangePick,
  onCancel,
  onConfirm,
  canConfirm,
}) {
  const groups = getRequiredVariationGroups(menuItem);

  return (
    <div className="border-t border-gray-100 dark:border-neutral-800">
      <div className="border-b border-gray-100 px-5 py-4 dark:border-neutral-800">
        <p className="text-xs font-semibold uppercase tracking-wide text-orange-600 dark:text-orange-400">
          Choose variation
        </p>
        <h4 className="mt-1 text-base font-bold text-gray-900 dark:text-white">
          {menuItem?.name || "Item"}
        </h4>
      </div>
      <div className="space-y-4 p-5">
        {groups.map((group) => (
          <div key={group.id}>
            <p className="mb-2 text-sm font-semibold text-gray-900 dark:text-white">
              {group.groupName || group.name || "Variation"}
            </p>
            <div className="space-y-2">
              {(group.options || [])
                .filter((option) => option.isAvailable !== false)
                .map((option) => {
                  const selected =
                    String(variationPicks[String(group.id)] || "") ===
                    String(option.id);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() =>
                        onChangePick(String(group.id), String(option.id))
                      }
                      className={`flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                        selected
                          ? "border-orange-400 bg-orange-50 text-orange-900 dark:border-orange-500 dark:bg-orange-500/10 dark:text-orange-100"
                          : "border-gray-200 bg-white text-gray-800 hover:border-orange-300 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100"
                      }`}
                    >
                      <span className="font-medium">{option.name}</span>
                      {selected ? (
                        <span className="h-4 w-4 rounded-full border-2 border-orange-500 bg-orange-500" />
                      ) : (
                        <span className="h-4 w-4 rounded-full border-2 border-gray-300 bg-white dark:border-neutral-600" />
                      )}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 border-t border-gray-100 p-5 dark:border-neutral-800">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl border border-gray-200 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
        >
          Back
        </button>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={onConfirm}
          className={`flex-1 rounded-xl py-3 text-sm font-bold transition-colors ${
            canConfirm
              ? "bg-orange-500 text-white hover:bg-orange-600"
              : "cursor-not-allowed bg-gray-200 text-gray-400 dark:bg-neutral-800 dark:text-neutral-500"
          }`}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

function ChoiceSlotBlock({
  slot,
  slotIndex,
  selections,
  onChangeSelections,
  onConfigureOption,
}) {
  const { min, max } = getSlotPickBounds(slot);
  const currentCount = countSlotPicks(selections);
  const isSinglePick = min === 1 && max === 1;

  function trySelectOption(opt) {
    if (choiceOptionNeedsVariation(opt, slot._menuItemById)) {
      onConfigureOption({ slotIndex, option: opt, mode: "replace" });
      return;
    }
    const pick = buildPickFromDealOption(opt, slot._menuItemById);
    if (!pick) return;
    onChangeSelections(slotIndex, [pick]);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/60">
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
          const normalized = normalizeChoiceOption(opt);
          const pickKey = `${normalized?.menuItemId}|${optionIndex}`;
          const selected =
            isSinglePick &&
            selections.some(
              (p) =>
                String(p.menuItemId) === String(normalized?.menuItemId) &&
                JSON.stringify(p.modifierSelections || []) ===
                  JSON.stringify(normalized?.modifierSelections || []),
            );
          return (
            <button
              key={pickKey}
              type="button"
              onClick={() => trySelectOption(opt)}
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
  const [variationFlow, setVariationFlow] = useState(null);
  const [variationPicks, setVariationPicks] = useState({});

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

  const variationMenuItem = variationFlow
    ? menuItemById.get(
        String(
          normalizeChoiceOption(variationFlow.option)?.menuItemId || "",
        ),
      )
    : null;

  const variationGroups = variationMenuItem
    ? getRequiredVariationGroups(variationMenuItem)
    : [];

  const variationComplete = variationGroups.every((group) =>
    Boolean(variationPicks[String(group.id)]),
  );

  const canConfirm = isDealSelectionComplete(deal, selectionsBySlot);
  const comboPrice = Number(deal?.comboPrice || 0);
  const totalPrice = comboPrice * Math.max(1, pendingQty);

  function updateSlotSelections(slotIndex, picks) {
    setSelectionsBySlot((prev) => ({ ...prev, [slotIndex]: picks }));
  }

  function openVariationFlow(flow) {
    setVariationFlow(flow);
    const normalized = normalizeChoiceOption(flow.option);
    const existing = {};
    for (const sel of normalized?.modifierSelections || []) {
      const option = (sel.options || [])[0];
      if (sel.groupId && option?.optionId) {
        existing[String(sel.groupId)] = String(option.optionId);
      }
    }
    setVariationPicks(existing);
  }

  function confirmVariationPick() {
    if (!variationFlow || !variationMenuItem || !variationComplete) return;
    const modifierSelections = buildModifierSelectionsFromPicks(
      variationMenuItem,
      variationPicks,
    );
    const normalized = normalizeChoiceOption(variationFlow.option);
    const pick = {
      menuItemId: normalized.menuItemId,
      name: formatChoiceOptionLabel(
        { ...variationFlow.option, modifierSelections },
        menuItemById,
      ),
      qty: 1,
      modifierSelections,
    };
    updateSlotSelections(variationFlow.slotIndex, [pick]);
    setVariationFlow(null);
    setVariationPicks({});
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end justify-center p-0 sm:items-center sm:p-4"
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

        {variationFlow ? (
          <VariationPickerPanel
            menuItem={variationMenuItem}
            variationPicks={variationPicks}
            onChangePick={(groupId, optionId) =>
              setVariationPicks((prev) => ({ ...prev, [groupId]: optionId }))
            }
            onCancel={() => {
              setVariationFlow(null);
              setVariationPicks({});
            }}
            onConfirm={confirmVariationPick}
            canConfirm={variationComplete}
          />
        ) : (
          <>
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
                    onConfigureOption={openVariationFlow}
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
          </>
        )}
      </div>
    </div>
  );
}
