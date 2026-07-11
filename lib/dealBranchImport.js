import {
  getComboItemType,
  normalizeModifierSelections,
  normalizeChoiceOption,
} from "./dealComboItems";

function normalizeName(name) {
  return String(name || "").trim().toLowerCase();
}

function variationNamesFingerprint(modifierSelections) {
  return normalizeModifierSelections(modifierSelections || [])
    .flatMap((sel) => (sel.options || []).map((o) => normalizeName(o.name)))
    .filter(Boolean)
    .sort()
    .join("|");
}

export function buildDestMenuIndex(destMenuItems = []) {
  const byName = new Map();
  for (const item of destMenuItems) {
    const key = normalizeName(item.name);
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(item);
  }
  return byName;
}

function getGroupsForItem(item) {
  const legacy = (item?.modifierGroups || []).map((g) => ({
    id: String(g.id || g._id || ""),
    groupName: g.groupName || g.name || "",
    options: g.options || [],
    type: g.type,
    required: g.required,
  }));
  const attached = (item?.attachedModifierGroups || []).map((g) => ({
    id: String(g.id || g._id || ""),
    groupName: g.name || g.groupName || "",
    options: g.options || [],
    type: g.type || "addon",
    required: g.required,
  }));
  return [...legacy, ...attached];
}

export function remapModifierSelectionsToDestItem(sourceMods, destItem) {
  const groups = getGroupsForItem(destItem);
  const remapped = [];
  for (const sel of normalizeModifierSelections(sourceMods)) {
    const group = groups.find(
      (g) => normalizeName(g.groupName) === normalizeName(sel.groupName),
    );
    if (!group) continue;
    const options = [];
    for (const srcOpt of sel.options || []) {
      const match = (group.options || []).find(
        (o) => normalizeName(o.name) === normalizeName(srcOpt.name),
      );
      if (!match) continue;
      options.push({
        optionId: String(match.id || match._id || ""),
        name: match.name,
        price: Number(match.price) || 0,
      });
    }
    if (!options.length) continue;
    remapped.push({
      groupId: String(group.id),
      groupName: group.groupName,
      options,
    });
  }
  return remapped;
}

function resolveSourceMenuItem(ref, sourceMenuById, populatedMenuItem) {
  if (populatedMenuItem && typeof populatedMenuItem === "object" && populatedMenuItem.name) {
    return populatedMenuItem;
  }
  const id = String(
    ref?.menuItem?._id ||
      ref?.menuItem?.id ||
      ref?.menuItem ||
      ref?.menuItemId ||
      ref?._id ||
      ref?.id ||
      "",
  );
  return id ? sourceMenuById?.get(id) : null;
}

function pickDestItemForSource(sourceItem, sourceMods, destCandidates) {
  if (!destCandidates.length) return null;
  const sourceVarFp = variationNamesFingerprint(sourceMods);
  if (!sourceVarFp) return destCandidates[0];

  const exact = destCandidates.find((candidate) => {
    const remapped = remapModifierSelectionsToDestItem(sourceMods, candidate);
    return variationNamesFingerprint(remapped) === sourceVarFp;
  });
  if (exact) return exact;

  const partial = destCandidates.find((candidate) => {
    const remapped = remapModifierSelectionsToDestItem(sourceMods, candidate);
    return remapped.length > 0;
  });
  return partial || destCandidates[0];
}

function requiredVariationSatisfied(destItem, remappedMods) {
  const requiredGroups = getGroupsForItem(destItem).filter(
    (g) => g.required !== false || g.type === "variation",
  );
  if (!requiredGroups.length) return true;
  return remappedMods.length >= requiredGroups.length;
}

/**
 * Map combo deal components from a source branch to the current branch menu
 * using item names and variation labels (not Mongo ids).
 */
export function mapDealComboItemsToBranch(
  sourceComboItems = [],
  { sourceMenuById, destMenuByName },
) {
  const mapped = [];

  for (const ci of sourceComboItems) {
    const type = getComboItemType(ci);
    if (type === "choice") {
      const mappedOptions = [];
      for (const opt of ci.options || []) {
        const normalized = normalizeChoiceOption(opt);
        const sourceItem = resolveSourceMenuItem(opt, sourceMenuById, opt?.menuItem);
        if (!sourceItem?.name) continue;

        const destCandidates = destMenuByName.get(normalizeName(sourceItem.name)) || [];
        const destItem = pickDestItemForSource(
          sourceItem,
          normalized?.modifierSelections,
          destCandidates,
        );
        if (!destItem) continue;

        const remappedMods = remapModifierSelectionsToDestItem(
          normalized?.modifierSelections,
          destItem,
        );
        if (!requiredVariationSatisfied(destItem, remappedMods)) continue;

        const payload = { menuItem: String(destItem.id || destItem._id) };
        if (remappedMods.length) payload.modifierSelections = remappedMods;
        mappedOptions.push(payload);
      }

      if (!mappedOptions.length) continue;
      mapped.push({
        type: "choice",
        label: ci.label || "",
        quantity: Math.max(1, Number(ci.quantity) || 1),
        options: mappedOptions,
        minSelect: ci.minSelect ?? 1,
        maxSelect: ci.maxSelect ?? 1,
      });
      continue;
    }

    const sourceItem = resolveSourceMenuItem(ci, sourceMenuById, ci?.menuItem);
    if (!sourceItem?.name) continue;

    const destCandidates = destMenuByName.get(normalizeName(sourceItem.name)) || [];
    const sourceMods = normalizeModifierSelections(ci.modifierSelections);
    const destItem = pickDestItemForSource(sourceItem, sourceMods, destCandidates);
    if (!destItem) continue;

    const remappedMods = remapModifierSelectionsToDestItem(sourceMods, destItem);
    if (!requiredVariationSatisfied(destItem, remappedMods)) continue;

    const fixedPayload = {
      type: "fixed",
      menuItem: String(destItem.id || destItem._id),
      quantity: Math.max(1, Number(ci.quantity) || 1),
    };
    if (remappedMods.length) fixedPayload.modifierSelections = remappedMods;
    mapped.push(fixedPayload);
  }

  return mapped;
}

export function collectMissingDealImportItems(sourceComboItems, destMenuByName, sourceMenuById) {
  const missing = new Set();
  for (const ci of sourceComboItems || []) {
    const type = getComboItemType(ci);
    if (type === "choice") {
      for (const opt of ci.options || []) {
        const sourceItem = resolveSourceMenuItem(opt, sourceMenuById, opt?.menuItem);
        if (!sourceItem?.name) {
          missing.add("Unknown item");
          continue;
        }
        if (!destMenuByName.has(normalizeName(sourceItem.name))) {
          missing.add(sourceItem.name);
        }
      }
      continue;
    }
    const sourceItem = resolveSourceMenuItem(ci, sourceMenuById, ci?.menuItem);
    if (!sourceItem?.name) {
      missing.add("Unknown item");
      continue;
    }
    if (!destMenuByName.has(normalizeName(sourceItem.name))) {
      missing.add(sourceItem.name);
    }
  }
  return [...missing];
}
