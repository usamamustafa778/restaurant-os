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
    setDeliveryZonesBranch(branch);
    setDeliveryZonesEditList(
      Array.isArray(branch.deliveryLocations)
        ? branch.deliveryLocations.map((z) => ({ ...z }))
        : []
    );
  }

  function closeDeliveryZonesModal() {
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
    setDeliveryZonesEditList((prev) => [...prev, { name: "", fee: 0 }]);
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
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={linkValue}
              onChange={onLink}
              placeholder="https://..."
              className={inp}
            />
            {linkValue ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={linkValue}
                alt=""
                className="h-10 w-10 rounded-lg object-cover border-2 border-gray-200 dark:border-neutral-700 flex-shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-lg border-2 border-dashed border-gray-200 dark:border-neutral-700 flex items-center justify-center flex-shrink-0">
                <ImageIcon className="w-4 h-4 text-gray-300" />
              </div>
            )}
          </div>
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
                <form onSubmit={handleWebsiteSubmit} className="space-y-5 max-w-xl">
                  <div className="space-y-1.5">
                    <label className={labelCls}>Operating Currency</label>
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
                        className="h-10 px-4 rounded-xl border-2 border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900 disabled:opacity-60"
                      >
                        {currencySaving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  </div>

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
                      rows={3}
                      value={websiteSettings?.description || ""}
                      onChange={onWebsiteChange("description")}
                      placeholder="Tell customers about your restaurant..."
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none transition-all"
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={`${labelCls} flex items-center gap-1.5`}>
                        <ImageIcon className="w-3.5 h-3.5" />
                        Logo
                      </label>
                      <MediaToggle
                        tab={websiteLogoTab}
                        setTab={setWebsiteLogoTab}
                        linkValue={websiteSettings?.logoUrl || ""}
                        onLink={onWebsiteChange("logoUrl")}
                        onUpload={handleWebsiteLogoUpload}
                        uploading={uploadingWebsiteLogo}
                        inputRef={websiteLogoInputRef}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className={`${labelCls} flex items-center gap-1.5`}>
                        <ImageIcon className="w-3.5 h-3.5" />
                        Banner
                      </label>
                      <MediaToggle
                        tab={websiteBannerTab}
                        setTab={setWebsiteBannerTab}
                        linkValue={websiteSettings?.bannerUrl || ""}
                        onLink={onWebsiteChange("bannerUrl")}
                        onUpload={handleWebsiteBannerUpload}
                        uploading={uploadingWebsiteBanner}
                        inputRef={websiteBannerInputRef}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={`${labelCls} flex items-center gap-1.5`}>
                        <Phone className="w-3.5 h-3.5" />
                        Contact Phone
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
                        <Mail className="w-3.5 h-3.5" />
                        Contact Email
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

                  <div className="space-y-1.5">
                    <label className={`${labelCls} flex items-center gap-1.5`}>
                      {websiteSettings?.isPublic ? (
                        <Eye className="w-3.5 h-3.5" />
                      ) : (
                        <EyeOff className="w-3.5 h-3.5" />
                      )}
                      Website Visibility
                    </label>
                    <select
                      value={websiteSettings?.isPublic ? "yes" : "no"}
                      onChange={(e) =>
                        setWebsiteSettings((p) => ({
                          ...p,
                          isPublic: e.target.value === "yes",
                        }))
                      }
                      className={inp + " font-semibold"}
                    >
                      <option value="yes">✓ Visible to Public</option>
                      <option value="no">✗ Hidden (Website Offline)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={websiteSaving}
                    className="inline-flex items-center gap-2 h-10 px-6 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                  >
                    {websiteSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save Branding"
                    )}
                  </button>
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
                    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40">
                      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 p-6 space-y-4 mx-4 max-h-[90vh] flex flex-col">
                        <div className="flex items-center justify-between flex-shrink-0">
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-primary" />
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                              Delivery Zones — {deliveryZonesBranch.name}
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={closeDeliveryZonesModal}
                            className="h-7 w-7 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-neutral-900"
                          >
                            <X className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-neutral-400 flex-shrink-0">
                          Customers and staff select from these named areas. Each zone has a flat delivery fee.
                        </p>

                        <form onSubmit={handleDeliveryZonesSave} className="flex flex-col gap-4 overflow-hidden flex-1 min-h-0">
                          <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                            {deliveryZonesEditList.length === 0 ? (
                              <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-700 p-4 text-center">
                                <p className="text-sm text-gray-600 dark:text-neutral-300 font-medium">
                                  No delivery zones configured.
                                </p>
                                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-1">
                                  Add areas like &quot;Bahria Phase 4&quot;, &quot;DHA Phase 2&quot;, etc. with flat fees.
                                </p>
                              </div>
                            ) : (
                              deliveryZonesEditList.map((z, idx) => (
                                <div
                                  key={z._id || z.id || idx}
                                  className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)_auto] gap-3 items-end"
                                >
                                  <div className="space-y-1.5">
                                    {idx === 0 && <label className={labelCls}>Area name</label>}
                                    <input
                                      type="text"
                                      value={z.name || ""}
                                      onChange={(e) => updateDeliveryZone(idx, "name", e.target.value)}
                                      placeholder="e.g. Bahria Phase 7"
                                      className={inp}
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    {idx === 0 && <label className={labelCls}>Fee (Rs)</label>}
                                    <input
                                      type="number"
                                      min={0}
                                      step={1}
                                      value={z.fee ?? ""}
                                      onChange={(e) =>
                                        updateDeliveryZone(idx, "fee", Number.parseFloat(e.target.value) || 0)
                                      }
                                      className={inp}
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => removeDeliveryZone(idx)}
                                    className="h-10 w-10 inline-flex items-center justify-center rounded-xl border border-gray-200 dark:border-neutral-700 text-gray-500 hover:text-red-500 hover:border-red-200 flex-shrink-0"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              ))
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-3 flex-shrink-0 pt-1">
                            <button
                              type="button"
                              onClick={addDeliveryZone}
                              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl border border-dashed border-gray-300 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add zone
                            </button>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={closeDeliveryZonesModal}
                                className="h-9 px-4 rounded-xl border border-gray-200 dark:border-neutral-700 text-xs font-semibold text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-900"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                disabled={deliveryZonesSaving}
                                className="inline-flex items-center gap-2 h-9 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
                              >
                                {deliveryZonesSaving ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  "Save Zones"
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
