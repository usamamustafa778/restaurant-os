import { useEffect, useMemo, useRef, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/PermissionGate";
import Button from "../../components/ui/Button";
import DataTable from "../../components/ui/DataTable";
import PageLoader from "../../components/ui/PageLoader";
import ViewToggle from "../../components/ui/ViewToggle";
import { useBranch } from "../../contexts/BranchContext";
import { usePermissions } from "../../contexts/PermissionContext";
import { usePageData } from "../../hooks/usePageData";
import { useViewMode } from "../../hooks/useViewMode";
import { useConfirmDialog } from "../../contexts/ConfirmDialogContext";
import { handleAsyncAction } from "../../utils/toastActions";
import {
  getMenu,
  getDeals,
  getDealCategories,
  createDealCategory,
  updateDealCategory,
  deleteDealCategory,
  createDeal,
  updateDeal,
  deleteDeal,
  getCurrencySymbol,
  uploadImage,
} from "../../lib/apiClient";
import {
  Plus,
  Trash2,
  Edit2,
  Loader2,
  Percent,
  ShoppingBag,
  Upload,
  Link,
  X,
  Calendar,
  Tag,
  ArrowUpDown,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  FileDown,
  FileText,
  Printer,
  Building2,
  FolderOpen,
  PanelLeftClose,
  PanelLeftOpen,
  AlertTriangle,
  Search,
  Check,
  Copy,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  buildModifierSelectionsFromPicks,
  comboItemToComponent,
  componentToComboItem,
  findMatchingFixedComponentIndex,
  formatComboItemSummary,
  formatChoiceOptionLabel,
  formatVariationLabel,
  formatMenuItemPriceHint,
  choiceOptionKey,
  choiceOptionHasStaleReferences,
  choiceOptionUnitPrice,
  collectDealComponentStaleIssues,
  fixedComponentHasStaleReferences,
  getComboItemType,
  getRequiredVariationGroups,
  itemHasRequiredVariations,
  modifierSelectionsFingerprint,
  priceFromModifierSelections,
  validateComponents,
} from "../../lib/dealComboItems";
import {
  buildDestMenuIndex,
  collectMissingDealImportItems,
  mapDealComboItemsToBranch,
} from "../../lib/dealBranchImport";

function parseCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (!inQ && c === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out.map((s) => s.replace(/^"|"$/g, "").replace(/""/g, '"'));
}

function toCSVRow(cells) {
  return cells.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",");
}

function parseEndDateForPayload(endDateLike) {
  const raw = String(endDateLike ?? "").trim();
  if (!raw) return null;
  const end = new Date(raw);
  if (Number.isNaN(end.getTime())) return null;
  return end.toISOString();
}

function getDealCategoryId(deal) {
  if (!deal?.category) return null;
  if (typeof deal.category === "object") {
    return String(deal.category._id || deal.category.id || "") || null;
  }
  return String(deal.category);
}

function buildDealsGroupedByCategory(deals, dealCategories) {
  const sortedCats = [...(dealCategories || [])]
    .filter((c) => c.isActive !== false)
    .sort(
      (a, b) =>
        (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
        a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    );
  const groups = sortedCats
    .map((cat) => ({
      categoryId: cat.id,
      categoryName: cat.name,
      deals: deals.filter((d) => getDealCategoryId(d) === cat.id),
    }))
    .filter((g) => g.deals.length > 0);
  const uncategorized = deals.filter((d) => !getDealCategoryId(d));
  if (uncategorized.length) {
    groups.push({
      categoryId: null,
      categoryName: "Uncategorized",
      deals: uncategorized,
    });
  }
  return groups;
}

function getEmptyForm() {
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: null,
    name: "",
    description: "",
    components: [],
    comboPrice: "",
    reservationCharges: "",
    startDate: today,
    endDate: "",
    isActive: true,
    imageUrl: "",
    categoryId: "",
  };
}

/** e.g. Rs. 500/- */
function formatDealItemPrice(sym, amount) {
  const n = Number(amount) || 0;
  const prefix = String(sym) === "Rs" ? "Rs." : String(sym || "");
  return `${prefix} ${n.toLocaleString()}/-`;
}

/** Search menu and add an item. Choice mode drafts a slot, then Done commits it. */
function DealInlineMenuSearch({
  menuItems,
  menuCategories = [],
  onPick,
  placeholder = "Search menu…",
  currencySymbol = "",
  choiceMode = false,
  onChoiceModeChange,
  choiceHeading = "",
  onChoiceHeadingChange,
  draftOptions = [],
  onRemoveDraftOption,
  formatDraftOptionLabel,
  getDraftOptionPrice,
  onDoneChoice,
  menuItemById,
}) {
  const sym = currencySymbol;
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categoryQuery, setCategoryQuery] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [sizeItemId, setSizeItemId] = useState(null);
  const [sizePicks, setSizePicks] = useState({});
  const [open, setOpen] = useState(false);
  const categoryBoxRef = useRef(null);
  const searchRootRef = useRef(null);
  const asChoice = !!choiceMode;

  const categoryOptions = useMemo(() => {
    const opts = (menuCategories || [])
      .map((c) => ({ id: String(c.id || c._id), name: c.name }))
      .filter((c) => c.id && c.name);
    return opts;
  }, [menuCategories]);

  const selectedCategoryLabel =
    categoryFilter === "all"
      ? "All categories"
      : categoryOptions.find((c) => c.id === categoryFilter)?.name ||
        "All categories";

  const filteredCategories = useMemo(() => {
    const term = categoryQuery.trim().toLowerCase();
    const all = [{ id: "all", name: "All categories" }, ...categoryOptions];
    if (!term) return all;
    return all.filter((c) =>
      String(c.name || "")
        .toLowerCase()
        .includes(term),
    );
  }, [categoryOptions, categoryQuery]);

  useEffect(() => {
    if (!categoryOpen) return undefined;
    function handleDown(e) {
      if (
        categoryBoxRef.current &&
        !categoryBoxRef.current.contains(e.target)
      ) {
        setCategoryOpen(false);
        setCategoryQuery("");
      }
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [categoryOpen]);

  useEffect(() => {
    if (!open) return undefined;
    function handleDown(e) {
      if (
        searchRootRef.current &&
        !searchRootRef.current.contains(e.target)
      ) {
        setOpen(false);
        setSizeItemId(null);
        setSizePicks({});
      }
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [open]);

  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    const filtered = menuItems.filter((item) => {
      const catId = String(
        item.categoryId || item.category?.id || item.category?._id || "",
      );
      if (categoryFilter !== "all" && catId !== categoryFilter) return false;
      if (
        term &&
        !String(item.name || "")
          .toLowerCase()
          .includes(term)
      )
        return false;
      return true;
    });
    if (!term && categoryFilter === "all") return [];
    return filtered.sort((a, b) => a.name.localeCompare(b.name)).slice(0, 12);
  }, [menuItems, query, categoryFilter]);

  const showDropdown =
    open && (query.trim().length > 0 || categoryFilter !== "all");

  function isDraftSelected(menuItemId, modifierSelections = []) {
    const key = choiceOptionKey({ menuItemId, modifierSelections });
    return (draftOptions || []).some((o) => choiceOptionKey(o) === key);
  }

  function itemHasAnyDraftSelection(menuItemId) {
    return (draftOptions || []).some(
      (o) => String(o.menuItemId) === String(menuItemId),
    );
  }

  function resetSearch() {
    setQuery("");
    setSizeItemId(null);
    setSizePicks({});
  }

  function commit(menuItemId, modifierSelections = []) {
    if (asChoice) {
      const key = choiceOptionKey({ menuItemId, modifierSelections });
      if ((draftOptions || []).some((o) => choiceOptionKey(o) === key)) {
        onRemoveDraftOption?.(key);
      } else {
        onPick(String(menuItemId), modifierSelections || [], true);
      }
      return;
    }
    onPick(String(menuItemId), modifierSelections || [], false);
    resetSearch();
    setOpen(false);
  }

  function pickCategory(id) {
    setCategoryFilter(id);
    setCategoryOpen(false);
    setCategoryQuery("");
    setOpen(true);
    setSizeItemId(null);
    setSizePicks({});
  }

  return (
    <div className="relative space-y-2">
      {asChoice ? (
        <div>
          <label className="mb-1 block text-[11px] font-medium text-gray-600 dark:text-neutral-400">
            Choice slot heading <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={choiceHeading}
            onChange={(e) => onChoiceHeadingChange?.(e.target.value)}
            placeholder="Choose your pizza."
            className="w-full rounded-lg border border-secondary/30 bg-white px-3 py-2 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus:border-secondary focus:ring-2 focus:ring-secondary/15 dark:border-secondary/40 dark:bg-neutral-900 dark:text-white"
          />
        </div>
      ) : null}

      <div className="relative" ref={searchRootRef}>
        <div className="flex items-end gap-2">
          <div className="relative min-w-0 flex-1">
            <label className="mb-1 block text-[11px] font-medium text-gray-600 dark:text-neutral-400">
              Select item
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={query}
                onFocus={() => setOpen(true)}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                  setSizeItemId(null);
                  setSizePicks({});
                }}
                placeholder={placeholder}
                className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-8 pr-3 text-xs text-gray-900 outline-none placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
              />
            </div>
          </div>

          <div className="relative w-[9.5rem] shrink-0" ref={categoryBoxRef}>
            <label className="mb-1 block text-[11px] font-medium text-gray-600 dark:text-neutral-400">
              Category
            </label>
            <button
              type="button"
              onClick={() => {
                setCategoryOpen((v) => !v);
                setCategoryQuery("");
              }}
              className="flex h-[34px] w-full items-center justify-between gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-left text-[11px] font-medium text-gray-700 outline-none hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/10 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
              aria-haspopup="listbox"
              aria-expanded={categoryOpen}
            >
              <span className="truncate">{selectedCategoryLabel}</span>
              <ChevronDown
                className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition ${categoryOpen ? "rotate-180" : ""}`}
              />
            </button>
            {categoryOpen ? (
              <div className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                <div className="border-b border-gray-100 p-1.5 dark:border-neutral-800">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      autoFocus
                      value={categoryQuery}
                      onChange={(e) => setCategoryQuery(e.target.value)}
                      placeholder="Search categories…"
                      className="w-full rounded-md border border-gray-200 bg-white py-1.5 pl-7 pr-2 text-[11px] outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                    />
                  </div>
                </div>
                <ul className="max-h-40 overflow-y-auto py-1" role="listbox">
                  {filteredCategories.length === 0 ? (
                    <li className="px-2.5 py-2 text-[11px] text-gray-400">
                      No categories
                    </li>
                  ) : (
                    filteredCategories.map((cat) => {
                      const active = cat.id === categoryFilter;
                      return (
                        <li key={cat.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={active}
                            onClick={() => pickCategory(cat.id)}
                            className={`flex w-full px-2.5 py-1.5 text-left text-[11px] ${
                              active
                                ? "bg-primary/10 font-semibold text-primary"
                                : "text-gray-700 hover:bg-gray-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
                            }`}
                          >
                            {cat.name}
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={asChoice}
            onClick={() => {
              onChoiceModeChange?.(!asChoice);
            }}
            className={`mb-0 flex h-[34px] shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-semibold transition ${
              asChoice
                ? "border-secondary/40 bg-secondary/10 text-secondary"
                : "border-gray-200 bg-white text-gray-500 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400"
            }`}
            title={
              asChoice
                ? "On: build a guest choice slot"
                : "Off: always included in the deal"
            }
          >
            <span
              className={`relative inline-flex h-4 w-7 shrink-0 rounded-full transition ${
                asChoice ? "bg-secondary" : "bg-gray-300 dark:bg-neutral-600"
              }`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition ${
                  asChoice ? "left-3.5" : "left-0.5"
                }`}
              />
            </span>
            Choice
          </button>
        </div>

        {showDropdown ? (
          <div className="absolute left-0 right-0 top-full z-20 mt-0.5 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
            {results.length === 0 ? (
              <p className="px-3 py-3 text-[11px] text-gray-400">
                {query.trim()
                  ? `No items match “${query.trim()}”`
                  : "No items in this category"}
              </p>
            ) : (
              results.map((item) => {
                const itemId = String(item.id);
                const hasVariations = itemHasRequiredVariations(item);
                const variationGroups = getRequiredVariationGroups(item);
                const expanded = sizeItemId === itemId;
                const priceHint = formatMenuItemPriceHint(item, sym);
                const plainSelected =
                  asChoice && !hasVariations && isDraftSelected(itemId, []);
                const anyVariationSelected =
                  asChoice &&
                  hasVariations &&
                  itemHasAnyDraftSelection(itemId);

                return (
                  <div
                    key={itemId}
                    className="border-b border-gray-100 last:border-0 dark:border-neutral-800"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (!hasVariations) {
                          commit(itemId, []);
                          return;
                        }
                        setSizeItemId(expanded ? null : itemId);
                        setSizePicks({});
                      }}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-neutral-800 ${
                        plainSelected || anyVariationSelected
                          ? "bg-emerald-50/70 dark:bg-emerald-950/20"
                          : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-gray-800 dark:text-neutral-200">
                        {item.name}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {priceHint ? (
                          <span className="text-[11px] font-medium tabular-nums text-gray-500 dark:text-neutral-400">
                            {priceHint}
                          </span>
                        ) : null}
                        {hasVariations ? (
                          anyVariationSelected ? (
                            <Check
                              className="h-4 w-4 text-emerald-600"
                              strokeWidth={2.5}
                              aria-label="Selected"
                            />
                          ) : (
                            <span className="text-[10px] text-gray-400">
                              {expanded ? "Pick size" : "Needs size"}
                            </span>
                          )
                        ) : plainSelected ? (
                          <Check
                            className="h-4 w-4 text-emerald-600"
                            strokeWidth={2.5}
                            aria-label="Selected"
                          />
                        ) : (
                          <span className="text-[10px] font-semibold text-primary">
                            {asChoice ? "Add option" : "Add"}
                          </span>
                        )}
                      </span>
                    </button>
                    {expanded && hasVariations ? (
                      <div className="space-y-2 bg-gray-50 px-3 pb-3 dark:bg-neutral-950/60">
                        {variationGroups.map((group) => (
                          <div key={group.id}>
                            <p className="mb-1 text-[10px] font-semibold uppercase text-gray-400">
                              {group.groupName}
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {(group.options || [])
                                .filter((o) => o.isAvailable !== false)
                                .map((option) => {
                                  const canQuick =
                                    variationGroups.length === 1;
                                  const nextPicks = {
                                    ...sizePicks,
                                    [String(group.id)]: String(option.id),
                                  };
                                  const modsForOption = canQuick
                                    ? buildModifierSelectionsFromPicks(
                                        item,
                                        {
                                          [String(group.id)]: String(
                                            option.id,
                                          ),
                                        },
                                      )
                                    : null;
                                  const inDraft =
                                    asChoice &&
                                    canQuick &&
                                    modsForOption &&
                                    isDraftSelected(itemId, modsForOption);
                                  const picking =
                                    String(sizePicks[String(group.id)]) ===
                                    String(option.id);
                                  const optPrice = Number(option.price) || 0;
                                  return (
                                    <button
                                      key={option.id}
                                      type="button"
                                      onClick={() => {
                                        if (canQuick) {
                                          commit(
                                            itemId,
                                            buildModifierSelectionsFromPicks(
                                              item,
                                              nextPicks,
                                            ),
                                          );
                                          return;
                                        }
                                        setSizePicks(nextPicks);
                                      }}
                                      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                                        inDraft
                                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                                          : picking
                                            ? "border-primary bg-primary text-white"
                                            : "border-gray-200 bg-white text-gray-600 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300"
                                      }`}
                                    >
                                      {inDraft ? (
                                        <Check
                                          className="h-3 w-3"
                                          strokeWidth={2.5}
                                        />
                                      ) : null}
                                      {option.name}
                                    {optPrice > 0
                                      ? ` · ${formatDealItemPrice(sym, optPrice)}`
                                      : ""}
                                    </button>
                                  );
                                })}
                            </div>
                          </div>
                        ))}
                        {variationGroups.length > 1 ? (
                          <button
                            type="button"
                            onClick={() => {
                              const mods = buildModifierSelectionsFromPicks(
                                item,
                                sizePicks,
                              );
                              if (mods.length < variationGroups.length) {
                                toast.error("Select every size / option");
                                return;
                              }
                              commit(itemId, mods);
                            }}
                            className={`w-full rounded-lg py-1.5 text-[11px] font-semibold text-white ${
                              asChoice &&
                              isDraftSelected(
                                itemId,
                                buildModifierSelectionsFromPicks(
                                  item,
                                  sizePicks,
                                ),
                              )
                                ? "bg-emerald-600"
                                : "bg-primary"
                            }`}
                          >
                            {asChoice &&
                            isDraftSelected(
                              itemId,
                              buildModifierSelectionsFromPicks(item, sizePicks),
                            )
                              ? "Remove option"
                              : asChoice
                                ? "Add option"
                                : "Add"}
                          </button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        ) : null}
      </div>

      <p className="text-[10px] text-gray-400 dark:text-neutral-500">
        {asChoice
          ? "Add options below, then click Done to save this choice slot."
          : "Search the menu. Turn on Choice to build a guest pick slot."}
      </p>

      {asChoice && draftOptions.length > 0 ? (
        <div className="space-y-1 rounded-lg border border-secondary/20 bg-white p-2 dark:border-secondary/30 dark:bg-neutral-950/40">
          {draftOptions.map((opt) => {
            const key = choiceOptionKey(opt);
            const label =
              formatDraftOptionLabel?.(opt) ||
              formatChoiceOptionLabel(opt, menuItemById);
            const unitPrice =
              getDraftOptionPrice?.(opt) ??
              choiceOptionUnitPrice(opt, menuItemById);
            return (
              <div
                key={key}
                className="flex items-center justify-between gap-2 rounded-md border border-gray-100 bg-gray-50 px-2.5 py-1.5 dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="min-w-0">
                  <span className="text-xs font-medium text-gray-800 dark:text-neutral-200">
                    {label}
                  </span>
                  {unitPrice > 0 ? (
                    <span className="ml-2 text-[11px] font-medium tabular-nums text-gray-500">
                      {formatDealItemPrice(sym, unitPrice)}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveDraftOption?.(key)}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  aria-label="Remove option"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      {asChoice ? (
        <div className="flex items-center justify-end gap-2 pt-0.5">
          <button
            type="button"
            onClick={() => onChoiceModeChange?.(false)}
            className="rounded-lg px-3 py-1.5 text-[11px] font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onDoneChoice?.()}
            className="rounded-lg bg-secondary px-3.5 py-1.5 text-[11px] font-semibold text-white hover:opacity-90"
          >
            Done
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function DealsPage() {
  const sym = getCurrencySymbol();
  const { currentBranch, branches } = useBranch() || {};
  const { hasPermission } = usePermissions();
  const { confirm } = useConfirmDialog();
  const { viewMode, setViewMode } = useViewMode("table");

  const fetchDeals = () =>
    currentBranch?.id ? getDeals(true, currentBranch.id) : getDeals(true);
  const {
    data: deals,
    loading: pageLoading,
    error,
    suspended,
    setData: setDeals,
    refetch,
  } = usePageData(fetchDeals, [currentBranch?.id]);

  const fetchMenu = () => getMenu(currentBranch?.id);
  const { data: menuData } = usePageData(fetchMenu, [currentBranch?.id]);
  const menuItems = menuData?.items || [];
  const menuCategories = menuData?.categories || [];

  const fetchDealCategories = () => getDealCategories();
  const {
    data: dealCategoriesData,
    setData: setDealCategoriesData,
    refetch: refetchDealCategories,
  } = usePageData(fetchDealCategories);
  const dealCategories = Array.isArray(dealCategoriesData)
    ? dealCategoriesData
    : [];

  const [form, setForm] = useState(getEmptyForm);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [modalError, setModalError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [imageTab, setImageTab] = useState("link");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [importLoading, setImportLoading] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [branchImportModalOpen, setBranchImportModalOpen] = useState(false);
  const [branchImportSourceId, setBranchImportSourceId] = useState("");
  const [branchImportSourceDeals, setBranchImportSourceDeals] = useState([]);
  const [branchImportSourceLoading, setBranchImportSourceLoading] =
    useState(false);
  const [branchImportSelectedIds, setBranchImportSelectedIds] = useState([]);
  const [branchImportSourceMenu, setBranchImportSourceMenu] = useState([]);
  const [branchImportSourceMenuLoading, setBranchImportSourceMenuLoading] =
    useState(false);
  const [branchImportSubmitting, setBranchImportSubmitting] = useState(false);
  const [categoriesPanelOpen, setCategoriesPanelOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categorySavingId, setCategorySavingId] = useState(null);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [showReservationField, setShowReservationField] = useState(false);
  const [addItemsOpen, setAddItemsOpen] = useState(false);
  const [choiceMode, setChoiceMode] = useState(false);
  const [choiceDraftLabel, setChoiceDraftLabel] = useState("");
  const [choiceDraftOptions, setChoiceDraftOptions] = useState([]);
  const [editingChoiceIndex, setEditingChoiceIndex] = useState(null);
  const fileInputRef = useRef(null);
  const imageFileInputRef = useRef(null);
  const exportMenuRef = useRef(null);
  const importMenuRef = useRef(null);

  const dealsList = Array.isArray(deals) ? deals : [];
  const dealBelongsToCurrentBranch = (deal) => {
    if (!currentBranch?.id) return true;
    return (deal?.branches || []).some((branchRef) => {
      const id =
        typeof branchRef === "string"
          ? branchRef
          : branchRef?.id || branchRef?._id;
      return String(id || "") === String(currentBranch.id);
    });
  };
  const sourceBranches = (branches || []).filter(
    (b) => b.id !== currentBranch?.id,
  );
  const canImportFromBranch = !!currentBranch?.id && sourceBranches.length > 0;

  useEffect(() => {
    if (!exportMenuOpen) return;
    function handleDown(e) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [exportMenuOpen]);

  useEffect(() => {
    if (!importMenuOpen) return;
    function handleDown(e) {
      if (importMenuRef.current && !importMenuRef.current.contains(e.target)) {
        setImportMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [importMenuOpen]);

  useEffect(() => {
    if (!branchImportModalOpen || !branchImportSourceId) {
      setBranchImportSourceDeals([]);
      setBranchImportSelectedIds([]);
      setBranchImportSourceMenu([]);
      return;
    }
    let cancelled = false;
    setBranchImportSourceLoading(true);
    setBranchImportSourceMenuLoading(true);
    Promise.all([
      getDeals(true, branchImportSourceId),
      getMenu(branchImportSourceId),
    ])
      .then(([allDeals, sourceMenu]) => {
        if (cancelled) return;
        const sourceDeals = (Array.isArray(allDeals) ? allDeals : []).filter(
          (deal) =>
            (deal.branches || []).some((branchRef) => {
              const id =
                typeof branchRef === "string"
                  ? branchRef
                  : branchRef?.id || branchRef?._id;
              return String(id || "") === String(branchImportSourceId);
            }),
        );
        setBranchImportSourceDeals(sourceDeals);
        setBranchImportSelectedIds([]);
        setBranchImportSourceMenu(sourceMenu?.items || []);
      })
      .catch(() => {
        if (!cancelled) {
          setBranchImportSourceDeals([]);
          setBranchImportSourceMenu([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBranchImportSourceLoading(false);
          setBranchImportSourceMenuLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [branchImportModalOpen, branchImportSourceId]);

  const filtered = dealsList
    .filter((deal) => {
      const term = search.trim().toLowerCase();
      if (
        term &&
        !deal.name.toLowerCase().includes(term) &&
        !(deal.description || "").toLowerCase().includes(term)
      )
        return false;
      if (filterStatus === "active" && !getDealStatus(deal)) return false;
      if (filterStatus === "inactive" && getDealStatus(deal)) return false;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "newest")
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      if (sortBy === "oldest")
        return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
      if (sortBy === "price_asc")
        return (a.comboPrice || 0) - (b.comboPrice || 0);
      if (sortBy === "price_desc")
        return (b.comboPrice || 0) - (a.comboPrice || 0);
      return 0;
    });

  const dealsGroupedByCategory = useMemo(
    () => buildDealsGroupedByCategory(filtered, dealCategories),
    [filtered, dealCategories],
  );

  const sortedDealCategories = useMemo(
    () =>
      [...dealCategories].sort(
        (a, b) =>
          (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
          a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
      ),
    [dealCategories],
  );

  const categoryOrderNormalizedRef = useRef(false);

  useEffect(() => {
    if (categoryOrderNormalizedRef.current || sortedDealCategories.length < 2)
      return;

    const orders = sortedDealCategories.map((c) => c.displayOrder ?? 0);
    const hasDuplicateOrders = new Set(orders).size !== orders.length;
    if (!hasDuplicateOrders) return;

    categoryOrderNormalizedRef.current = true;
    const updates = sortedDealCategories.map((cat, index) => ({
      id: cat.id,
      displayOrder: index,
    }));

    (async () => {
      try {
        await Promise.all(
          updates.map((u) =>
            updateDealCategory(u.id, { displayOrder: u.displayOrder }),
          ),
        );
        const orderById = new Map(updates.map((u) => [u.id, u.displayOrder]));
        setDealCategoriesData((prev) => {
          if (!Array.isArray(prev)) return prev;
          return prev
            .map((c) =>
              orderById.has(c.id)
                ? { ...c, displayOrder: orderById.get(c.id) }
                : c,
            )
            .sort(
              (a, b) =>
                (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
                a.name.localeCompare(b.name, undefined, {
                  sensitivity: "base",
                }),
            );
        });
      } catch {
        categoryOrderNormalizedRef.current = false;
      }
    })();
  }, [sortedDealCategories, setDealCategoriesData]);

  const dealCountByCategoryId = useMemo(() => {
    const counts = new Map();
    for (const deal of dealsList) {
      const catId = getDealCategoryId(deal);
      if (catId) counts.set(catId, (counts.get(catId) || 0) + 1);
    }
    return counts;
  }, [dealsList]);

  const menuItemById = new Map(menuItems.map((m) => [String(m.id), m]));

  const staleDealIssues = useMemo(
    () => collectDealComponentStaleIssues(form.components, menuItemById),
    [form.components, menuItems],
  );
  const comboPriceNum = Number(form.comboPrice) || 0;
  const reservationChargesNum = Math.max(
    0,
    Number(form.reservationCharges) || 0,
  );
  const foodDealPriceNum = Math.max(0, comboPriceNum - reservationChargesNum);

  async function handleCreateDealCategory(e) {
    e?.preventDefault?.();
    const name = newCategoryName.trim();
    if (!name) {
      toast.error("Category name is required");
      return;
    }
    setCategorySavingId("new");
    try {
      const created = await createDealCategory({ name });
      setDealCategoriesData((prev) =>
        Array.isArray(prev)
          ? [...prev, created].sort(
              (a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0),
            )
          : [created],
      );
      setNewCategoryName("");
      toast.success("Category created");
    } catch (err) {
      toast.error(err?.message || "Failed to create category");
    } finally {
      setCategorySavingId(null);
    }
  }

  async function handleSaveCategoryRename(categoryId) {
    const name = editingCategoryName.trim();
    if (!name) {
      toast.error("Category name is required");
      return;
    }
    setCategorySavingId(categoryId);
    try {
      const updated = await updateDealCategory(categoryId, { name });
      setDealCategoriesData((prev) =>
        Array.isArray(prev)
          ? prev.map((c) => (c.id === categoryId ? updated : c))
          : prev,
      );
      setEditingCategoryId(null);
      setEditingCategoryName("");
      toast.success("Category updated");
    } catch (err) {
      toast.error(err?.message || "Failed to update category");
    } finally {
      setCategorySavingId(null);
    }
  }

  async function handleDeleteDealCategory(categoryId) {
    const count = dealCountByCategoryId.get(categoryId) || 0;
    const ok = await confirm({
      title: "Delete deal category",
      message:
        count > 0
          ? `Delete this category? ${count} deal(s) will become uncategorized.`
          : "Delete this category?",
    });
    if (!ok) return;
    setCategorySavingId(categoryId);
    try {
      await deleteDealCategory(categoryId);
      setDealCategoriesData((prev) =>
        Array.isArray(prev) ? prev.filter((c) => c.id !== categoryId) : prev,
      );
      setDeals((prev) =>
        Array.isArray(prev)
          ? prev.map((d) =>
              getDealCategoryId(d) === categoryId
                ? { ...d, category: null }
                : d,
            )
          : prev,
      );
      if (form.categoryId === categoryId) {
        setForm((f) => ({ ...f, categoryId: "" }));
      }
      toast.success("Category deleted");
    } catch (err) {
      toast.error(err?.message || "Failed to delete category");
    } finally {
      setCategorySavingId(null);
    }
  }

  async function moveDealCategory(categoryId, direction) {
    const list = [...sortedDealCategories];
    const index = list.findIndex((c) => c.id === categoryId);
    if (index < 0) return;
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const reordered = [...list];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    const updates = reordered.map((cat, order) => ({
      id: cat.id,
      displayOrder: order,
    }));
    const orderById = new Map(updates.map((u) => [u.id, u.displayOrder]));

    setCategorySavingId(categoryId);
    setDealCategoriesData((prev) => {
      if (!Array.isArray(prev)) return prev;
      return prev
        .map((c) =>
          orderById.has(c.id) ? { ...c, displayOrder: orderById.get(c.id) } : c,
        )
        .sort(
          (a, b) =>
            (a.displayOrder ?? 0) - (b.displayOrder ?? 0) ||
            a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
        );
    });

    try {
      await Promise.all(
        updates.map((u) =>
          updateDealCategory(u.id, { displayOrder: u.displayOrder }),
        ),
      );
    } catch (err) {
      await refetchDealCategories();
      toast.error(err?.message || "Failed to reorder categories");
    } finally {
      setCategorySavingId(null);
    }
  }

  function startCreate() {
    if (!currentBranch?.id) {
      toast.error(
        "Please select a specific branch from the header before creating deals.",
      );
      return;
    }
    setForm(getEmptyForm());
    setModalError("");
    setImageTab("link");
    setUploadError("");
    setShowReservationField(false);
    setAddItemsOpen(false);
    resetChoiceDraft();
    setIsModalOpen(true);
  }

  function startEdit(deal) {
    if (currentBranch?.id && !dealBelongsToCurrentBranch(deal)) {
      toast.error(
        "This deal belongs to another branch. Switch to that branch to edit it.",
      );
      return;
    }
    const id = deal._id || deal.id;
    const reservation =
      deal.reservationCharges != null && Number(deal.reservationCharges) > 0
        ? String(deal.reservationCharges)
        : "";
    setForm({
      id,
      name: deal.name || "",
      description: deal.description || "",
      components: (deal.comboItems || []).map(comboItemToComponent),
      comboPrice: deal.comboPrice != null ? String(deal.comboPrice) : "",
      reservationCharges: reservation,
      startDate: deal.startDate ? deal.startDate.slice(0, 10) : "",
      endDate: deal.endDate ? deal.endDate.slice(0, 10) : "",
      isActive: deal.isActive !== false,
      imageUrl: deal.imageUrl || "",
      categoryId: getDealCategoryId(deal) || "",
    });
    setModalError("");
    setImageTab("link");
    setUploadError("");
    setShowReservationField(Boolean(reservation));
    setAddItemsOpen((deal.comboItems || []).length > 0);
    resetChoiceDraft();
    setIsModalOpen(true);
  }

  function resetChoiceDraft() {
    setChoiceMode(false);
    setChoiceDraftLabel("");
    setChoiceDraftOptions([]);
    setEditingChoiceIndex(null);
  }

  function removeComponent(index) {
    setForm((prev) => ({
      ...prev,
      components: prev.components.filter((_, i) => i !== index),
    }));
    setEditingChoiceIndex((prev) => {
      if (prev == null) return null;
      if (prev === index) return null;
      if (prev > index) return prev - 1;
      return prev;
    });
  }

  function updateComponent(index, patch) {
    setForm((prev) => ({
      ...prev,
      components: prev.components.map((comp, i) =>
        i === index ? { ...comp, ...patch } : comp,
      ),
    }));
  }

  function handleChoiceModeChange(enabled) {
    if (enabled) {
      setChoiceMode(true);
      setChoiceDraftLabel("");
      setChoiceDraftOptions([]);
      setEditingChoiceIndex(null);
      setAddItemsOpen(true);
      return;
    }
    resetChoiceDraft();
  }

  function startEditChoiceSlot(index) {
    const comp = form.components[index];
    if (!comp || comp.type !== "choice") return;
    setChoiceMode(true);
    setChoiceDraftLabel(comp.label || "");
    setChoiceDraftOptions([...(comp.options || [])]);
    setEditingChoiceIndex(index);
    setAddItemsOpen(true);
  }

  function finishChoiceDraft() {
    const label = choiceDraftLabel.trim();
    if (!label) {
      toast.error("Enter a choice slot heading");
      return;
    }
    if (!choiceDraftOptions.length) {
      toast.error("Add at least one item to this choice slot");
      return;
    }

    const slot = {
      type: "choice",
      label,
      quantity: 1,
      options: choiceDraftOptions.map((opt) => ({
        menuItemId: String(opt.menuItemId),
        modifierSelections: opt.modifierSelections || [],
      })),
      minSelect: 1,
      maxSelect: 1,
    };

    setForm((prev) => {
      if (
        editingChoiceIndex != null &&
        prev.components[editingChoiceIndex]?.type === "choice"
      ) {
        return {
          ...prev,
          components: prev.components.map((c, i) =>
            i === editingChoiceIndex ? { ...slot } : c,
          ),
        };
      }
      return {
        ...prev,
        components: [...prev.components, slot],
      };
    });
    resetChoiceDraft();
  }

  function addFixedComponent(menuItemId, modifierSelections = []) {
    setForm((prev) => {
      const idx = findMatchingFixedComponentIndex(
        prev.components,
        menuItemId,
        modifierSelections,
      );
      if (idx >= 0) {
        return {
          ...prev,
          components: prev.components.map((c, i) =>
            i === idx ? { ...c, quantity: (Number(c.quantity) || 1) + 1 } : c,
          ),
        };
      }
      return {
        ...prev,
        components: [
          ...prev.components,
          {
            type: "fixed",
            menuItemId,
            quantity: 1,
            modifierSelections: modifierSelections || [],
          },
        ],
      };
    });
  }

  /** Add as fixed, or into the in-progress choice draft. */
  function addDealItem(menuItemId, modifierSelections = [], asChoice = false) {
    if (!asChoice) {
      addFixedComponent(menuItemId, modifierSelections);
      return;
    }

    const key = choiceOptionKey({ menuItemId, modifierSelections });
    setChoiceDraftOptions((prev) => {
      if (prev.some((o) => choiceOptionKey(o) === key)) return prev;
      return [
        ...prev,
        { menuItemId, modifierSelections: modifierSelections || [] },
      ];
    });
  }

  function removeDraftChoiceOption(optionKey) {
    setChoiceDraftOptions((prev) =>
      prev.filter((o) => choiceOptionKey(o) !== optionKey),
    );
  }

  function removeChoiceOptionAt(componentIndex, optionKey) {
    setForm((prev) => {
      const components = [...prev.components];
      const comp = components[componentIndex];
      if (!comp || comp.type !== "choice") return prev;
      const nextOptions = (comp.options || []).filter(
        (o) => choiceOptionKey(o) !== optionKey,
      );
      if (nextOptions.length === 0) {
        setEditingChoiceIndex((prevIdx) => {
          if (prevIdx == null) return null;
          if (prevIdx === componentIndex) return null;
          if (prevIdx > componentIndex) return prevIdx - 1;
          return prevIdx;
        });
        return {
          ...prev,
          components: components.filter((_, i) => i !== componentIndex),
        };
      }
      components[componentIndex] = { ...comp, options: nextOptions };
      return { ...prev, components };
    });
  }

  function setFixedComponentQuantityAt(index, qty) {
    const q = Math.max(1, Number(qty) || 1);
    updateComponent(index, { quantity: q });
  }

  function incrementFixedComponentAt(index) {
    setForm((prev) => {
      const comp = prev.components[index];
      if (!comp || comp.type === "choice") return prev;
      return {
        ...prev,
        components: prev.components.map((c, i) =>
          i === index ? { ...c, quantity: (Number(c.quantity) || 1) + 1 } : c,
        ),
      };
    });
  }

  function decrementFixedComponentAt(index) {
    setForm((prev) => {
      const comp = prev.components[index];
      if (!comp || comp.type === "choice") return prev;
      if ((Number(comp.quantity) || 1) <= 1) {
        return {
          ...prev,
          components: prev.components.filter((_, i) => i !== index),
        };
      }
      return {
        ...prev,
        components: prev.components.map((c, i) =>
          i === index ? { ...c, quantity: (Number(c.quantity) || 1) - 1 } : c,
        ),
      };
    });
  }

  function duplicateChoiceSlot(index) {
    setForm((prev) => {
      const comp = prev.components[index];
      if (!comp || comp.type !== "choice") return prev;
      const copy = {
        type: "choice",
        label: comp.label || "Choose one",
        quantity: Math.max(1, Number(comp.quantity) || 1),
        minSelect: Math.max(1, Number(comp.minSelect) || 1),
        maxSelect: Math.max(1, Number(comp.maxSelect) || 1),
        options: (comp.options || []).map((opt) => ({
          menuItemId: String(opt.menuItemId),
          modifierSelections: opt.modifierSelections || [],
        })),
      };
      const components = [...prev.components];
      components.splice(index + 1, 0, copy);
      return { ...prev, components };
    });
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const result = await uploadImage(file);
      setForm((f) => ({ ...f, imageUrl: result.url }));
      setImageTab("link");
    } catch (err) {
      setUploadError(err.message || "Upload failed");
    } finally {
      setUploading(false);
      if (imageFileInputRef.current) imageFileInputRef.current.value = "";
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) {
      setModalError("Deal name is required");
      toast.error("Deal name is required");
      return;
    }
    if (!form.comboPrice) {
      setModalError("Deal price is required");
      toast.error("Deal price is required");
      return;
    }
    const componentError = validateComponents(form.components, menuItemById);
    if (componentError) {
      setModalError(componentError);
      toast.error(componentError);
      return;
    }

    setModalError("");
    setIsLoading(true);

    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      dealType: "COMBO",
      comboItems: form.components.map(componentToComboItem),
      comboPrice: Number(form.comboPrice),
      reservationCharges: Math.max(0, Number(form.reservationCharges) || 0),
      startDate: new Date(form.startDate || new Date()).toISOString(),
      endDate: parseEndDateForPayload(form.endDate),
      isActive: form.isActive,
      showOnWebsite: form.isActive,
      showOnPOS: form.isActive,
      branches: currentBranch?.id ? [currentBranch.id] : [],
      imageUrl: form.imageUrl.trim() || undefined,
      category: form.categoryId || null,
    };

    const result = await handleAsyncAction(
      async () => {
        if (form.id) {
          const updated = await updateDeal(form.id, payload);
          setDeals((prev) =>
            Array.isArray(prev)
              ? prev.map((d) => ((d._id || d.id) === form.id ? updated : d))
              : prev,
          );
          return updated;
        } else {
          const created = await createDeal(payload);
          setDeals((prev) =>
            Array.isArray(prev) ? [...prev, created] : [created],
          );
          return created;
        }
      },
      {
        loading: form.id ? "Updating deal..." : "Creating deal...",
        success: form.id
          ? "Deal updated successfully"
          : "Deal created successfully",
        error: "Failed to save deal",
      },
    );

    setIsLoading(false);

    if (result.success) {
      setForm(getEmptyForm());
      resetChoiceDraft();
      setIsModalOpen(false);
    } else {
      setModalError(result.error);
    }
  }

  async function handleDelete(id) {
    const ok = await confirm({
      title: "Delete deal",
      message: "Delete this deal? This cannot be undone.",
    });
    if (!ok) return;

    setDeletingId(id);

    await handleAsyncAction(
      async () => {
        await deleteDeal(id);
        setDeals((prev) =>
          Array.isArray(prev)
            ? prev.filter((d) => (d._id || d.id) !== id)
            : prev,
        );
      },
      {
        loading: "Deleting deal...",
        success: "Deal deleted successfully",
        error: "Failed to delete deal",
      },
    );

    setDeletingId(null);
  }

  function getDealStatus(deal) {
    const now = new Date();
    if (!deal.isActive) return false;
    if (deal.startDate && new Date(deal.startDate) > now) return false;
    if (deal.endDate && new Date(deal.endDate) < now) return false;
    return true;
  }

  function getDealStatusLabel(deal) {
    const now = new Date();
    if (!deal.isActive) return "Inactive";
    if (deal.startDate && new Date(deal.startDate) > now) return "Scheduled";
    if (deal.endDate && new Date(deal.endDate) < now) return "Expired";
    return "Active";
  }

  function exportCSV() {
    const date = new Date().toLocaleDateString("en-PK");
    const branchName = currentBranch?.name || "All Branches";
    const rows = [
      ["Deals Report"],
      ["Branch", branchName],
      ["Generated", date],
      [],
      [
        "Name",
        "Description",
        "Items",
        "Deal Price",
        "Start Date",
        "End Date",
        "Status",
      ],
      ...filtered.map((deal) => {
        const comboItems = (deal.comboItems || [])
          .map(
            (ci) =>
              `${ci.menuItem?.name || "Item"} x${Number(ci.quantity) || 1}`,
          )
          .join(" | ");
        const startDate = deal.startDate
          ? String(deal.startDate).slice(0, 10)
          : "";
        const endDate = deal.endDate ? String(deal.endDate).slice(0, 10) : "";
        return [
          deal.name || "",
          deal.description || "",
          comboItems,
          deal.comboPrice ?? "",
          startDate,
          endDate,
          getDealStatusLabel(deal),
        ];
      }),
      [],
      ["SUMMARY"],
      ["Total Deals", filtered.length],
      ["Active", filtered.filter((d) => getDealStatus(d)).length],
      ["Inactive", filtered.filter((d) => !getDealStatus(d)).length],
    ];
    const content = rows.map(toCSVRow).join("\n");
    const blob = new Blob(["\uFEFF" + content], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deals-${branchName.replace(/\s/g, "-")}-${date.replace(/\//g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exported — open in Excel");
    setExportMenuOpen(false);
  }

  function buildDealsHTML(title, extraStyle = "") {
    const date = new Date().toLocaleDateString("en-PK", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const branchName = currentBranch?.name || "All Branches";
    const activeCount = filtered.filter((d) => getDealStatus(d)).length;
    const inactiveCount = filtered.length - activeCount;
    const rows = filtered
      .map((deal) => {
        const comboItems = (deal.comboItems || [])
          .map(
            (ci) =>
              `${ci.menuItem?.name || "Item"} x${Number(ci.quantity) || 1}`,
          )
          .join(", ");
        const status = getDealStatus(deal);
        const statusStyle = status
          ? "background:#f0fdf4;color:#16a34a;"
          : "background:#f3f4f6;color:#4b5563;";
        return `<tr>
          <td><strong>${deal.name || ""}</strong>${deal.description ? `<br><span style="font-size:11px;color:#6b7280">${deal.description}</span>` : ""}</td>
          <td>${comboItems || "-"}</td>
          <td style="font-weight:700">${sym} ${Number(deal.comboPrice || 0).toLocaleString()}</td>
          <td>${deal.startDate ? String(deal.startDate).slice(0, 10) : "-"}</td>
          <td>${deal.endDate ? String(deal.endDate).slice(0, 10) : "-"}</td>
          <td><span style="font-weight:700;padding:2px 8px;border-radius:4px;font-size:11px;${statusStyle}">${status ? "Active" : "Inactive"}</span></td>
        </tr>`;
      })
      .join("");

    return `<!DOCTYPE html><html><head><title>${title}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:40px;color:#111;max-width:1100px;margin:0 auto}
  h1{font-size:22px;font-weight:800;margin-bottom:4px}
  .meta{font-size:12px;color:#6b7280;margin-bottom:20px}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px}
  .stat{border:1px solid #e5e7eb;border-radius:10px;padding:12px 16px}
  .stat-label{font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;margin-bottom:4px}
  .stat-value{font-size:22px;font-weight:800}
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;padding:8px 12px;border-bottom:2px solid #e5e7eb}
  td{padding:9px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;vertical-align:middle}
  tr:hover td{background:#fafafa}
  ${extraStyle}
  @media print{body{padding:0}button{display:none}}
</style></head><body>
<h1>Deals Report</h1>
<p class="meta">${branchName} &nbsp;·&nbsp; ${date}</p>
<div class="summary">
  <div class="stat"><div class="stat-label">Total Deals</div><div class="stat-value" style="color:#1d4ed8">${filtered.length}</div></div>
  <div class="stat"><div class="stat-label">Active</div><div class="stat-value" style="color:#16a34a">${activeCount}</div></div>
  <div class="stat"><div class="stat-label">Inactive</div><div class="stat-value" style="color:#6b7280">${inactiveCount}</div></div>
</div>
<table>
  <thead><tr><th>Name</th><th>Items</th><th>Deal Price</th><th>Start Date</th><th>End Date</th><th>Status</th></tr></thead>
  <tbody>${rows || '<tr><td colspan="6" style="text-align:center;color:#9ca3af;padding:32px">No deals match current filter</td></tr>'}</tbody>
</table>
</body></html>`;
  }

  function exportPDF() {
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Pop-up blocked — please allow pop-ups.");
      return;
    }
    win.document.write(
      buildDealsHTML("Deals - PDF", "@media print{@page{size:A4 landscape}}"),
    );
    win.document.close();
    setTimeout(() => {
      win.print();
    }, 300);
    setExportMenuOpen(false);
  }

  function printDeals() {
    const win = window.open("", "_blank");
    if (!win) {
      toast.error("Pop-up blocked — please allow pop-ups.");
      return;
    }
    win.document.write(buildDealsHTML("Deals - Print"));
    win.document.close();
    setTimeout(() => {
      win.print();
    }, 300);
    setExportMenuOpen(false);
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!currentBranch?.id) {
      toast.error("Select a branch in the header before importing.");
      return;
    }
    if (!menuItems.length) {
      toast.error("Add menu items before importing deals.");
      return;
    }
    let text;
    try {
      text = await file.text();
    } catch {
      toast.error("Could not read file");
      return;
    }
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trimEnd())
      .filter((l) => l.trim());
    if (!lines.length) {
      toast.error("CSV is empty");
      return;
    }

    const normHeader = (h) =>
      String(h ?? "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");

    const rowLooksLikeHeader = (cells) => {
      const set = new Set(cells.map((c) => normHeader(c)));
      return (
        set.has("name") &&
        (set.has("deal price") || set.has("price") || set.has("combo price"))
      );
    };

    const buildColMap = (cells) => {
      const col = {};
      cells.forEach((raw, i) => {
        const k = normHeader(raw);
        if (k === "name" || k === "deal name") col.name = i;
        else if (k === "description") col.description = i;
        else if (k === "items" || k === "combo items") col.items = i;
        else if (k === "deal price" || k === "price" || k === "combo price")
          col.price = i;
        else if (k === "start date" || k === "start") col.startDate = i;
        else if (k === "end date" || k === "end" || k === "expiry date")
          col.endDate = i;
        else if (k === "active" || k === "status") col.isActive = i;
        else if (k === "show on pos" || k === "showonpos") col.showOnPos = i;
      });
      return col;
    };

    const isStopRow = (cells) => {
      const a = normHeader(cells[0]);
      return (
        a === "summary" ||
        a === "total deals" ||
        a === "active" ||
        a === "inactive" ||
        a === "deals report" ||
        a === "branch" ||
        a === "generated"
      );
    };

    let headerIdx = -1;
    let col = null;
    for (let i = 0; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      if (rowLooksLikeHeader(cells)) {
        headerIdx = i;
        col = buildColMap(cells);
        break;
      }
    }
    if (col == null) {
      col = { name: 0, price: 1 };
      headerIdx = -1;
    }
    if (col.name == null || col.price == null) {
      toast.error(
        "CSV needs columns: name and deal price (or export from this page).",
      );
      return;
    }

    const parseYesNoCell = (s) => {
      const t = String(s ?? "")
        .trim()
        .toLowerCase();
      if (!t) return true;
      return t === "yes" || t === "true" || t === "1" || t === "y";
    };

    const parsePriceCell = (raw) => {
      let t = String(raw ?? "")
        .trim()
        .replace(/,/g, "");
      if (sym) {
        const esc = sym.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        t = t.replace(new RegExp(esc, "g"), "").trim();
      }
      const n = parseFloat(t);
      return Number.isFinite(n) && n >= 0 ? n : NaN;
    };

    const parseItemsCell = (raw) => {
      const itemMap = new Map(
        menuItems.map((m) => [
          String(m.name || "")
            .trim()
            .toLowerCase(),
          m,
        ]),
      );
      const value = String(raw ?? "").trim();
      if (!value) return { comboItems: [], unknown: [] };
      const parts = value
        .split(/\s*\|\s*|\s*;\s*/g)
        .map((p) => p.trim())
        .filter(Boolean);
      const comboItems = [];
      const unknown = [];
      for (const part of parts) {
        const match = part.match(/^(.+?)(?:\s*[xX]\s*(\d+))?$/);
        const name = String(match?.[1] || "").trim();
        const qty = Math.max(1, Number(match?.[2]) || 1);
        const menuItem = itemMap.get(name.toLowerCase());
        if (!menuItem) {
          unknown.push(name);
          continue;
        }
        comboItems.push({
          type: "fixed",
          menuItem: menuItem.id,
          quantity: qty,
        });
      }
      return { comboItems, unknown };
    };

    const existingNames = new Set(
      dealsList.map((d) =>
        String(d.name || "")
          .trim()
          .toLowerCase(),
      ),
    );
    const dataStart = headerIdx < 0 ? 0 : headerIdx + 1;
    const rows = [];
    for (let i = dataStart; i < lines.length; i++) {
      const cells = parseCSVLine(lines[i]);
      if (!cells.some((c) => String(c).trim())) continue;
      if (isStopRow(cells)) break;
      const name = String(cells[col.name] ?? "").trim();
      if (!name) continue;
      rows.push({
        name,
        description:
          col.description != null
            ? String(cells[col.description] ?? "").trim()
            : "",
        itemsRaw:
          col.items != null ? String(cells[col.items] ?? "").trim() : "",
        priceRaw: cells[col.price],
        startDate:
          col.startDate != null
            ? String(cells[col.startDate] ?? "").trim()
            : "",
        endDate:
          col.endDate != null ? String(cells[col.endDate] ?? "").trim() : "",
        isActiveRaw: col.isActive != null ? cells[col.isActive] : undefined,
        showOnPosRaw: col.showOnPos != null ? cells[col.showOnPos] : undefined,
      });
    }

    if (!rows.length) {
      toast.error("No deal rows found in CSV");
      return;
    }

    setImportLoading(true);
    const newDeals = [];
    let created = 0;
    let skipped = 0;
    const failReasons = [];

    try {
      for (const row of rows) {
        const key = row.name.toLowerCase();
        if (existingNames.has(key)) {
          skipped++;
          continue;
        }

        const price = parsePriceCell(row.priceRaw);
        if (Number.isNaN(price)) {
          skipped++;
          failReasons.push(`Invalid deal price (${row.name})`);
          continue;
        }

        const { comboItems, unknown } = parseItemsCell(row.itemsRaw);
        if (!comboItems.length) {
          skipped++;
          failReasons.push(
            unknown.length
              ? `Unknown items (${row.name}): ${unknown.slice(0, 2).join(", ")}`
              : `No items found (${row.name})`,
          );
          continue;
        }

        const startDate = row.startDate ? new Date(row.startDate) : new Date();
        if (Number.isNaN(startDate.getTime())) {
          skipped++;
          failReasons.push(`Invalid start date (${row.name})`);
          continue;
        }
        const endDate = row.endDate ? new Date(row.endDate) : null;
        if (endDate && Number.isNaN(endDate.getTime())) {
          skipped++;
          failReasons.push(`Invalid end date (${row.name})`);
          continue;
        }

        const resolveImportActive = () => {
          if (row.isActiveRaw !== undefined && row.isActiveRaw !== "") {
            const raw = String(row.isActiveRaw).trim().toLowerCase();
            if (
              raw === "inactive" ||
              raw === "no" ||
              raw === "false" ||
              raw === "0"
            )
              return false;
            if (
              raw === "active" ||
              raw === "yes" ||
              raw === "true" ||
              raw === "1"
            )
              return true;
            return parseYesNoCell(row.isActiveRaw);
          }
          if (row.showOnPosRaw !== undefined && row.showOnPosRaw !== "") {
            return parseYesNoCell(row.showOnPosRaw);
          }
          return true;
        };

        const payload = {
          name: row.name,
          description: row.description || "",
          dealType: "COMBO",
          comboItems,
          comboPrice: price,
          startDate: startDate.toISOString(),
          endDate: parseEndDateForPayload(endDate),
          isActive: resolveImportActive(),
          showOnWebsite: resolveImportActive(),
          showOnPOS: resolveImportActive(),
          branches: [currentBranch.id],
        };

        try {
          const createdDeal = await createDeal(payload);
          existingNames.add(key);
          newDeals.push(createdDeal);
          created++;
        } catch (err) {
          skipped++;
          const msg = err?.message || String(err);
          if (/already exists/i.test(msg)) existingNames.add(key);
          failReasons.push(`${row.name}: ${msg}`);
        }
      }
    } finally {
      setImportLoading(false);
    }

    if (newDeals.length) {
      setDeals((prev) =>
        Array.isArray(prev) ? [...prev, ...newDeals] : newDeals,
      );
    }

    if (created > 0) {
      toast.success(
        `Imported ${created} deal${created === 1 ? "" : "s"}${
          skipped ? ` · ${skipped} skipped` : ""
        }`,
      );
      if (failReasons.length) {
        toast(failReasons.slice(0, 2).join(" · "), { duration: 5000 });
      }
    } else if (skipped > 0) {
      toast.error(
        failReasons.length
          ? failReasons.slice(0, 2).join(" · ") +
              (failReasons.length > 2 ? " …" : "")
          : "No rows imported (duplicates or invalid data).",
      );
    } else {
      toast.error("Nothing to import");
    }
  }

  async function handleImportFromBranch() {
    if (!currentBranch?.id) {
      toast.error(
        "Select a destination branch in the header before importing.",
      );
      return;
    }
    if (!branchImportSourceId || branchImportSelectedIds.length === 0) {
      toast.error("Select at least one deal to import.");
      return;
    }

    setBranchImportSubmitting(true);
    const existingNames = new Set(
      dealsList.map((d) =>
        String(d.name || "")
          .trim()
          .toLowerCase(),
      ),
    );
    const destMenuByName = buildDestMenuIndex(menuItems);
    const sourceMenuById = new Map(
      branchImportSourceMenu.map((m) => [String(m.id || m._id), m]),
    );
    for (const deal of branchImportSourceDeals) {
      for (const ci of deal.comboItems || []) {
        const type = getComboItemType(ci);
        if (type === "choice") {
          for (const opt of ci.options || []) {
            const populated = opt?.menuItem;
            if (populated && typeof populated === "object" && populated._id) {
              sourceMenuById.set(String(populated._id), populated);
            }
          }
        } else {
          const populated = ci?.menuItem;
          if (populated && typeof populated === "object" && populated._id) {
            sourceMenuById.set(String(populated._id), populated);
          }
        }
      }
    }
    let created = 0;
    let skipped = 0;
    const failReasons = [];

    try {
      const selectedSet = new Set(branchImportSelectedIds);
      const sourceDeals = branchImportSourceDeals.filter((deal) =>
        selectedSet.has(String(deal._id || deal.id)),
      );
      if (!sourceDeals.length) {
        toast("No deals found in selected branch.");
        return;
      }

      const createdDeals = [];
      for (const deal of sourceDeals) {
        const key = String(deal.name || "")
          .trim()
          .toLowerCase();
        if (!key || existingNames.has(key)) {
          skipped++;
          continue;
        }

        const comboItems = mapDealComboItemsToBranch(deal.comboItems || [], {
          sourceMenuById,
          destMenuByName,
        });

        if (!comboItems.length) {
          skipped++;
          const missing = collectMissingDealImportItems(
            deal.comboItems || [],
            destMenuByName,
            sourceMenuById,
          );
          failReasons.push(
            missing.length
              ? `${deal.name}: copy menu items first (${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""})`
              : `Missing menu items for ${deal.name}`,
          );
          continue;
        }

        const payload = {
          name: deal.name || "",
          description: deal.description || "",
          dealType: "COMBO",
          comboItems,
          comboPrice: Number(deal.comboPrice) || 0,
          startDate: deal.startDate
            ? new Date(deal.startDate).toISOString()
            : new Date().toISOString(),
          endDate: parseEndDateForPayload(deal.endDate),
          isActive: deal.isActive !== false,
          showOnWebsite: deal.isActive !== false,
          showOnPOS: deal.isActive !== false,
          imageUrl: deal.imageUrl || undefined,
          branches: [currentBranch.id],
        };

        try {
          const createdDeal = await createDeal(payload);
          createdDeals.push(createdDeal);
          existingNames.add(key);
          created++;
        } catch (err) {
          skipped++;
          failReasons.push(
            `${deal.name}: ${err?.message || "Failed to create"}`,
          );
        }
      }

      if (createdDeals.length) {
        setDeals((prev) =>
          Array.isArray(prev) ? [...prev, ...createdDeals] : createdDeals,
        );
      }

      if (created > 0) {
        toast.success(
          `Imported ${created} deal${created === 1 ? "" : "s"}${skipped ? ` · ${skipped} skipped` : ""}`,
        );
        if (failReasons.length)
          toast(failReasons.slice(0, 2).join(" · "), { duration: 5000 });
        setBranchImportModalOpen(false);
        setBranchImportSourceId("");
        setBranchImportSourceDeals([]);
        setBranchImportSelectedIds([]);
      } else {
        toast.error(
          failReasons[0] || "No deals imported from selected branch.",
        );
      }
    } catch (err) {
      toast.error(err?.message || "Failed to import from branch");
    } finally {
      setBranchImportSubmitting(false);
    }
  }

  return (
    <AdminLayout title="Deals" suspended={suspended}>
      <PermissionGate permission="deals_modifiers.manage">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={handleImportFile}
        />
        {error && !pageLoading && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50/80 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Toolbar */}
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search deals..."
              className="flex-1 h-10 px-4 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
            />
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
            <button
              type="button"
              onClick={async () => {
                setRefreshing(true);
                await refetch();
                setRefreshing(false);
              }}
              disabled={refreshing || pageLoading}
              title="Refresh"
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border-2 border-gray-200 bg-white text-gray-600 transition-all hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800 flex-shrink-0"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
            </button>
            <div className="relative" ref={exportMenuRef}>
              <button
                type="button"
                onClick={() => setExportMenuOpen((o) => !o)}
                disabled={filtered.length === 0}
                title="Export deals"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 px-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <FileDown className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Export</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${exportMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
              {exportMenuOpen && (
                <div
                  className="absolute right-0 top-full z-[100] mt-1.5 w-56 overflow-hidden rounded-xl border-2 border-gray-200 bg-white py-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={exportCSV}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    <FileDown className="h-4 w-4 shrink-0 text-gray-400" />
                    Download CSV
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={exportPDF}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-gray-400" />
                    Export PDF...
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={printDeals}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    <Printer className="h-4 w-4 shrink-0 text-gray-400" />
                    Print
                  </button>
                </div>
              )}
            </div>
            <div className="relative" ref={importMenuRef}>
              <button
                type="button"
                onClick={() => setImportMenuOpen((o) => !o)}
                disabled={importLoading || !currentBranch?.id}
                title={
                  !currentBranch?.id
                    ? "Select a branch in the header first"
                    : "Import deals"
                }
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border-2 border-gray-200 px-3 text-sm font-semibold text-gray-700 transition-all hover:bg-gray-50 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                {importLoading ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 shrink-0" />
                )}
                <span className="hidden sm:inline">Import</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${importMenuOpen ? "rotate-180" : ""}`}
                />
              </button>
              {importMenuOpen && (
                <div
                  className="absolute right-0 top-full z-[100] mt-1.5 w-56 overflow-hidden rounded-xl border-2 border-gray-200 bg-white py-1 shadow-xl dark:border-neutral-700 dark:bg-neutral-900"
                  role="menu"
                >
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!canImportFromBranch}
                    title={
                      !canImportFromBranch
                        ? "No other branches available"
                        : undefined
                    }
                    onClick={() => {
                      setImportMenuOpen(false);
                      setBranchImportSourceId("");
                      setBranchImportModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-gray-400" />
                    Import from a branch
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!currentBranch?.id || importLoading}
                    onClick={() => {
                      setImportMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-neutral-200 dark:hover:bg-neutral-800"
                  >
                    <Upload className="h-4 w-4 shrink-0 text-gray-400" />
                    Upload from device
                  </button>
                </div>
              )}
            </div>
            {hasPermission("menu.manage") && (
              <button
                type="button"
                onClick={() => setCategoriesPanelOpen((open) => !open)}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border-2 px-3 text-sm font-semibold transition-all ${
                  categoriesPanelOpen
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
                }`}
              >
                {categoriesPanelOpen ? (
                  <PanelLeftClose className="h-4 w-4 shrink-0" />
                ) : (
                  <PanelLeftOpen className="h-4 w-4 shrink-0" />
                )}
                <span className="hidden sm:inline">Categories</span>
              </button>
            )}
            {hasPermission("menu.manage_deals") && (
              <button
                type="button"
                onClick={startCreate}
                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all whitespace-nowrap flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                New Deal
              </button>
            )}
          </div>

          {/* Filter + Sort pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide mr-1">
              Status:
            </span>
            {[
              ["all", "All"],
              ["active", "Active"],
              ["inactive", "Inactive"],
            ].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setFilterStatus(val)}
                className={`h-7 px-3 rounded-lg text-xs font-semibold transition-all ${
                  filterStatus === val
                    ? "bg-primary text-white shadow-sm"
                    : "bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-primary/40 hover:text-primary"
                }`}
              >
                {label}
                {val !== "all" && (
                  <span className="ml-1.5 opacity-70">
                    {
                      dealsList.filter((d) =>
                        val === "active" ? getDealStatus(d) : !getDealStatus(d),
                      ).length
                    }
                  </span>
                )}
              </button>
            ))}
            <div className="w-px h-4 bg-gray-200 dark:bg-neutral-700 mx-1" />
            <span className="text-xs font-semibold text-gray-400 dark:text-neutral-500 uppercase tracking-wide mr-1">
              Sort:
            </span>
            <div className="relative">
              <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="h-7 pl-7 pr-3 rounded-lg text-xs font-semibold bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 outline-none focus:border-primary transition-all appearance-none cursor-pointer"
              >
                <option value="newest">Newest</option>
                <option value="oldest">Oldest</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
              </select>
            </div>
            {(filterStatus !== "all" || sortBy !== "newest" || search) && (
              <button
                type="button"
                onClick={() => {
                  setFilterStatus("all");
                  setSortBy("newest");
                  setSearch("");
                }}
                className="h-7 px-3 rounded-lg text-xs font-semibold text-gray-500 dark:text-neutral-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors border border-gray-200 dark:border-neutral-700 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
            <span className="ml-auto text-xs text-gray-400 dark:text-neutral-500">
              {filtered.length} deal{filtered.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {pageLoading ? (
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
                <Percent className="w-10 h-10 text-primary animate-pulse" />
              </div>
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
                <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
                  Loading deals...
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-4">
            {categoriesPanelOpen && hasPermission("menu.manage") && (
              <aside className="w-72 shrink-0 rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                <div className="mb-3 flex items-center gap-2">
                  <FolderOpen className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                    Deal categories
                  </h3>
                </div>
                <p className="mb-3 text-[11px] leading-relaxed text-gray-500 dark:text-neutral-400">
                  Group deals for your storefront. Reorder controls display
                  sequence.
                </p>
                <form
                  onSubmit={handleCreateDealCategory}
                  className="mb-4 flex gap-2"
                >
                  <input
                    type="text"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="New category…"
                    className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs text-gray-900 outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                  />
                  <button
                    type="submit"
                    disabled={categorySavingId === "new"}
                    className="inline-flex items-center justify-center rounded-lg bg-primary px-2.5 py-2 text-white disabled:opacity-50"
                  >
                    {categorySavingId === "new" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                  </button>
                </form>
                <div className="max-h-[28rem] space-y-2 overflow-y-auto">
                  {sortedDealCategories.length === 0 ? (
                    <p className="text-xs italic text-gray-400 dark:text-neutral-500">
                      No categories yet
                    </p>
                  ) : (
                    sortedDealCategories.map((cat, index) => {
                      const isEditing = editingCategoryId === cat.id;
                      const isSaving = categorySavingId === cat.id;
                      const dealCount = dealCountByCategoryId.get(cat.id) || 0;
                      return (
                        <div
                          key={cat.id}
                          className="rounded-xl border border-gray-100 bg-gray-50/80 p-2.5 dark:border-neutral-800 dark:bg-neutral-900/60"
                        >
                          {isEditing ? (
                            <div className="flex gap-1.5">
                              <input
                                type="text"
                                value={editingCategoryName}
                                onChange={(e) =>
                                  setEditingCategoryName(e.target.value)
                                }
                                className="min-w-0 flex-1 rounded-md border border-gray-200 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveCategoryRename(cat.id)}
                                disabled={isSaving}
                                className="rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-white"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingCategoryId(null);
                                  setEditingCategoryName("");
                                }}
                                className="rounded-md px-2 py-1 text-[10px] text-gray-500"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-start gap-1.5">
                                <p className="min-w-0 flex-1 text-xs font-semibold text-gray-900 dark:text-white">
                                  {cat.name}
                                </p>
                                <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-neutral-800 dark:text-neutral-400">
                                  {dealCount}
                                </span>
                              </div>
                              <div className="mt-2 flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => moveDealCategory(cat.id, -1)}
                                  disabled={index === 0 || isSaving}
                                  className="rounded p-1 text-gray-400 hover:bg-white hover:text-primary disabled:opacity-30 dark:hover:bg-neutral-800"
                                  title="Move up"
                                >
                                  <ChevronUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveDealCategory(cat.id, 1)}
                                  disabled={
                                    index === sortedDealCategories.length - 1 ||
                                    isSaving
                                  }
                                  className="rounded p-1 text-gray-400 hover:bg-white hover:text-primary disabled:opacity-30 dark:hover:bg-neutral-800"
                                  title="Move down"
                                >
                                  <ChevronDown className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCategoryId(cat.id);
                                    setEditingCategoryName(cat.name);
                                  }}
                                  className="rounded p-1 text-gray-400 hover:bg-white hover:text-primary dark:hover:bg-neutral-800"
                                  title="Rename"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleDeleteDealCategory(cat.id)
                                  }
                                  disabled={isSaving}
                                  className="ml-auto rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </aside>
            )}

            <div className="min-w-0 flex-1 space-y-8">
              {/* Grid View */}
              {viewMode === "grid" &&
                (dealsGroupedByCategory.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-6 py-16 text-center dark:border-neutral-800 dark:bg-neutral-950">
                    <p className="text-sm text-gray-500 dark:text-neutral-400">
                      {dealsList.length === 0
                        ? "No deals yet. Click 'New Deal' to create one."
                        : "No deals match your search"}
                    </p>
                  </div>
                ) : (
                  dealsGroupedByCategory.map((group) => (
                    <section key={group.categoryId || "uncategorized"}>
                      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                        {group.categoryName}
                      </h3>
                      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {group.deals.map((deal) => {
                          const id = deal._id || deal.id;
                          const isActive = getDealStatus(deal);
                          const statusLabel = getDealStatusLabel(deal);
                          const isDeleting = deletingId === id;
                          const comboItems = deal.comboItems || [];
                          const endDate = deal.endDate
                            ? new Date(deal.endDate)
                            : null;
                          const daysLeft = endDate
                            ? Math.ceil((endDate - new Date()) / 86400000)
                            : null;

                          return (
                            <div
                              key={id}
                              className={`group bg-white dark:bg-neutral-950 rounded-2xl border overflow-hidden hover:shadow-xl hover:-translate-y-0.5 transition-all ${
                                isActive
                                  ? "border-gray-200 dark:border-neutral-800 hover:border-primary/20"
                                  : "border-gray-200 dark:border-neutral-800 opacity-55"
                              }`}
                            >
                              {/* Banner / Image */}
                              <div className="relative h-32 bg-gradient-to-br from-primary/15 via-secondary/10 to-primary/5 dark:from-primary/20 dark:via-secondary/15 dark:to-primary/10 overflow-hidden">
                                {deal.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={deal.imageUrl}
                                    alt={deal.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <Percent className="w-12 h-12 text-primary/30" />
                                  </div>
                                )}
                                {/* Status badge */}
                                <div className="absolute top-2.5 left-2.5">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold backdrop-blur-sm ${
                                      statusLabel === "Active"
                                        ? "bg-emerald-500/90 text-white"
                                        : statusLabel === "Scheduled"
                                          ? "bg-amber-500/90 text-white"
                                          : "bg-gray-500/80 text-white"
                                    }`}
                                  >
                                    <span
                                      className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white" : "bg-white/70"}`}
                                    />
                                    {statusLabel}
                                  </span>
                                </div>
                                {/* Action buttons */}
                                {hasPermission("menu.manage_deals") && (
                                  <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      type="button"
                                      onClick={() => startEdit(deal)}
                                      disabled={isDeleting}
                                      className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center text-gray-600 hover:text-primary hover:bg-white shadow-sm transition-colors"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(id)}
                                      disabled={isDeleting}
                                      className="w-7 h-7 rounded-lg bg-white/90 backdrop-blur-sm flex items-center justify-center text-gray-600 hover:text-red-500 hover:bg-white shadow-sm transition-colors"
                                    >
                                      {isDeleting ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="w-3.5 h-3.5" />
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Body */}
                              <div className="p-4">
                                <p className="font-bold text-gray-900 dark:text-white text-sm truncate mb-0.5">
                                  {deal.name}
                                </p>
                                {deal.description && (
                                  <p className="text-xs text-gray-500 dark:text-neutral-400 line-clamp-1 mb-2">
                                    {deal.description}
                                  </p>
                                )}

                                {/* Items chips */}
                                {comboItems.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mb-3">
                                    {comboItems.slice(0, 2).map((ci, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800 text-[10px] font-medium text-gray-600 dark:text-neutral-400"
                                      >
                                        <Tag className="w-2.5 h-2.5" />
                                        {getComboItemType(ci) === "choice"
                                          ? ci.label || "Choice"
                                          : `${ci.menuItem?.name || "Item"}${ci.quantity > 1 ? ` ×${ci.quantity}` : ""}`}
                                      </span>
                                    ))}
                                    {comboItems.length > 2 && (
                                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-gray-100 dark:bg-neutral-800 text-[10px] font-medium text-gray-500 dark:text-neutral-500">
                                        +{comboItems.length - 2}
                                      </span>
                                    )}
                                  </div>
                                )}

                                {/* Footer row */}
                                <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-neutral-800">
                                  <span className="text-sm font-extrabold text-primary">
                                    {sym} {deal.comboPrice?.toLocaleString()}
                                  </span>
                                  {daysLeft !== null && isActive && (
                                    <span
                                      className={`flex items-center gap-1 text-[10px] font-semibold ${daysLeft <= 3 ? "text-red-500" : "text-gray-400 dark:text-neutral-500"}`}
                                    >
                                      <Calendar className="w-3 h-3" />
                                      {daysLeft <= 0
                                        ? "Expired"
                                        : `${daysLeft}d left`}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ))
                ))}

              {/* Table View */}
              {viewMode === "table" &&
                (dealsGroupedByCategory.length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-6 py-16 text-center dark:border-neutral-800 dark:bg-neutral-950">
                    <p className="text-sm text-gray-500 dark:text-neutral-400">
                      {dealsList.length === 0
                        ? "No deals yet. Click 'New Deal' to create one."
                        : "No deals match your search"}
                    </p>
                  </div>
                ) : (
                  dealsGroupedByCategory.map((group) => (
                    <section
                      key={`table-${group.categoryId || "uncategorized"}`}
                      className="space-y-3"
                    >
                      <h3 className="text-sm font-bold uppercase tracking-wider text-gray-500 dark:text-neutral-400">
                        {group.categoryName}
                      </h3>
                      <DataTable
                        variant="card"
                        columns={[
                          {
                            key: "name",
                            header: "Name",
                            render: (value, row) => (
                              <div className="max-w-xs">
                                <p className="font-semibold text-gray-900 dark:text-white truncate">
                                  {value}
                                </p>
                                {row.description && (
                                  <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5 truncate">
                                    {row.description}
                                  </p>
                                )}
                              </div>
                            ),
                          },
                          {
                            key: "comboItems",
                            header: "Items",
                            hideOnMobile: true,
                            render: (value) => {
                              const items = (value || []).map((ci) =>
                                formatComboItemSummary(ci, menuItemById, sym),
                              );
                              const preview = items.slice(0, 2).join(", ");
                              const extra =
                                items.length > 2
                                  ? ` +${items.length - 2} more`
                                  : "";
                              return (
                                <span className="text-sm text-gray-600 dark:text-neutral-400 max-w-xs block truncate">
                                  {items.length ? preview + extra : "—"}
                                </span>
                              );
                            },
                          },
                          {
                            key: "comboPrice",
                            header: "Price",
                            render: (value) => (
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-primary/10 text-primary text-xs font-bold">
                                {sym} {value}
                              </span>
                            ),
                          },
                          {
                            key: "isActive",
                            header: "Status",
                            hideOnTablet: true,
                            render: (_, row) => {
                              const statusLabel = getDealStatusLabel(row);
                              const isActive = getDealStatus(row);
                              return (
                                <span
                                  className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    statusLabel === "Active"
                                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
                                      : statusLabel === "Scheduled"
                                        ? "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                                        : "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400"
                                  }`}
                                >
                                  {statusLabel}
                                </span>
                              );
                            },
                          },
                          {
                            key: "actions",
                            header: "Actions",
                            align: "right",
                            render: (_, row) => {
                              const id = row._id || row.id;
                              const isDeleting = deletingId === id;
                              return hasPermission("menu.manage_deals") ? (
                                <div className="inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => startEdit(row)}
                                    disabled={isDeleting}
                                    className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:text-primary dark:hover:text-secondary transition-colors disabled:opacity-50"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDelete(id)}
                                    disabled={isDeleting}
                                    className="p-1.5 rounded-lg text-gray-400 dark:text-neutral-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors disabled:opacity-50"
                                    title="Delete"
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                </div>
                              ) : null;
                            },
                          },
                        ]}
                        rows={group.deals}
                        emptyMessage="No deals in this category"
                      />
                    </section>
                  ))
                ))}
            </div>
          </div>
        )}

        {/* Deal Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-sm sm:p-4">
            <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
              {/* Header */}
              <div className="flex shrink-0 items-center justify-between gap-3 border-b border-gray-100 bg-white px-5 py-3.5 dark:border-neutral-800 dark:bg-neutral-950">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                    {form.id ? "Edit deal" : "Create New Deal."}
                  </h2>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[11px] font-semibold ${
                        form.isActive
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-gray-400 dark:text-neutral-500"
                      }`}
                    >
                      {form.isActive ? "Active" : "Inactive"}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({ ...f, isActive: !f.isActive }))
                      }
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors ${
                        form.isActive
                          ? "bg-emerald-500"
                          : "bg-gray-300 dark:bg-neutral-600"
                      }`}
                      aria-label={
                        form.isActive ? "Set deal inactive" : "Set deal active"
                      }
                    >
                      <span
                        className={`inline-block h-4 w-4 translate-y-0.5 transform rounded-full bg-white shadow-sm transition ${
                          form.isActive ? "translate-x-4" : "translate-x-0.5"
                        }`}
                      />
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsModalOpen(false)}
                    disabled={isLoading}
                    className="h-9 rounded-xl px-3 text-xs sm:px-4"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    form="deal-form"
                    disabled={isLoading}
                    className="h-9 gap-1.5 rounded-xl bg-gradient-to-r from-primary to-secondary px-3 text-xs font-semibold shadow-md shadow-primary/20 sm:px-5"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        {form.id ? "Saving…" : "Creating…"}
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        {form.id ? "Save changes" : "Create deal"}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {modalError && (
                <div className="mx-5 mt-3 flex items-start gap-2 rounded-lg border border-red-200/80 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              {staleDealIssues.length > 0 && (
                <div className="mx-5 mt-3 rounded-lg border border-red-200/80 bg-red-50 px-3 py-2.5 text-xs text-red-800 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100">
                  <p className="flex items-center gap-1.5 font-semibold">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    Outdated variation references
                  </p>
                  <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                    Remove affected options and re-add them from the menu
                    search.
                  </p>
                  <ul className="mt-2 space-y-1 text-[11px]">
                    {staleDealIssues.slice(0, 6).map((issue, idx) => (
                      <li
                        key={`${issue.componentIndex}-${issue.optionIndex ?? "f"}-${issue.kind}-${idx}`}
                      >
                        • {issue.label}
                        {issue.kind === "stale_option"
                          ? ` — "${issue.optionName}" (${issue.groupName}) not on menu anymore`
                          : issue.kind === "stale_group"
                            ? ` — variation group "${issue.groupName}" changed`
                            : " — menu item missing"}
                      </li>
                    ))}
                    {staleDealIssues.length > 6 ? (
                      <li>• …and {staleDealIssues.length - 6} more</li>
                    ) : null}
                  </ul>
                </div>
              )}

              <form
                id="deal-form"
                onSubmit={handleSubmit}
                className="flex min-h-0 flex-1 flex-col"
                autoComplete="off"
              >
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
                  {/* Left — main */}
                  <div className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-5">
                    <div className="space-y-5">
                      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div className="min-w-0">
                            <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                              Deal name <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="text"
                              value={form.name}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, name: e.target.value }))
                              }
                              placeholder="e.g. Birthday Deal 2"
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                            />
                          </div>
                          <div className="min-w-0">
                            <label className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                              Deal category
                            </label>
                            <select
                              value={form.categoryId}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  categoryId: e.target.value,
                                }))
                              }
                              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                            >
                              <option value="">Uncategorized</option>
                              {sortedDealCategories
                                .filter((c) => c.isActive !== false)
                                .map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.name}
                                  </option>
                                ))}
                            </select>
                            {!form.categoryId ? (
                              <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                                Needed to show this deal on the website.
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div>
                          <label className="mb-1.5 mt-2 block text-xs font-medium text-gray-600 dark:text-neutral-400">
                            Description
                          </label>
                          <textarea
                            rows={3}
                            value={form.description}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                description: e.target.value,
                              }))
                            }
                            placeholder="Short blurb for the website deal card…"
                            className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-gray-900 outline-none placeholder:text-gray-400 focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                          />
                        </div>
                      </section>

                      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900/40">
                        {!addItemsOpen && form.components.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => setAddItemsOpen(true)}
                            className="w-full rounded-xl border border-dashed border-gray-300 bg-gray-50/80 px-3 py-10 text-center transition hover:border-primary/40 hover:bg-primary/[0.04] dark:border-neutral-700 dark:bg-neutral-950/50"
                          >
                            <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                              <Plus className="h-5 w-5" />
                            </div>
                            <p className="text-sm font-semibold text-gray-800 dark:text-neutral-200">
                              Add items to this deal
                            </p>
                            <p className="mt-1 text-[11px] text-gray-400">
                              Pizza options, drinks, cake — whatever belongs
                              here
                            </p>
                          </button>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <div className="mb-2">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                  Add Items{" "}
                                  <span className="text-red-500">*</span>
                                </h4>
                              </div>
                              <div
                                className={`rounded-xl border p-3 ${
                                  choiceMode
                                    ? "border-secondary/30 bg-secondary/5 dark:border-secondary/40 dark:bg-secondary/10"
                                    : "border-gray-200 bg-gray-50/50 dark:border-neutral-800 dark:bg-neutral-950/40"
                                }`}
                              >
                                <DealInlineMenuSearch
                                  menuItems={menuItems}
                                  menuCategories={menuCategories}
                                  currencySymbol={sym}
                                  placeholder="Search menu to add…"
                                  choiceMode={choiceMode}
                                  onChoiceModeChange={handleChoiceModeChange}
                                  choiceHeading={choiceDraftLabel}
                                  onChoiceHeadingChange={setChoiceDraftLabel}
                                  draftOptions={choiceDraftOptions}
                                  onRemoveDraftOption={removeDraftChoiceOption}
                                  formatDraftOptionLabel={(opt) =>
                                    formatChoiceOptionLabel(opt, menuItemById)
                                  }
                                  getDraftOptionPrice={(opt) =>
                                    choiceOptionUnitPrice(opt, menuItemById)
                                  }
                                  menuItemById={menuItemById}
                                  onDoneChoice={finishChoiceDraft}
                                  onPick={(menuItemId, mods, asChoice) =>
                                    addDealItem(menuItemId, mods, asChoice)
                                  }
                                />
                              </div>
                            </div>

                            {form.components.length > 0 ? (
                              <div className="space-y-2 border-t border-dashed border-gray-200 pt-3 dark:border-neutral-700">
                                <div className="flex items-center justify-between gap-2">
                                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                                    Deal Items{" "}
                                    <span className="text-red-500">*</span>
                                  </h3>
                                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-neutral-800 dark:text-neutral-300">
                                    {form.components.length} item
                                    {form.components.length === 1 ? "" : "s"}{" "}
                                    added
                                  </span>
                                </div>
                                {form.components.map((comp, index) => {
                                  if (comp.type === "choice") {
                                    // Hide slot while it's being edited in the draft panel
                                    if (
                                      choiceMode &&
                                      editingChoiceIndex === index
                                    ) {
                                      return null;
                                    }
                                    const options = comp.options || [];
                                    return (
                                      <div
                                        key={`choice-${index}`}
                                        className="rounded-xl border border-gray-200 bg-gray-50/70 px-3 py-2.5 dark:border-neutral-700 dark:bg-neutral-950/50"
                                      >
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                          <div className="flex min-w-0 flex-1 items-center gap-2">
                                            <span className="inline-flex shrink-0 items-center rounded-md bg-secondary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-secondary">
                                              Choice
                                            </span>
                                            <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                              {comp.label || "Choose one"}
                                            </p>
                                          </div>
                                          <div className="flex shrink-0 items-center gap-0.5">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                startEditChoiceSlot(index)
                                              }
                                              className="flex h-7 w-7 items-center justify-center rounded-lg text-secondary hover:bg-secondary/10"
                                              aria-label="Edit choice slot"
                                              title="Edit"
                                            >
                                              <Edit2 className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                duplicateChoiceSlot(index)
                                              }
                                              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                                              aria-label="Duplicate choice slot"
                                              title="Duplicate"
                                            >
                                              <Copy className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                removeComponent(index)
                                              }
                                              className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                                              aria-label="Remove choice slot"
                                              title="Remove"
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                        </div>

                                        {options.length === 0 ? (
                                          <p className="rounded-lg border border-dashed border-gray-200 px-2.5 py-2 text-[11px] text-gray-400 dark:border-neutral-700">
                                            No options yet
                                          </p>
                                        ) : (
                                          <div className="space-y-1">
                                            {options.map((opt) => {
                                              const key = choiceOptionKey(opt);
                                              const label =
                                                formatChoiceOptionLabel(
                                                  opt,
                                                  menuItemById,
                                                );
                                              const unitPrice =
                                                choiceOptionUnitPrice(
                                                  opt,
                                                  menuItemById,
                                                );
                                              const stale =
                                                choiceOptionHasStaleReferences(
                                                  opt,
                                                  menuItemById,
                                                );
                                              return (
                                                <div
                                                  key={key}
                                                  className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 ${
                                                    stale
                                                      ? "border-red-300 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20"
                                                      : "border-gray-100 bg-white dark:border-neutral-800 dark:bg-neutral-900"
                                                  }`}
                                                >
                                                  <div className="min-w-0">
                                                    <span className="text-xs font-medium text-gray-800 dark:text-neutral-200">
                                                      {label}
                                                    </span>
                                                    {unitPrice > 0 ? (
                                                      <span className="ml-2 text-[11px] font-medium tabular-nums text-gray-500 dark:text-neutral-400">
                                                        {formatDealItemPrice(
                                                          sym,
                                                          unitPrice,
                                                        )}
                                                      </span>
                                                    ) : null}
                                                  </div>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  }

                                  const qty = Math.max(
                                    1,
                                    Number(comp.quantity) || 1,
                                  );
                                  const unitPrice = priceFromModifierSelections(
                                    menuItemById.get(String(comp.menuItemId)),
                                    comp.modifierSelections,
                                  );
                                  const lineTotal = unitPrice * qty;
                                  const itemName = (() => {
                                    const item = menuItemById.get(
                                      String(comp.menuItemId),
                                    );
                                    const base = item?.name || "Item";
                                    const variation = formatVariationLabel(
                                      comp.modifierSelections,
                                    );
                                    return variation
                                      ? `${base} (${variation})`
                                      : base;
                                  })();
                                  const stale =
                                    fixedComponentHasStaleReferences(
                                      comp,
                                      menuItemById,
                                    );
                                  return (
                                    <div
                                      key={`fixed-${index}-${comp.menuItemId}-${modifierSelectionsFingerprint(comp.modifierSelections)}`}
                                      className={`flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-xl border px-3 py-2.5 ${
                                        stale
                                          ? "border-red-300 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20"
                                          : "border-gray-100 bg-gray-50/70 dark:border-neutral-800 dark:bg-neutral-950/50"
                                      }`}
                                    >
                                      <span className="inline-flex shrink-0 items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                                        Fixed
                                      </span>
                                      <div className="min-w-0 flex-1 truncate">
                                        <span className="text-xs font-semibold text-gray-800 dark:text-neutral-200">
                                          {itemName}
                                        </span>
                                        <span className="ml-2 text-[11px] font-medium tabular-nums text-gray-500 dark:text-neutral-400">
                                          {formatDealItemPrice(sym, unitPrice)}
                                        </span>
                                      </div>
                                      <div className="flex shrink-0 items-center gap-1">
                                        {qty <= 1 ? (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              removeComponent(index)
                                            }
                                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-red-500 hover:bg-red-50 dark:border-neutral-700 dark:bg-neutral-900 dark:hover:bg-red-950/30"
                                            aria-label="Remove"
                                          >
                                            <Trash2 className="h-3.5 w-3.5" />
                                          </button>
                                        ) : (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              decrementFixedComponentAt(index)
                                            }
                                            className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 dark:border-neutral-700 dark:bg-neutral-900"
                                            aria-label="Decrease"
                                          >
                                            −
                                          </button>
                                        )}
                                        <input
                                          type="number"
                                          min={1}
                                          value={qty}
                                          onChange={(e) =>
                                            setFixedComponentQuantityAt(
                                              index,
                                              e.target.value,
                                            )
                                          }
                                          className="w-11 rounded-lg border border-gray-200 bg-white px-1 py-1 text-center text-xs dark:border-neutral-700 dark:bg-neutral-900"
                                        />
                                        <button
                                          type="button"
                                          onClick={() =>
                                            incrementFixedComponentAt(index)
                                          }
                                          className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 dark:border-neutral-700 dark:bg-neutral-900"
                                          aria-label="Increase"
                                        >
                                          +
                                        </button>
                                      </div>
                                      <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-800 dark:text-neutral-200">
                                        {formatDealItemPrice(sym, lineTotal)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </section>
                    </div>
                  </div>

                  {/* Right — price, photo, dates, description */}
                  <aside className="flex min-h-0 w-full shrink-0 flex-col overflow-y-auto border-t border-gray-100 bg-gray-50 dark:border-neutral-800 dark:bg-neutral-900/50 lg:w-80 lg:border-l lg:border-t-0 xl:w-[22rem]">
                    <div className="space-y-3 p-4">
                      <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                        <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                          Price <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-gray-400">
                            {sym}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={form.comboPrice}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                comboPrice: e.target.value,
                              }))
                            }
                            placeholder="0"
                            className="w-full rounded-xl border border-gray-200 bg-white py-3 pl-10 pr-3 text-xl font-bold tabular-nums text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                          />
                        </div>
                        {!showReservationField ? (
                          <button
                            type="button"
                            onClick={() => setShowReservationField(true)}
                            className="mt-2.5 text-[11px] font-semibold text-primary hover:underline"
                          >
                            + Reservation / party fee
                          </button>
                        ) : (
                          <div className="mt-3 rounded-lg border border-gray-100 bg-gray-50 p-2.5 dark:border-neutral-800 dark:bg-neutral-900">
                            <div className="mb-1 flex items-center justify-between">
                              <label className="text-[11px] font-medium text-gray-600 dark:text-neutral-400">
                                Reservation ({sym})
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  setShowReservationField(false);
                                  setForm((f) => ({
                                    ...f,
                                    reservationCharges: "",
                                  }));
                                }}
                                className="text-[10px] font-medium text-gray-400 hover:text-gray-600"
                              >
                                Remove
                              </button>
                            </div>
                            <input
                              type="number"
                              min={0}
                              value={form.reservationCharges}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  reservationCharges: e.target.value,
                                }))
                              }
                              placeholder="2000"
                              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950 dark:text-white"
                            />
                            {comboPriceNum > 0 && reservationChargesNum > 0 ? (
                              <p className="mt-1.5 text-[10px] text-gray-500 dark:text-neutral-400">
                                {sym}
                                {Math.round(
                                  foodDealPriceNum,
                                ).toLocaleString()}{" "}
                                food · {sym}
                                {Math.round(
                                  reservationChargesNum,
                                ).toLocaleString()}{" "}
                                fee
                              </p>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                          Thumbnail
                        </label>
                        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-neutral-700 dark:bg-neutral-900">
                          {form.imageUrl ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={form.imageUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setForm((f) => ({ ...f, imageUrl: "" }))
                                }
                                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition hover:bg-black/70"
                                aria-label="Remove image"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </>
                          ) : (
                            <div className="flex h-full flex-col items-center justify-center gap-1.5 text-center">
                              <Upload className="h-6 w-6 text-gray-300 dark:text-neutral-600" />
                              <p className="text-[11px] text-gray-400">
                                Add a deal photo
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="mt-2.5 flex rounded-lg border border-gray-200 bg-gray-50 p-0.5 dark:border-neutral-700 dark:bg-neutral-900">
                          {[
                            { id: "link", label: "URL", icon: Link },
                            { id: "upload", label: "Upload", icon: Upload },
                          ].map(({ id, label, icon: Icon }) => (
                            <button
                              key={id}
                              type="button"
                              onClick={() => setImageTab(id)}
                              className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-[10px] font-semibold transition ${
                                imageTab === id
                                  ? "bg-white text-gray-900 shadow-sm dark:bg-neutral-800 dark:text-white"
                                  : "text-gray-500 hover:text-gray-700 dark:text-neutral-400"
                              }`}
                            >
                              <Icon className="h-3 w-3" />
                              {label}
                            </button>
                          ))}
                        </div>
                        {imageTab === "link" ? (
                          <input
                            type="url"
                            value={form.imageUrl}
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                imageUrl: e.target.value,
                              }))
                            }
                            placeholder="https://…"
                            className="mt-2 w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                          />
                        ) : (
                          <div className="mt-2">
                            <input
                              ref={imageFileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleFileUpload}
                              className="hidden"
                            />
                            <button
                              type="button"
                              disabled={uploading}
                              onClick={() => imageFileInputRef.current?.click()}
                              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-2.5 py-2 text-[11px] font-semibold text-gray-700 transition hover:border-primary/40 hover:text-primary dark:border-neutral-600 dark:text-neutral-300"
                            >
                              {uploading ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Upload className="h-3.5 w-3.5" />
                              )}
                              {uploading ? "Uploading…" : "Choose file"}
                            </button>
                            {uploadError ? (
                              <p className="mt-1 text-[11px] text-red-500">
                                {uploadError}
                              </p>
                            ) : null}
                          </div>
                        )}
                      </div>

                      <div className="rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
                          Valid dates
                        </label>
                        <div className="grid grid-cols-1 gap-2">
                          <div>
                            <span className="mb-1 block text-[10px] font-medium text-gray-400">
                              Start
                            </span>
                            <input
                              type="date"
                              value={form.startDate}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  startDate: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                            />
                          </div>
                          <div>
                            <span className="mb-1 block text-[10px] font-medium text-gray-400">
                              End{" "}
                              <span className="font-normal">(optional)</span>
                            </span>
                            <input
                              type="date"
                              value={form.endDate}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  endDate: e.target.value,
                                }))
                              }
                              className="w-full rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-xs dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </form>
            </div>
          </div>
        )}
        {branchImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-950">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Import deals from branch
                </h3>
                <button
                  type="button"
                  onClick={() => {
                    if (branchImportSubmitting) return;
                    setBranchImportModalOpen(false);
                  }}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 text-gray-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">
                    Source branch
                  </label>
                  <select
                    value={branchImportSourceId}
                    onChange={(e) => setBranchImportSourceId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="">Select branch</option>
                    {sourceBranches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
                {branchImportSourceId && currentBranch?.name && (
                  <p className="text-xs text-gray-600 dark:text-neutral-400">
                    Copying from{" "}
                    <strong>
                      {sourceBranches.find((b) => b.id === branchImportSourceId)
                        ?.name ?? "source"}
                    </strong>{" "}
                    to <strong>{currentBranch.name}</strong> (this branch).
                    Select deals to import.
                  </p>
                )}
                {branchImportSourceId &&
                  !branchImportSourceMenuLoading &&
                  branchImportSourceMenu.length === 0 && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2">
                      The source branch menu could not be loaded, or it has no
                      items. Import matching menu items into this branch first
                      (Menu Items → Import from branch), then import deals.
                    </p>
                  )}
                {branchImportSourceId && menuItems.length === 0 && (
                  <p className="text-xs text-amber-700 dark:text-amber-400 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2">
                    This branch has no menu items yet. Copy menu items from the
                    source branch before importing deals.
                  </p>
                )}
                {branchImportSourceLoading && (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                )}
                {!branchImportSourceLoading && branchImportSourceId && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-600 dark:text-neutral-400">
                        Deals from source branch
                      </p>
                      {branchImportSourceDeals.length > 0 && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setBranchImportSelectedIds(
                                branchImportSourceDeals.map((d) =>
                                  String(d._id || d.id),
                                ),
                              )
                            }
                            className="text-xs text-primary hover:underline"
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={() => setBranchImportSelectedIds([])}
                            className="text-xs text-gray-500 hover:underline"
                          >
                            Deselect all
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-neutral-700 divide-y divide-gray-100 dark:divide-neutral-800">
                      {branchImportSourceDeals.map((deal) => {
                        const id = String(deal._id || deal.id);
                        const checked = branchImportSelectedIds.includes(id);
                        return (
                          <label
                            key={id}
                            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 dark:hover:bg-neutral-800/50 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setBranchImportSelectedIds((prev) =>
                                  prev.includes(id)
                                    ? prev.filter((x) => x !== id)
                                    : [...prev, id],
                                )
                              }
                              className="rounded border-gray-300 text-primary"
                            />
                            <span className="text-sm text-gray-900 dark:text-white flex-1">
                              {deal.name}
                            </span>
                            <span className="text-xs text-gray-500">
                              {sym} {Number(deal.comboPrice || 0).toFixed(0)}
                            </span>
                          </label>
                        );
                      })}
                      {branchImportSourceDeals.length === 0 && (
                        <p className="px-3 py-2 text-xs text-gray-500">
                          No deals in selected branch
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (branchImportSubmitting) return;
                    setBranchImportModalOpen(false);
                  }}
                  className="rounded-xl border-2 border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleImportFromBranch}
                  disabled={
                    !branchImportSourceId ||
                    branchImportSelectedIds.length === 0 ||
                    branchImportSubmitting
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {branchImportSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Building2 className="h-4 w-4" />
                  )}
                  {branchImportSubmitting ? "Importing..." : "Import selected"}
                </button>
              </div>
            </div>
          </div>
        )}
      </PermissionGate>
    </AdminLayout>
  );
}
