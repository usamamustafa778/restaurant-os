/**
 * Partition permission rows for nested roles-editor UI.
 * Empty/missing subgroup → ungrouped (flat list at top of the group).
 * Subgroup order follows first appearance in `items` (seed/list sort).
 */
export function partitionBySubgroup(items = []) {
  const byName = new Map();
  const ungrouped = [];
  const order = [];

  for (const p of items) {
    const name = String(p?.subgroup || "").trim();
    if (!name) {
      ungrouped.push(p);
      continue;
    }
    if (!byName.has(name)) {
      byName.set(name, []);
      order.push(name);
    }
    byName.get(name).push(p);
  }

  return {
    ungrouped,
    subgroups: order.map((name) => ({ name, items: byName.get(name) || [] })),
  };
}

export function subgroupExpandKey(group, subgroup) {
  return `${group}::${subgroup}`;
}
