import { useEffect, useState, useRef, useMemo } from "react";
import { buildBillHtml } from "../../lib/printBillReceipt";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getBranches,
  getDeletedBranches,
  createBranch,
  deleteBranch,
  restoreBranch,
  updateBranch,
  getRestaurantSettings,
  updateRestaurantSettings,
  getWebsiteSettings,
  updateWebsiteSettings,
  uploadImage,
  getPaymentAccounts,
  createPaymentAccount,
  updatePaymentAccount,
  deletePaymentAccount,
  updateBranchDeliveryZones,
  setStoredCurrencyCode,
} from "../../lib/apiClient";
import { useBranch } from "../../contexts/BranchContext";
import {
  MapPin,
  Loader2,
  Check,
  Trash2,
  X,
  Pencil,
  Plus,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  Building2,
  FileText,
  Clock,
  RotateCcw,
  Settings,
  Eye,
  EyeOff,
  Phone,
  Mail,
  Palette,
  Wallet,
  Truck,
  Search,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";

const DEMO_ORDER = {
  branchName: "Demo Branch",
  orderNumber: "20260309-1-0001",
  createdAt: "2026-03-09T10:30:00.000Z",
  type: "Dine-in",
  paymentMethod: "To be paid",
  customerName: "Guest",
  deliveryAddress: "Guest Address",
  tableName: "Table 1 (4 persons)",
  orderTakerName: "John Doe",
  discountAmount: 0,
  subtotal: 100,
  total: 100,
  items: [
    { name: "Crispy Roll Paratha", unitPrice: 50, qty: 2, lineTotal: 100 },
    { name: "Garlic Sauce", unitPrice: 50, qty: 1, lineTotal: 50 },
  ],
};

function BillPreviewPane({ logoUrl, logoHeightPx, footerMessage }) {
  const html = useMemo(
    () =>
      buildBillHtml(DEMO_ORDER, {
        logoUrl: logoUrl || "",
        logoHeightPx: logoHeightPx || 100,
        footerMessage: footerMessage || "Thank you for your order!",
        mode: "bill",
      }),
    [logoUrl, logoHeightPx, footerMessage],
  );
  return (
    <div className="hidden lg:flex flex-col w-72 flex-shrink-0">
      <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-2 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" /> Live Bill Preview
      </p>
      <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900/50 overflow-hidden">
        <iframe
          srcDoc={html}
          title="Bill preview"
          style={{ width: "100%", height: "750px", border: "none", background: "#fff", display: "block" }}
          scrolling="yes"
        />
      </div>
    </div>
  );
}

function formatCutoff(h) {
  if (h === 0) return "12:00 AM";
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return "12:00 PM";
  return `${h - 12}:00 PM`;
}

const SECTIONS = [
  { id: "branding", label: "General", icon: Palette },
  { id: "branches", label: "Branches", icon: Building2 },
  { id: "bill", label: "Bill Settings", icon: FileText },
  { id: "payment-accounts", label: "Payment Accounts", icon: Wallet },
];

const inp =
  "w-full h-10 px-4 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all";

const labelCls = "text-xs font-semibold text-gray-700 dark:text-neutral-300";

const MAX_DELIVERY_ZONES = 40;

function feeCurrencyLabel(currencyCode) {
  const c = String(currencyCode || "").toUpperCase();
  if (c === "PKR") return "Rs";
  if (c === "USD") return "$";
  if (c === "EUR") return "€";
  if (c === "INR") return "₹";
  if (c === "GBP") return "£";
  if (c) return c;
  return "Rs";
}

/** Split one CSV line respecting quoted fields. */
function parseCsvRow(line) {
  const row = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (!inQuotes && c === ",") {
      row.push(cur.trim());
      cur = "";
      continue;
    }
    cur += c;
  }
  row.push(cur.trim());
  return row;
}

function parseDeliveryZonesCsv(text) {
  const lines = String(text)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];
  let start = 0;
  const headerCells = parseCsvRow(lines[0]);
  if (
    headerCells.length >= 2 &&
    /^name$/i.test(headerCells[0].replace(/\s/g, "")) &&
    /^fee$/i.test(headerCells[1].replace(/\s/g, ""))
  ) {
    start = 1;
  }
  const out = [];
  for (let i = start; i < lines.length; i++) {
    const cells = parseCsvRow(lines[i]);
    if (cells.length < 2) continue;
    const feeRaw = cells[cells.length - 1];
    const fee = Number.parseFloat(feeRaw);
    const name = cells
      .slice(0, -1)
      .join(",")
      .trim()
      .slice(0, 120);
    if (!name) continue;
    out.push({
      name,
      fee: Math.max(0, Number.isFinite(fee) ? fee : 0),
    });
  }
  return out;
}

function escapeCsvCell(v) {
  const s = String(v ?? "");
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildDeliveryZonesCsv(rows) {
  const header = ["name", "fee"].map(escapeCsvCell).join(",");
  const body = rows.map((z) =>
    [escapeCsvCell(z.name || ""), escapeCsvCell(String(z.fee ?? 0))].join(","),
  );
  return [header, ...body].join("\r\n");
}
const CURRENCY_OPTIONS = [
  { value: "", label: "Not configured (manual denominations)" },
  { value: "PKR", label: "PKR (Rs)" },
  { value: "USD", label: "USD ($)" },
  { value: "EUR", label: "EUR (€)" },
  { value: "INR", label: "INR (₹)" },
  { value: "GBP", label: "GBP (£)" },
];

const cardCls =
  "bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm";

function SectionCard({ id, icon: Icon, title, subtitle, children }) {
  return (
    <div id={`section-${id}`} className={cardCls}>
      <div className="px-6 py-5 flex items-center gap-3 border-b border-gray-100 dark:border-neutral-800">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md flex-shrink-0">
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
          <h3 className="text-base font-bold text-gray-900 dark:text-white">{title}</h3>
          {subtitle && (
            <p className="text-xs text-gray-500 dark:text-neutral-400">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="p-6 space-y-4">{children}</div>
    </div>
  );
}

export default function BusinessSettingsPage() {
  const { branches: contextBranches, currentBranch, setCurrentBranch, refreshBranches, loading: contextLoading } = useBranch() || {};
  const [activeSection, setActiveSection] = useState("branding");

  // Branches
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [branchSaving, setBranchSaving] = useState(false);
  const [branchModalError, setBranchModalError] = useState("");
  const [branchForm, setBranchForm] = useState({
    id: null,
    name: "",
    code: "",
    address: "",
    businessDayCutoffHour: 4,
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletedBranches, setDeletedBranches] = useState([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [deletedDropdownOpen, setDeletedDropdownOpen] = useState(false);

  // Per-branch delivery zone modal
  const [deliveryZonesBranch, setDeliveryZonesBranch] = useState(null);
  const [deliveryZonesEditList, setDeliveryZonesEditList] = useState([]);
  const [deliveryZonesSaving, setDeliveryZonesSaving] = useState(false);
  const [deliveryZonesSearch, setDeliveryZonesSearch] = useState("");
  const deliveryZonesListRef = useRef(null);
  const deliveryZonesListEndRef = useRef(null);
  const deliveryZonesCsvInputRef = useRef(null);

  // Branding
  const [websiteSettings, setWebsiteSettings] = useState(null);
  const [websiteLoading, setWebsiteLoading] = useState(true);
  const [websiteSaving, setWebsiteSaving] = useState(false);
  const [websiteLogoTab, setWebsiteLogoTab] = useState("link");
  const [websiteBannerTab, setWebsiteBannerTab] = useState("link");
  const [uploadingWebsiteLogo, setUploadingWebsiteLogo] = useState(false);
  const [uploadingWebsiteBanner, setUploadingWebsiteBanner] = useState(false);
  const websiteLogoInputRef = useRef(null);
  const websiteBannerInputRef = useRef(null);

  // Bill settings
  const [restaurantSettings, setRestaurantSettings] = useState(null);
  const [logoLoading, setLogoLoading] = useState(true);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoSaving, setLogoSaving] = useState(false);
  const [logoTab, setLogoTab] = useState("link");
  const [logoDirty, setLogoDirty] = useState(false);
  const [logoHeight, setLogoHeight] = useState(100);
  const [billFooterMessage, setBillFooterMessage] = useState("Thank you for your order!");
  const [currencySaving, setCurrencySaving] = useState(false);
  const logoInputRef = useRef(null);

  // Payment accounts
  const [paymentAccounts, setPaymentAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountForm, setAccountForm] = useState({ id: null, name: "", description: "" });
  const [accountSaving, setAccountSaving] = useState(false);
  const [accountModalError, setAccountModalError] = useState("");
  const [accountDeleteTarget, setAccountDeleteTarget] = useState(null);
  const [accountDeleteLoading, setAccountDeleteLoading] = useState(false);

  // ── Fetch branches ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getBranches()
      .then((d) => {
        if (!cancelled) setBranches(d?.branches ?? (Array.isArray(d) ? d : []));
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err.message || "Failed to load branches");
          setBranches([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    setDeletedLoading(true);
    getDeletedBranches()
      .then((d) => {
        if (!cancelled) setDeletedBranches(d?.branches ?? (Array.isArray(d) ? d : []));
      })
      .catch(() => {
        if (!cancelled) setDeletedBranches([]);
      })
      .finally(() => {
        if (!cancelled) setDeletedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contextBranches?.length]);

  // ── Fetch branding / website (merged for current branch when header is set) ──
  useEffect(() => {
    let cancelled = false;
    setWebsiteLoading(true);
    getWebsiteSettings()
      .then((d) => {
        if (!cancelled) setWebsiteSettings(d || {});
      })
      .catch(() => {
        if (!cancelled) setWebsiteSettings({});
      })
      .finally(() => {
        if (!cancelled) setWebsiteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentBranch?.id]);

  // ── Fetch bill settings ──
  useEffect(() => {
    let cancelled = false;
    setLogoLoading(true);
    getRestaurantSettings()
      .then((s) => {
        if (cancelled) return;
        const d = s || {};
        setRestaurantSettings(d);
        setLogoHeight(d.restaurantLogoHeightPx || 100);
        setBillFooterMessage(d.billFooterMessage || "Thank you for your order!");
        setLogoDirty(false);
      })
      .catch(() => {
        if (!cancelled) {
          setRestaurantSettings({});
        }
      })
      .finally(() => {
        if (!cancelled) setLogoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Fetch payment accounts ──
  useEffect(() => {
    let cancelled = false;
    setAccountsLoading(true);
    getPaymentAccounts()
      .then((d) => {
        if (!cancelled) setPaymentAccounts(Array.isArray(d) ? d : d?.accounts ?? []);
      })
      .catch(() => {
        if (!cancelled) setPaymentAccounts([]);
      })
      .finally(() => {
        if (!cancelled) setAccountsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const displayList = branches.length > 0 ? branches : contextBranches ?? [];
  const isLoading = loading || contextLoading;
  const restaurantLogoUrl = restaurantSettings?.restaurantLogoUrl || "";

  // ── Payment account helpers ──
  function openCreateAccount() {
    setAccountForm({ id: null, name: "", description: "" });
    setAccountModalError("");
    setAccountModalOpen(true);
  }
  function openEditAccount(acc) {
    setAccountForm({ id: acc.id, name: acc.name, description: acc.description || "" });
    setAccountModalError("");
    setAccountModalOpen(true);
  }
  async function handleAccountSubmit(e) {
    e.preventDefault();
    const name = accountForm.name.trim();
    if (!name) {
      setAccountModalError("Account name is required");
      return;
    }
    setAccountSaving(true);
    setAccountModalError("");
    const toastId = toast.loading(accountForm.id ? "Saving..." : "Adding...");
    try {
      if (accountForm.id) {
        await updatePaymentAccount(accountForm.id, { name, description: accountForm.description.trim() });
      } else {
        await createPaymentAccount({ name, description: accountForm.description.trim() });
      }
      const updated = await getPaymentAccounts();
      setPaymentAccounts(Array.isArray(updated) ? updated : updated?.accounts ?? []);
      setAccountModalOpen(false);
      toast.success(accountForm.id ? "Account updated" : "Account added", { id: toastId });
    } catch (err) {
      setAccountModalError(err.message || "Failed to save");
      toast.dismiss(toastId);
    } finally {
      setAccountSaving(false);
    }
  }
  async function handleAccountDelete(acc) {
    setAccountDeleteLoading(true);
    const toastId = toast.loading("Deleting...");
    try {
      await deletePaymentAccount(acc.id);
      setPaymentAccounts((prev) => prev.filter((a) => a.id !== acc.id));
      setAccountDeleteTarget(null);
      toast.success("Account deleted", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to delete", { id: toastId });
    } finally {
      setAccountDeleteLoading(false);
    }
  }

  // ── Branch helpers ──
  function resetBranchForm() {
    setBranchForm({
      id: null,
      name: "",
      code: "",
      address: "",
      businessDayCutoffHour: 4,
    });
  }
  function openCreateBranch() {
    resetBranchForm();
    setBranchModalError("");
    setBranchModalOpen(true);
  }
  function openEditBranch(b) {
    setBranchForm({
      id: b.id,
      name: b.name || "",
      code: b.code || "",
      address: b.address || "",
      businessDayCutoffHour: b.businessDayCutoffHour ?? 4,
    });
    setBranchModalError("");
    setBranchModalOpen(true);
  }

  async function handleBranchSubmit(e) {
    e.preventDefault();
    const name = branchForm.name.trim();
    if (!name) {
      setBranchModalError("Branch name is required");
      return;
    }
    setBranchSaving(true);
    setBranchModalError("");
    const isEdit = !!branchForm.id;
    const toastId = toast.loading(isEdit ? "Saving changes..." : "Creating branch...");
    try {
      const payload = {
        name,
        code: branchForm.code.trim() || undefined,
        address: branchForm.address.trim() || undefined,
        businessDayCutoffHour: branchForm.businessDayCutoffHour ?? 4,
      };
      let created = null;
      if (isEdit) {
        await updateBranch(branchForm.id, payload);
      } else {
        const c = await createBranch(payload);
        created = c?.branch || c;
      }
      const data = await getBranches();
      const list = data?.branches ?? (Array.isArray(data) ? data : []);
      setBranches(list);
      if (!isEdit) {
        if (created?.id) setCurrentBranch(created);
        toast.success(`Branch "${created?.name || name}" created!`, { id: toastId });
      } else {
        if (currentBranch?.id) {
          const u = list.find((b) => b.id === currentBranch.id);
          if (u) setCurrentBranch(u);
        }
        toast.success(`Branch "${name}" updated!`, { id: toastId });
      }
      resetBranchForm();
      setBranchModalOpen(false);
    } catch (err) {
      setBranchModalError(err.message || "Failed to save branch");
      toast.error(err.message || "Failed to save branch", { id: toastId });
    } finally {
      setBranchSaving(false);
    }
  }

  // ── Branding helpers ──
  async function handleWebsiteSubmit(e) {
    e.preventDefault();
    if (!websiteSettings) return;
    setWebsiteSaving(true);
    const toastId = toast.loading("Saving branding...");
    try {
      const updated = await updateWebsiteSettings(websiteSettings);
      setWebsiteSettings(updated);
      toast.success("Branding saved!", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to save branding", { id: toastId });
    } finally {
      setWebsiteSaving(false);
    }
  }
  const onWebsiteChange = (f) => (e) => setWebsiteSettings((p) => ({ ...p, [f]: e.target.value }));

  async function handleWebsiteLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingWebsiteLogo(true);
    try {
      const { url } = await uploadImage(file);
      setWebsiteSettings((p) => ({ ...(p || {}), logoUrl: url }));
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingWebsiteLogo(false);
      if (websiteLogoInputRef.current) websiteLogoInputRef.current.value = "";
    }
  }
  async function handleWebsiteBannerUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingWebsiteBanner(true);
    try {
      const { url } = await uploadImage(file);
      setWebsiteSettings((p) => ({ ...(p || {}), bannerUrl: url }));
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingWebsiteBanner(false);
      if (websiteBannerInputRef.current) websiteBannerInputRef.current.value = "";
    }
  }

  // ── Per-branch delivery zone modal helpers ──
  function openDeliveryZonesModal(branch) {
    setDeliveryZonesSearch("");
    setDeliveryZonesBranch(branch);
    setDeliveryZonesEditList(
      Array.isArray(branch.deliveryLocations)
        ? branch.deliveryLocations.map((z) => ({ ...z }))
        : []
    );
  }

  function closeDeliveryZonesModal() {
    setDeliveryZonesSearch("");
    setDeliveryZonesBranch(null);
    setDeliveryZonesEditList([]);
  }

  function updateDeliveryZone(index, field, value) {
    setDeliveryZonesEditList((prev) => {
      const next = [...prev];
      next[index] = { ...(next[index] || {}), [field]: value };
      return next;
    });
  }

  function addDeliveryZone() {
    setDeliveryZonesEditList((prev) => {
      if (prev.length >= MAX_DELIVERY_ZONES) {
        toast.error(`Maximum ${MAX_DELIVERY_ZONES} delivery zones per branch.`);
        return prev;
      }
      return [...prev, { name: "", fee: 0 }];
    });
    setTimeout(() => {
      deliveryZonesListEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end",
      });
    }, 0);
  }

  const deliveryZonesFilteredRows = useMemo(() => {
    const q = deliveryZonesSearch.trim().toLowerCase();
    if (!q) {
      return deliveryZonesEditList.map((z, idx) => ({ z, idx }));
    }
    return deliveryZonesEditList
      .map((z, idx) => ({ z, idx }))
      .filter(
        ({ z }) =>
          String(z.name || "")
            .toLowerCase()
            .includes(q) || String(z.fee ?? "").includes(q),
      );
  }, [deliveryZonesEditList, deliveryZonesSearch]);

  function exportDeliveryZonesCsv() {
    const csv = buildDeliveryZonesCsv(deliveryZonesEditList);
    const blob = new Blob(["\ufeff", csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safe = String(deliveryZonesBranch?.name || "branch")
      .replace(/[^\w\-]+/g, "-")
      .slice(0, 40);
    a.download = `delivery-zones-${safe}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  }

  function handleDeliveryZonesCsvImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseDeliveryZonesCsv(String(reader.result || ""));
        if (parsed.length === 0) {
          toast.error("No valid rows found. Use columns: name, fee");
          return;
        }
        setDeliveryZonesEditList((prev) => {
          const next = [...prev];
          for (const row of parsed) {
            if (next.length >= MAX_DELIVERY_ZONES) break;
            next.push({ name: row.name, fee: row.fee });
          }
          const added = next.length - prev.length;
          if (added > 0) {
            setTimeout(() => {
              toast.success(`Imported ${added} zone(s)`);
              deliveryZonesListEndRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "end",
              });
            }, 0);
          } else if (parsed.length > 0) {
            setTimeout(
              () =>
                toast.error(
                  `Cannot import more zones (max ${MAX_DELIVERY_ZONES} per branch).`,
                ),
              0,
            );
          }
          return next;
        });
      } catch {
        toast.error("Could not read CSV file");
      }
      if (deliveryZonesCsvInputRef.current) deliveryZonesCsvInputRef.current.value = "";
    };
    reader.readAsText(file, "UTF-8");
  }

  function removeDeliveryZone(index) {
    setDeliveryZonesEditList((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleDeliveryZonesSave(e) {
    e.preventDefault();
    if (!deliveryZonesBranch) return;
    const cleaned = deliveryZonesEditList
      .map((z, i) => ({
        _id: z._id || z.id,
        name: String(z.name || "").trim(),
        fee: Math.max(0, Number(z.fee) || 0),
        sortOrder: i,
      }))
      .filter((z) => z.name.length > 0);
    setDeliveryZonesSaving(true);
    const toastId = toast.loading("Saving delivery zones...");
    try {
      const updated = await updateBranchDeliveryZones(deliveryZonesBranch.id, cleaned);
      setBranches((prev) =>
        prev.map((b) => (b.id === updated.id ? updated : b))
      );
      setDeliveryZonesBranch(updated);
      setDeliveryZonesEditList(
        Array.isArray(updated.deliveryLocations)
          ? updated.deliveryLocations.map((z) => ({ ...z }))
          : []
      );
      refreshBranches?.();
      toast.success("Delivery zones saved", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to save", { id: toastId });
    } finally {
      setDeliveryZonesSaving(false);
    }
  }

  // ── Bill settings helpers ──
  async function handleLogoSave() {
    if (!restaurantSettings) return;
    setLogoSaving(true);
    const toastId = toast.loading("Saving bill settings...");
    try {
      const updated = await updateRestaurantSettings({
        ...restaurantSettings,
        restaurantLogoUrl,
        restaurantLogoHeightPx: logoHeight,
        billFooterMessage,
      });
      setRestaurantSettings(updated);
      setLogoHeight(updated?.restaurantLogoHeightPx || logoHeight);
      setBillFooterMessage(updated?.billFooterMessage || "Thank you for your order!");
      setLogoDirty(false);
      toast.success("Bill settings saved!", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to save settings", { id: toastId });
    } finally {
      setLogoSaving(false);
    }
  }

  async function handleCurrencySave() {
    setCurrencySaving(true);
    const toastId = toast.loading("Saving currency...");
    try {
      const updated = await updateRestaurantSettings({
        currencyCode: restaurantSettings?.currencyCode || null,
      });
      setRestaurantSettings((prev) => ({ ...(prev || {}), ...updated }));
      if (updated?.currencyCode) {
        setStoredCurrencyCode(updated.currencyCode);
      }
      toast.success("Currency setting saved", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to save currency", { id: toastId });
    } finally {
      setCurrencySaving(false);
    }
  }
  async function handleLogoUploadChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const { url } = await uploadImage(file);
      setRestaurantSettings((p) => ({ ...(p || {}), restaurantLogoUrl: url }));
      setLogoDirty(true);
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  function MediaToggle({ tab, setTab, onLink, linkValue, onUpload, uploading, inputRef }) {
    return (
      <div className="space-y-2">
        <div className="inline-flex rounded-xl border-2 border-gray-200 dark:border-neutral-700 overflow-hidden">
          {[
            ["link", LinkIcon, "URL"],
            ["upload", Upload, "Upload"],
          ].map(([t, Icon, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`inline-flex items-center gap-1.5 px-3 h-8 text-xs font-semibold transition-colors ${
                t !== "link" ? "border-l-2 border-gray-200 dark:border-neutral-700" : ""
              } ${
                tab === t
                  ? "bg-gradient-to-r from-primary to-secondary text-white"
                  : "bg-white dark:bg-neutral-950 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
        {tab === "link" ? (
          <input
            type="text"
            value={linkValue}
            onChange={onLink}
            placeholder="https://..."
            className={inp}
          />
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-20 rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:border-primary/50 cursor-pointer transition-colors">
            {uploading ? (
              <>
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
                <span className="text-xs text-primary mt-1">Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-xs text-gray-500 mt-1">Click to browse</span>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onUpload}
              disabled={uploading}
            />
          </label>
        )}
      </div>
    );
  }

  function scrollTo(id) {
    // clicking a nav item just swaps the visible section.
    setActiveSection(id);
  }

  return (
    <AdminLayout title="Business Settings">
      <div className="flex gap-6 items-start">
        {/* ── Left anchor navigation (desktop) ── */}
        <div className="hidden lg:block w-48 flex-shrink-0">
          <div className="sticky top-4 space-y-1">
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => scrollTo(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${
                  activeSection === id
                    ? "bg-primary/10 text-primary dark:text-primary"
                    : "text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Right content area — single section visible ── */}
        <div className="flex-1 min-w-0 space-y-6">
          {/* Mobile section selector */}
          <div className="lg:hidden">
            <label className={labelCls}>Section</label>
            <select
              value={activeSection}
              onChange={(e) => setActiveSection(e.target.value)}
              className={inp}
            >
              {SECTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* ════ GENERAL ════ */}
          {activeSection === "branding" && (
            <SectionCard
              id="branding"
              icon={Palette}
              title="General"
              subtitle="Basic details and branding for your restaurant website"
            >
              {websiteLoading ? (
                <div className="flex items-center justify-center gap-2 py-12">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-gray-500 dark:text-neutral-400">
                    Loading branding settings...
                  </span>
                </div>
              ) : (
                <form onSubmit={handleWebsiteSubmit}>

                  {/* ── Two-column main body ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">

                    {/* Left column — identity + contact */}
                    <div className="space-y-5">
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest mb-3">Restaurant Identity</p>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <label className={labelCls}>Restaurant Name</label>
                            <input
                              type="text"
                              value={websiteSettings?.name || ""}
                              onChange={onWebsiteChange("name")}
                              placeholder="Your Restaurant Name"
                              className={inp}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className={labelCls}>Description</label>
                            <textarea
                              rows={4}
                              value={websiteSettings?.description || ""}
                              onChange={onWebsiteChange("description")}
                              placeholder="Tell customers about your restaurant…"
                              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-gray-100 dark:border-neutral-800" />

                      <div>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest mb-3">Contact Details</p>
                        <div className="grid gap-4 sm:grid-cols-2">
                          <div className="space-y-1.5">
                            <label className={`${labelCls} flex items-center gap-1.5`}>
                              <Phone className="w-3.5 h-3.5 text-primary" />
                              Phone
                            </label>
                            <input
                              type="text"
                              value={websiteSettings?.contactPhone || ""}
                              onChange={onWebsiteChange("contactPhone")}
                              placeholder="03XX-XXXXXXX"
                              className={inp}
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className={`${labelCls} flex items-center gap-1.5`}>
                              <Mail className="w-3.5 h-3.5 text-primary" />
                              Email
                            </label>
                            <input
                              type="email"
                              value={websiteSettings?.contactEmail || ""}
                              onChange={onWebsiteChange("contactEmail")}
                              placeholder="contact@restaurant.com"
                              className={inp}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="border-t border-gray-100 dark:border-neutral-800" />

                      {/* ── Currency ── */}
                      <div>
                        <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest mb-3">Operating Currency</p>
                        <div className="space-y-1.5">
                          <p className="text-[11px] text-gray-500 dark:text-neutral-400">Saved separately — applied across POS and all reports</p>
                          <div className="flex items-center gap-2">
                            <select
                              value={restaurantSettings?.currencyCode || ""}
                              onChange={(e) =>
                                setRestaurantSettings((p) => ({
                                  ...(p || {}),
                                  currencyCode: e.target.value || null,
                                }))
                              }
                              className={inp}
                            >
                              {CURRENCY_OPTIONS.map((opt) => (
                                <option key={opt.value || "none"} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={handleCurrencySave}
                              disabled={currencySaving}
                              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border-2 border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-60 flex-shrink-0"
                            >
                              {currencySaving ? <><Loader2 className="w-3 h-3 animate-spin" />Saving…</> : <><Check className="w-3 h-3" />Save</>}
                            </button>
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={websiteSaving}
                        className="inline-flex items-center gap-2 h-10 px-6 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                      >
                        {websiteSaving ? (
                          <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                        ) : (
                          <><Check className="w-4 h-4" />Save</>
                        )}
                      </button>
                    </div>

                    {/* Right column — logo only */}
                    <div className="space-y-4">
                      <p className="text-[10px] font-bold text-gray-400 dark:text-neutral-500 uppercase tracking-widest">Logo</p>
                      <div className="rounded-xl border border-gray-100 dark:border-neutral-800 p-4 space-y-3 bg-gray-50/40 dark:bg-neutral-900/30">
                        <MediaToggle
                          tab={websiteLogoTab}
                          setTab={setWebsiteLogoTab}
                          linkValue={websiteSettings?.logoUrl || ""}
                          onLink={onWebsiteChange("logoUrl")}
                          onUpload={handleWebsiteLogoUpload}
                          uploading={uploadingWebsiteLogo}
                          inputRef={websiteLogoInputRef}
                        />
                        {/* Preview */}
                        <div className="rounded-lg border border-gray-100 dark:border-neutral-800 bg-white dark:bg-neutral-950 flex items-center justify-center h-32 overflow-hidden">
                          {websiteSettings?.logoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={websiteSettings.logoUrl}
                              alt="Logo preview"
                              className="max-h-24 max-w-full object-contain"
                            />
                          ) : (
                            <div className="flex flex-col items-center gap-1.5 text-gray-300 dark:text-neutral-600">
                              <ImageIcon className="w-8 h-8" />
                              <span className="text-[11px]">No logo set</span>
                            </div>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-400 dark:text-neutral-500">Shown on your public restaurant page</p>
                      </div>
                    </div>

                  </div>
                </form>
              )}
            </SectionCard>
          )}

          {/* ════ BRANCHES (includes per-branch delivery zones) ════ */}
          {activeSection === "branches" && (
            <SectionCard
              id="branches"
              icon={Building2}
              title="Branches"
              subtitle="Manage your restaurant branches, working hours, and delivery zones"
            >
              <div className="flex justify-between items-center mb-4">
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  Branches control where orders are prepared and which menus / delivery zones apply.
                </p>
                <button
                  type="button"
                  onClick={openCreateBranch}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-white text-xs font-semibold shadow-sm hover:bg-primary/90"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Branch
                </button>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-gray-500 dark:text-neutral-400">Loading branches...</span>
                </div>
              ) : displayList.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-700 p-6 text-center">
                  <p className="text-sm text-gray-600 dark:text-neutral-300 font-medium">
                    No branches yet.
                  </p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                    Create at least one branch to start taking orders.
                  </p>
                  <button
                    type="button"
                    onClick={openCreateBranch}
                    className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-white text-xs font-semibold shadow-sm hover:bg-primary/90"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Create first branch
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-neutral-800">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-neutral-950/60">
                        <tr className="text-xs text-gray-500 dark:text-neutral-400">
                          <th className="px-4 py-2 text-left font-semibold">Name</th>
                          <th className="px-4 py-2 text-left font-semibold hidden sm:table-cell">Code</th>
                          <th className="px-4 py-2 text-left font-semibold hidden md:table-cell">Address</th>
                          <th className="px-4 py-2 text-left font-semibold">Business Day Cutoff</th>
                          <th className="px-4 py-2 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayList.map((b) => (
                          <tr
                            key={b.id}
                            className="border-t border-gray-100 dark:border-neutral-800 hover:bg-gray-50/60 dark:hover:bg-neutral-900/60"
                          >
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => setCurrentBranch(b)}
                                  className={`h-6 px-2 rounded-lg text-[11px] font-semibold ${
                                    currentBranch?.id === b.id
                                      ? "bg-primary/10 text-primary"
                                      : "bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-300"
                                  }`}
                                >
                                  {currentBranch?.id === b.id ? "Current" : "Switch"}
                                </button>
                                <span className="font-semibold text-gray-900 dark:text-white">{b.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-neutral-300 hidden sm:table-cell">
                              {b.code || "—"}
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-neutral-300 hidden md:table-cell max-w-xs">
                              <p className="truncate">{b.address || "—"}</p>
                            </td>
                            <td className="px-4 py-2 text-gray-600 dark:text-neutral-300">
                              {formatCutoff(b.businessDayCutoffHour ?? 4)}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <div className="inline-flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => openDeliveryZonesModal(b)}
                                  title="Manage delivery zones"
                                  className={`relative inline-flex items-center justify-center h-8 w-8 rounded-lg border text-gray-500 hover:text-primary hover:border-primary/40 ${
                                    b.deliveryLocations?.length > 0
                                      ? "border-primary/30 text-primary"
                                      : "border-gray-200 dark:border-neutral-800"
                                  }`}
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  {b.deliveryLocations?.length > 0 && (
                                    <span className="absolute -top-1.5 -right-1.5 h-4 min-w-[16px] px-1 rounded-full bg-primary text-white text-[9px] font-bold flex items-center justify-center leading-none">
                                      {b.deliveryLocations.length}
                                    </span>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditBranch(b)}
                                  className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 dark:border-neutral-800 text-gray-500 hover:text-primary hover:border-primary/40"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteTarget(b)}
                                  className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-red-100 text-red-500 hover:bg-red-50"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Delivery zones modal */}
                  {deliveryZonesBranch && (
                    <div
                      className="fixed inset-0 z-40 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-[2px]"
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="delivery-zones-modal-title"
                    >
                      <div className="w-full max-w-2xl max-h-[min(92vh,720px)] rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 shadow-2xl shadow-black/20 flex flex-col overflow-hidden ring-1 ring-black/5 dark:ring-white/10">
                        <div className="flex-shrink-0 px-5 sm:px-6 pt-5 pb-3 border-b border-gray-100 dark:border-neutral-800/80 bg-gradient-to-b from-gray-50/80 to-transparent dark:from-neutral-900/50">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/15 to-secondary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
                                <Truck className="w-5 h-5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                <h3
                                  id="delivery-zones-modal-title"
                                  className="text-base font-bold text-gray-900 dark:text-white tracking-tight"
                                >
                                  Delivery zones
                                </h3>
                                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5 truncate">
                                  Branch:{" "}
                                  <span className="font-semibold text-gray-700 dark:text-neutral-300">
                                    {deliveryZonesBranch.name}
                                  </span>
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={closeDeliveryZonesModal}
                              className="h-9 w-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-900 border border-transparent hover:border-gray-200 dark:hover:border-neutral-700 flex-shrink-0"
                              aria-label="Close"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 dark:text-neutral-400 mt-3 leading-relaxed">
                            Named areas with a flat delivery fee. Used at checkout and on the rider app. Max{" "}
                            {MAX_DELIVERY_ZONES} zones.
                          </p>
                        </div>

                        <form
                          onSubmit={handleDeliveryZonesSave}
                          className="flex flex-col flex-1 min-h-0"
                        >
                          <div className="flex-shrink-0 px-5 sm:px-6 py-3 space-y-3 border-b border-gray-100 dark:border-neutral-800/80 bg-white/80 dark:bg-neutral-950/80">
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                              <input
                                type="search"
                                value={deliveryZonesSearch}
                                onChange={(e) => setDeliveryZonesSearch(e.target.value)}
                                placeholder="Search by area name or fee…"
                                className={`${inp} pl-10 h-9 text-sm`}
                                autoComplete="off"
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                ref={deliveryZonesCsvInputRef}
                                type="file"
                                accept=".csv,text/csv"
                                className="hidden"
                                onChange={handleDeliveryZonesCsvImport}
                              />
                              <button
                                type="button"
                                onClick={() => deliveryZonesCsvInputRef.current?.click()}
                                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                Import CSV
                              </button>
                              <button
                                type="button"
                                onClick={exportDeliveryZonesCsv}
                                disabled={deliveryZonesEditList.length === 0}
                                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                <Download className="w-3.5 h-3.5" />
                                Export CSV
                              </button>
                              <span className="text-[10px] text-gray-400 dark:text-neutral-500 ml-auto tabular-nums">
                                {deliveryZonesEditList.length} / {MAX_DELIVERY_ZONES} zones
                                {deliveryZonesSearch.trim()
                                  ? ` · ${deliveryZonesFilteredRows.length} shown`
                                  : ""}
                              </span>
                            </div>
                          </div>

                          <div
                            ref={deliveryZonesListRef}
                            className="flex-1 min-h-[min(200px,35vh)] max-h-[42vh] sm:max-h-[46vh] overflow-y-auto overscroll-contain px-5 sm:px-6 py-4 space-y-2.5"
                          >
                            {deliveryZonesEditList.length === 0 ? (
                              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-700 p-8 text-center bg-gray-50/50 dark:bg-neutral-900/30">
                                <p className="text-sm font-medium text-gray-700 dark:text-neutral-200">
                                  No delivery zones yet
                                </p>
                                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-2 max-w-sm mx-auto">
                                  Add rows manually, or import a CSV with columns{" "}
                                  <code className="text-[10px] bg-gray-200/80 dark:bg-neutral-800 px-1 rounded">
                                    name,fee
                                  </code>
                                  .
                                </p>
                                <button
                                  type="button"
                                  onClick={addDeliveryZone}
                                  className="mt-4 inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-white text-xs font-semibold hover:opacity-95"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  Add first zone
                                </button>
                              </div>
                            ) : deliveryZonesFilteredRows.length === 0 ? (
                              <div className="rounded-xl border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-4 text-center">
                                <p className="text-sm text-amber-900 dark:text-amber-200/90">
                                  No zones match &quot;{deliveryZonesSearch.trim()}&quot;
                                </p>
                                <button
                                  type="button"
                                  onClick={() => setDeliveryZonesSearch("")}
                                  className="mt-2 text-xs font-semibold text-primary hover:underline"
                                >
                                  Clear search
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="hidden sm:grid sm:grid-cols-[minmax(0,1fr)_100px_44px] gap-3 px-1 pb-1">
                                  <span className={labelCls}>Area name</span>
                                  <span className={labelCls}>
                                    Fee ({feeCurrencyLabel(restaurantSettings?.currencyCode)})
                                  </span>
                                  <span className="sr-only">Remove</span>
                                </div>
                                {deliveryZonesFilteredRows.map(({ z, idx }) => (
                                  <div
                                    key={z._id || z.id || `row-${idx}`}
                                    className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_100px_44px] gap-2 sm:gap-3 items-end p-3 rounded-xl border border-gray-100 dark:border-neutral-800 bg-gray-50/40 dark:bg-neutral-900/40 hover:border-gray-200 dark:hover:border-neutral-700 transition-colors"
                                  >
                                    <div className="space-y-1 sm:space-y-0">
                                      <label className={`${labelCls} sm:hidden`}>Area name</label>
                                      <input
                                        type="text"
                                        value={z.name || ""}
                                        onChange={(e) =>
                                          updateDeliveryZone(idx, "name", e.target.value)
                                        }
                                        placeholder="e.g. Bahria Phase 7"
                                        className={inp}
                                      />
                                    </div>
                                    <div className="space-y-1 sm:space-y-0">
                                      <label className={`${labelCls} sm:hidden`}>
                                        Fee ({feeCurrencyLabel(restaurantSettings?.currencyCode)})
                                      </label>
                                      <input
                                        type="number"
                                        min={0}
                                        step={1}
                                        value={z.fee ?? ""}
                                        onChange={(e) =>
                                          updateDeliveryZone(
                                            idx,
                                            "fee",
                                            Number.parseFloat(e.target.value) || 0,
                                          )
                                        }
                                        className={inp}
                                      />
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => removeDeliveryZone(idx)}
                                      className="h-10 w-full sm:w-10 inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-neutral-700 text-gray-500 hover:text-red-500 hover:border-red-200 dark:hover:border-red-900/50 flex-shrink-0 justify-self-end sm:justify-self-center"
                                      aria-label="Remove zone"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                ))}
                                <div ref={deliveryZonesListEndRef} className="h-1 w-full flex-shrink-0" aria-hidden />
                              </>
                            )}
                          </div>

                          <div className="flex-shrink-0 px-5 sm:px-6 py-4 border-t border-gray-100 dark:border-neutral-800 bg-gray-50/90 dark:bg-neutral-900/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                            <button
                              type="button"
                              onClick={addDeliveryZone}
                              disabled={deliveryZonesEditList.length >= MAX_DELIVERY_ZONES}
                              className="inline-flex items-center justify-center gap-1.5 h-10 px-4 rounded-xl border-2 border-dashed border-primary/35 text-xs font-semibold text-primary hover:bg-primary/5 dark:hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed order-2 sm:order-1"
                            >
                              <Plus className="w-4 h-4" />
                              Add zone
                            </button>
                            <div className="flex items-center justify-end gap-2 order-1 sm:order-2">
                              <button
                                type="button"
                                onClick={closeDeliveryZonesModal}
                                className="h-10 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-white dark:hover:bg-neutral-950"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={deliveryZonesSaving}
                                className="inline-flex items-center justify-center gap-2 h-10 px-6 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-semibold hover:shadow-lg hover:shadow-primary/25 transition-all disabled:opacity-60 disabled:cursor-not-allowed min-w-[120px]"
                              >
                                {deliveryZonesSaving ? (
                                  <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving…
                                  </>
                                ) : (
                                  "Save zones"
                                )}
                              </button>
                            </div>
                          </div>
                        </form>
                      </div>
                    </div>
                  )}

                  {/* Deleted branches summary */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setDeletedDropdownOpen((v) => !v)}
                      className="text-xs font-medium text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200 flex items-center gap-1"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {deletedDropdownOpen ? "Hide deleted branches" : "Show deleted branches"}
                      {deletedLoading ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : deletedBranches.length > 0 ? (
                        <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-gray-100 dark:bg-neutral-900 text-[10px] font-semibold text-gray-700 dark:text-neutral-200">
                          {deletedBranches.length}
                        </span>
                      ) : null}
                    </button>
                  </div>

                  {deletedDropdownOpen && (
                    <div className="rounded-xl border border-dashed border-gray-200 dark:border-neutral-800 p-4 space-y-2">
                      {deletedLoading ? (
                        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-neutral-400">
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Loading deleted branches...
                        </div>
                      ) : deletedBranches.length === 0 ? (
                        <p className="text-xs text-gray-500 dark:text-neutral-400">
                          No deleted branches.
                        </p>
                      ) : (
                        deletedBranches.map((b) => (
                          <div
                            key={b.id}
                            className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-neutral-300"
                          >
                            <span>{b.name}</span>
                            <button
                              type="button"
                              onClick={async () => {
                                setDeleteLoading(true);
                                const toastId = toast.loading("Restoring...");
                                try {
                                  await restoreBranch(b.id);
                                  const data = await getBranches();
                                  setBranches(data?.branches ?? (Array.isArray(data) ? data : []));
                                  const del = await getDeletedBranches();
                                  setDeletedBranches(del?.branches ?? (Array.isArray(del) ? del : []));
                                  toast.success("Branch restored", { id: toastId });
                                } catch (err) {
                                  toast.error(err.message || "Failed to restore", { id: toastId });
                                } finally {
                                  setDeleteLoading(false);
                                }
                              }}
                              className="inline-flex items-center gap-1 h-7 px-3 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 text-[11px] font-semibold"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Restore
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Branch modal */}
              {branchModalOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                  <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {branchForm.id ? "Edit Branch" : "Add Branch"}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setBranchModalOpen(false);
                          resetBranchForm();
                        }}
                        className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-900"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                    {branchModalError && (
                      <p className="text-xs text-red-500">{branchModalError}</p>
                    )}
                    <form onSubmit={handleBranchSubmit} className="space-y-3">
                      <div className="space-y-1.5">
                        <label className={labelCls}>Branch Name</label>
                        <input
                          type="text"
                          value={branchForm.name}
                          onChange={(e) =>
                            setBranchForm((p) => ({ ...p, name: e.target.value }))
                          }
                          className={inp}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Code (optional)</label>
                        <input
                          type="text"
                          value={branchForm.code}
                          onChange={(e) =>
                            setBranchForm((p) => ({ ...p, code: e.target.value }))
                          }
                          className={inp}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Address</label>
                        <textarea
                          rows={2}
                          value={branchForm.address}
                          onChange={(e) =>
                            setBranchForm((p) => ({ ...p, address: e.target.value }))
                          }
                          className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none transition-all"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Business Day Cutoff</label>
                        <select
                          value={branchForm.businessDayCutoffHour}
                          onChange={(e) =>
                            setBranchForm((p) => ({
                              ...p,
                              businessDayCutoffHour: Number(e.target.value),
                            }))
                          }
                          className={inp}
                        >
                          {Array.from({ length: 24 }, (_, h) => (
                            <option key={h} value={h}>
                              {formatCutoff(h)}
                            </option>
                          ))}
                        </select>
                        <p className="text-[11px] text-gray-500 dark:text-neutral-400">
                          Orders after this time will count towards the next business day.
                        </p>
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setBranchModalOpen(false);
                            resetBranchForm();
                          }}
                          className="h-9 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={branchSaving}
                          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-white text-xs font-semibold shadow-sm hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {branchSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {branchForm.id ? "Save changes" : "Create branch"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Delete confirmation */}
              {deleteTarget && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                  <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-red-500" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Delete branch
                      </h3>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-neutral-300">
                      This will archive <span className="font-semibold">{deleteTarget.name}</span>. You
                      can restore it later from the deleted branches list.
                    </p>
                    <div className="space-y-1.5">
                      <label className={labelCls}>Type the branch name to confirm</label>
                      <input
                        type="text"
                        value={deleteConfirmName}
                        onChange={(e) => setDeleteConfirmName(e.target.value)}
                        className={inp}
                        placeholder={deleteTarget.name}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteTarget(null);
                          setDeleteConfirmName("");
                        }}
                        className="h-9 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={
                          deleteLoading ||
                          deleteConfirmName.trim().toLowerCase() !==
                            deleteTarget.name.trim().toLowerCase()
                        }
                        onClick={async () => {
                          setDeleteLoading(true);
                          const toastId = toast.loading("Deleting branch...");
                          try {
                            await deleteBranch(deleteTarget.id);
                            const data = await getBranches();
                            setBranches(data?.branches ?? (Array.isArray(data) ? data : []));
                            const del = await getDeletedBranches();
                            setDeletedBranches(del?.branches ?? (Array.isArray(del) ? del : []));
                            setDeleteTarget(null);
                            setDeleteConfirmName("");
                            toast.success("Branch deleted", { id: toastId });
                          } catch (err) {
                            toast.error(err.message || "Failed to delete branch", { id: toastId });
                          } finally {
                            setDeleteLoading(false);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-red-500 text-white text-xs font-semibold shadow-sm hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {deleteLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>
          )}

          {/* ════ BILL SETTINGS ════ */}
          {activeSection === "bill" && (
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              <div className="flex-1 min-w-0">
                <SectionCard
                  id="bill"
                  icon={FileText}
                  title="Bill Settings"
                  subtitle="Logo and footer used on printed bills and kitchen tickets"
                >
                  {logoLoading ? (
                    <div className="flex items-center justify-center gap-2 py-8">
                      <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      <span className="text-sm text-gray-500 dark:text-neutral-400">
                        Loading bill settings...
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-4 max-w-xl">
                      <div className="space-y-1.5">
                        <label className={`${labelCls} flex items-center gap-1.5`}>
                          <ImageIcon className="w-3.5 h-3.5" />
                          Bill Logo
                        </label>
                        <MediaToggle
                          tab={logoTab}
                          setTab={setLogoTab}
                          linkValue={restaurantSettings?.restaurantLogoUrl || ""}
                          onLink={(e) => {
                            const v = e.target.value;
                            setRestaurantSettings((p) => ({ ...(p || {}), restaurantLogoUrl: v }));
                            setLogoDirty(true);
                          }}
                          onUpload={handleLogoUploadChange}
                          uploading={logoUploading}
                          inputRef={logoInputRef}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelCls}>Logo height (pixels)</label>
                        <input
                          type="number"
                          min={40}
                          max={300}
                          value={logoHeight}
                          onChange={(e) => {
                            const v = Number(e.target.value) || 0;
                            setLogoHeight(v);
                            setLogoDirty(true);
                          }}
                          className={inp}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className={labelCls}>Bill footer message</label>
                        <textarea
                          rows={3}
                          value={billFooterMessage}
                          onChange={(e) => {
                            setBillFooterMessage(e.target.value);
                            setLogoDirty(true);
                          }}
                          className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none transition-all"
                        />
                        <p className="text-[11px] text-gray-500 dark:text-neutral-400">
                          Shown at the bottom of each printed customer bill.
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={logoSaving || !logoDirty}
                        onClick={handleLogoSave}
                        className="inline-flex items-center gap-2 h-10 px-6 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                      >
                        {logoSaving ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Bill Settings"
                        )}
                      </button>
                    </div>
                  )}
                </SectionCard>
              </div>

              <BillPreviewPane
                logoUrl={restaurantSettings?.restaurantLogoUrl}
                logoHeightPx={logoHeight}
                footerMessage={billFooterMessage}
              />
            </div>
          )}

          {/* ════ PAYMENT ACCOUNTS ════ */}
          {activeSection === "payment-accounts" && (
            <SectionCard
              id="payment-accounts"
              icon={Wallet}
              title="Payment Accounts"
              subtitle="Bank accounts, Easypaisa / JazzCash, or cash drawers for reconciliation"
            >
              <div className="flex justify-between items-center mb-4">
                <p className="text-xs text-gray-500 dark:text-neutral-400">
                  These accounts appear in POS payment options and reports.
                </p>
                <button
                  type="button"
                  onClick={openCreateAccount}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-white text-xs font-semibold shadow-sm hover:bg-primary/90"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Account
                </button>
              </div>

              {accountsLoading ? (
                <div className="flex items-center justify-center gap-2 py-8">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-gray-500 dark:text-neutral-400">
                    Loading accounts...
                  </span>
                </div>
              ) : paymentAccounts.length === 0 ? (
                <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-700 p-6 text-center">
                  <p className="text-sm text-gray-600 dark:text-neutral-300 font-medium">
                    No payment accounts yet.
                  </p>
                  <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                    Add bank accounts, mobile wallets, or &quot;Cash drawer&quot; accounts for POS.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {paymentAccounts.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-neutral-800 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                          {acc.name}
                        </p>
                        {acc.description && (
                          <p className="text-xs text-gray-500 dark:text-neutral-400 truncate">
                            {acc.description}
                          </p>
                        )}
                      </div>
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => openEditAccount(acc)}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-200 dark:border-neutral-800 text-gray-500 hover:text-primary hover:border-primary/40"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setAccountDeleteTarget(acc)}
                          className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-red-100 text-red-500 hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Account modal */}
              {accountModalOpen && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                  <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        {accountForm.id ? "Edit Account" : "Add Account"}
                      </h3>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountModalOpen(false);
                          setAccountModalError("");
                        }}
                        className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-900"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                    {accountModalError && (
                      <p className="text-xs text-red-500">{accountModalError}</p>
                    )}
                    <form onSubmit={handleAccountSubmit} className="space-y-3">
                      <div className="space-y-1.5">
                        <label className={labelCls}>Account name</label>
                        <input
                          type="text"
                          value={accountForm.name}
                          onChange={(e) =>
                            setAccountForm((p) => ({ ...p, name: e.target.value }))
                          }
                          className={inp}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelCls}>Description (optional)</label>
                        <textarea
                          rows={2}
                          value={accountForm.description}
                          onChange={(e) =>
                            setAccountForm((p) => ({ ...p, description: e.target.value }))
                          }
                          className="w-full px-4 py-2 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none transition-all"
                        />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setAccountModalOpen(false);
                            setAccountModalError("");
                          }}
                          className="h-9 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={accountSaving}
                          className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-primary text-white text-xs font-semibold shadow-sm hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {accountSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {accountForm.id ? "Save changes" : "Add account"}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              )}

              {/* Account delete confirm */}
              {accountDeleteTarget && (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                  <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-6 space-y-4">
                    <div className="flex items-center gap-2">
                      <Trash2 className="w-4 h-4 text-red-500" />
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                        Delete account
                      </h3>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-neutral-300">
                      This will remove{" "}
                      <span className="font-semibold">{accountDeleteTarget.name}</span> from future
                      orders. Existing reports will keep using it.
                    </p>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setAccountDeleteTarget(null)}
                        className="h-9 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={accountDeleteLoading}
                        onClick={() => handleAccountDelete(accountDeleteTarget)}
                        className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-red-500 text-white text-xs font-semibold shadow-sm hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {accountDeleteLoading && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        )}
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </SectionCard>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
