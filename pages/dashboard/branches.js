import { useEffect, useState, useRef, useMemo } from "react";
import { buildBillHtml } from "../../lib/printBillReceipt";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getBranches, getDeletedBranches, createBranch, deleteBranch,
  restoreBranch, updateBranch, getRestaurantSettings,
  updateRestaurantSettings, getWebsiteSettings, updateWebsiteSettings, uploadImage,
  getPaymentAccounts, createPaymentAccount, updatePaymentAccount, deletePaymentAccount,
} from "../../lib/apiClient";
import { useBranch } from "../../contexts/BranchContext";
import {
  MapPin, Loader2, Check, Trash2, X, Pencil, Plus,
  Image as ImageIcon, Upload, Link as LinkIcon,
  Building2, FileText, Clock, RotateCcw, Settings,
  Eye, EyeOff, Phone, Mail, Palette, Wallet,
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
    () => buildBillHtml(DEMO_ORDER, {
      logoUrl: logoUrl || "",
      logoHeightPx: logoHeightPx || 100,
      footerMessage: footerMessage || "Thank you for your order!",
      mode: "bill",
    }),
    [logoUrl, logoHeightPx, footerMessage]
  );
  return (
    <div className="hidden lg:flex flex-col w-72 flex-shrink-0">
      <p className="text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-2 flex items-center gap-1.5">
        <FileText className="w-3.5 h-3.5" /> Live Bill Preview
      </p>
      <div className="rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900/50 overflow-hidden">
        <iframe srcDoc={html} title="Bill preview" style={{ width: "100%", height: "750px", border: "none", background: "#fff", display: "block" }} scrolling="yes" />
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
  { id: "branding",          label: "Branding",           icon: Palette },
  { id: "branches",          label: "Branches",            icon: Building2 },
  { id: "bill",              label: "Bill Settings",       icon: FileText },
  { id: "payment-accounts",  label: "Payment Accounts",    icon: Wallet },
];

export default function BranchesPage() {
  const { branches: contextBranches, currentBranch, setCurrentBranch, loading: contextLoading } = useBranch() || {};
  const [activeSection, setActiveSection] = useState("branding");

  // Branches
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [branchModalOpen, setBranchModalOpen] = useState(false);
  const [branchSaving, setBranchSaving] = useState(false);
  const [branchModalError, setBranchModalError] = useState("");
  const [branchForm, setBranchForm] = useState({ id: null, name: "", code: "", address: "", businessDayCutoffHour: 4 });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deletedBranches, setDeletedBranches] = useState([]);
  const [deletedLoading, setDeletedLoading] = useState(false);
  const [deletedDropdownOpen, setDeletedDropdownOpen] = useState(false);

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
      .then(d => { if (!cancelled) setBranches(d?.branches ?? (Array.isArray(d) ? d : [])); })
      .catch(err => { if (!cancelled) { toast.error(err.message || "Failed to load branches"); setBranches([]); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    setDeletedLoading(true);
    getDeletedBranches()
      .then(d => { if (!cancelled) setDeletedBranches(d?.branches ?? (Array.isArray(d) ? d : [])); })
      .catch(() => { if (!cancelled) setDeletedBranches([]); })
      .finally(() => { if (!cancelled) setDeletedLoading(false); });
    return () => { cancelled = true; };
  }, [contextBranches?.length]);

  // ── Fetch branding ──
  useEffect(() => {
    let cancelled = false;
    setWebsiteLoading(true);
    getWebsiteSettings()
      .then(d => { if (!cancelled) setWebsiteSettings(d || {}); })
      .catch(() => { if (!cancelled) setWebsiteSettings({}); })
      .finally(() => { if (!cancelled) setWebsiteLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Fetch bill settings ──
  useEffect(() => {
    let cancelled = false;
    setLogoLoading(true);
    getRestaurantSettings()
      .then(s => {
        if (cancelled) return;
        const d = s || {};
        setRestaurantSettings(d);
        setLogoHeight(d.restaurantLogoHeightPx || 100);
        setBillFooterMessage(d.billFooterMessage || "Thank you for your order!");
        setLogoDirty(false);
      })
      .catch(() => { if (!cancelled) { setRestaurantSettings({}); } })
      .finally(() => { if (!cancelled) setLogoLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // ── Fetch payment accounts ──
  useEffect(() => {
    let cancelled = false;
    setAccountsLoading(true);
    getPaymentAccounts()
      .then(d => { if (!cancelled) setPaymentAccounts(Array.isArray(d) ? d : (d?.accounts ?? [])); })
      .catch(() => { if (!cancelled) setPaymentAccounts([]); })
      .finally(() => { if (!cancelled) setAccountsLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const displayList = branches.length > 0 ? branches : (contextBranches ?? []);
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
    if (!name) { setAccountModalError("Account name is required"); return; }
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
      setPaymentAccounts(Array.isArray(updated) ? updated : (updated?.accounts ?? []));
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
      setPaymentAccounts(prev => prev.filter(a => a.id !== acc.id));
      setAccountDeleteTarget(null);
      toast.success("Account deleted", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to delete", { id: toastId });
    } finally {
      setAccountDeleteLoading(false);
    }
  }

  // ── Branch helpers ──
  function resetBranchForm() { setBranchForm({ id: null, name: "", code: "", address: "", businessDayCutoffHour: 4 }); }
  function openCreateBranch() { resetBranchForm(); setBranchModalError(""); setBranchModalOpen(true); }
  function openEditBranch(b) { setBranchForm({ id: b.id, name: b.name || "", code: b.code || "", address: b.address || "", businessDayCutoffHour: b.businessDayCutoffHour ?? 4 }); setBranchModalError(""); setBranchModalOpen(true); }

  async function handleBranchSubmit(e) {
    e.preventDefault();
    const name = branchForm.name.trim();
    if (!name) { setBranchModalError("Branch name is required"); return; }
    setBranchSaving(true); setBranchModalError("");
    const isEdit = !!branchForm.id;
    const toastId = toast.loading(isEdit ? "Saving changes..." : "Creating branch...");
    try {
      const payload = { name, code: branchForm.code.trim() || undefined, address: branchForm.address.trim() || undefined, businessDayCutoffHour: branchForm.businessDayCutoffHour ?? 4 };
      let created = null;
      if (isEdit) { await updateBranch(branchForm.id, payload); }
      else { const c = await createBranch(payload); created = c?.branch || c; }
      const data = await getBranches();
      const list = data?.branches ?? (Array.isArray(data) ? data : []);
      setBranches(list);
      if (!isEdit) {
        if (created?.id) setCurrentBranch(created);
        toast.success(`Branch "${created?.name || name}" created!`, { id: toastId });
      } else {
        if (currentBranch?.id) { const u = list.find(b => b.id === currentBranch.id); if (u) setCurrentBranch(u); }
        toast.success(`Branch "${name}" updated!`, { id: toastId });
      }
      resetBranchForm(); setBranchModalOpen(false);
    } catch (err) { setBranchModalError(err.message || "Failed to save branch"); toast.error(err.message || "Failed to save branch", { id: toastId }); }
    finally { setBranchSaving(false); }
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
    } catch (err) { toast.error(err.message || "Failed to save branding", { id: toastId }); }
    finally { setWebsiteSaving(false); }
  }
  const onWebsiteChange = f => e => setWebsiteSettings(p => ({ ...p, [f]: e.target.value }));

  async function handleWebsiteLogoUpload(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingWebsiteLogo(true);
    try { const { url } = await uploadImage(file); setWebsiteSettings(p => ({ ...(p || {}), logoUrl: url })); }
    catch (err) { toast.error(err.message || "Upload failed"); }
    finally { setUploadingWebsiteLogo(false); if (websiteLogoInputRef.current) websiteLogoInputRef.current.value = ""; }
  }
  async function handleWebsiteBannerUpload(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploadingWebsiteBanner(true);
    try { const { url } = await uploadImage(file); setWebsiteSettings(p => ({ ...(p || {}), bannerUrl: url })); }
    catch (err) { toast.error(err.message || "Upload failed"); }
    finally { setUploadingWebsiteBanner(false); if (websiteBannerInputRef.current) websiteBannerInputRef.current.value = ""; }
  }

  // ── Bill settings helpers ──
  async function handleLogoSave() {
    if (!restaurantSettings) return;
    setLogoSaving(true);
    const toastId = toast.loading("Saving bill settings...");
    try {
      const updated = await updateRestaurantSettings({ ...restaurantSettings, restaurantLogoUrl, restaurantLogoHeightPx: logoHeight, billFooterMessage });
      setRestaurantSettings(updated);
      setLogoHeight(updated?.restaurantLogoHeightPx || logoHeight);
      setBillFooterMessage(updated?.billFooterMessage || "Thank you for your order!");
      setLogoDirty(false);
      toast.success("Bill settings saved!", { id: toastId });
    } catch (err) { toast.error(err.message || "Failed to save settings", { id: toastId }); }
    finally { setLogoSaving(false); }
  }
  async function handleLogoUploadChange(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setLogoUploading(true);
    try { const { url } = await uploadImage(file); setRestaurantSettings(p => ({ ...(p || {}), restaurantLogoUrl: url })); setLogoDirty(true); }
    catch (err) { toast.error(err.message || "Upload failed"); }
    finally { setLogoUploading(false); if (logoInputRef.current) logoInputRef.current.value = ""; }
  }

  // shared input class
  const inp = "w-full h-10 px-4 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all";

  function MediaToggle({ tab, setTab, onLink, linkValue, onUpload, uploading, inputRef }) {
    return (
      <div className="space-y-2">
        <div className="inline-flex rounded-xl border-2 border-gray-200 dark:border-neutral-700 overflow-hidden">
          {[["link", LinkIcon, "URL"], ["upload", Upload, "Upload"]].map(([t, Icon, label]) => (
            <button key={t} type="button" onClick={() => setTab(t)}
              className={`inline-flex items-center gap-1.5 px-3 h-8 text-xs font-semibold transition-colors ${t !== "link" ? "border-l-2 border-gray-200 dark:border-neutral-700" : ""} ${tab === t ? "bg-gradient-to-r from-primary to-secondary text-white" : "bg-white dark:bg-neutral-950 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900"}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
        {tab === "link" ? (
          <div className="flex gap-2 items-center">
            <input type="text" value={linkValue} onChange={onLink} placeholder="https://..." className={inp} />
            {linkValue
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={linkValue} alt="" className="h-10 w-10 rounded-lg object-cover border-2 border-gray-200 dark:border-neutral-700 flex-shrink-0" />
              : <div className="h-10 w-10 rounded-lg border-2 border-dashed border-gray-200 dark:border-neutral-700 flex items-center justify-center flex-shrink-0"><ImageIcon className="w-4 h-4 text-gray-300" /></div>
            }
          </div>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-20 rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:border-primary/50 cursor-pointer transition-colors">
            {uploading
              ? <><Loader2 className="w-5 h-5 text-primary animate-spin" /><span className="text-xs text-primary mt-1">Uploading...</span></>
              : <><Upload className="w-5 h-5 text-gray-400" /><span className="text-xs text-gray-500 mt-1">Click to browse</span></>
            }
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
          </label>
        )}
      </div>
    );
  }

  function scrollTo(id) {
    setActiveSection(id);
    document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <AdminLayout title="Business Settings">
      <div className="flex gap-6 items-start">

        {/* ── Left anchor navigation ── */}
        <div className="w-48 flex-shrink-0 sticky top-4 space-y-1">

          {SECTIONS.map(({ id, label, icon: Icon }, index) => (
            <button
              key={id}
              type="button"
              onClick={() => scrollTo(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all text-left group relative ${
                activeSection === id
                  ? "bg-white dark:bg-neutral-950 text-gray-900 dark:text-white shadow-sm border-2 border-gray-200 dark:border-neutral-800"
                  : "text-gray-500 dark:text-neutral-400 hover:bg-white/70 dark:hover:bg-neutral-950/70 hover:text-gray-800 dark:hover:text-neutral-200"
              }`}
            >
              {activeSection === id && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full bg-gradient-to-b from-orange-500 to-orange-600" />
              )}
              <div className={`h-8 w-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                activeSection === id
                  ? "bg-gradient-to-br from-orange-500 to-orange-600 shadow-md shadow-orange-500/30"
                  : "bg-gray-100 dark:bg-neutral-800 group-hover:bg-gray-200 dark:group-hover:bg-neutral-700"
              }`}>
                <Icon className={`w-4 h-4 ${activeSection === id ? "text-white" : "text-gray-500 dark:text-neutral-400"}`} />
              </div>
              <span className="leading-none">{label}</span>
            </button>
          ))}
        </div>

        {/* ── Right content area — all sections visible ── */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* ════ BRANDING ════ */}
          <div id="section-branding">
            <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-5 flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md flex-shrink-0">
                  <Palette className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Branding</h3>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">Configure your restaurant's public appearance</p>
                </div>
              </div>

              {websiteLoading ? (
                <div className="flex items-center justify-center gap-2 py-12">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-gray-500 dark:text-neutral-400">Loading branding settings...</span>
                </div>
              ) : (
                <form onSubmit={handleWebsiteSubmit} className="p-6 space-y-5 max-w-xl">

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">Restaurant Name</label>
                    <input type="text" value={websiteSettings?.name || ""} onChange={onWebsiteChange("name")} placeholder="Your Restaurant Name" className={inp} />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">Description</label>
                    <textarea rows={3} value={websiteSettings?.description || ""} onChange={onWebsiteChange("description")} placeholder="Tell customers about your restaurant..."
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none transition-all" />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" />Logo</label>
                      <MediaToggle tab={websiteLogoTab} setTab={setWebsiteLogoTab} linkValue={websiteSettings?.logoUrl || ""} onLink={onWebsiteChange("logoUrl")} onUpload={handleWebsiteLogoUpload} uploading={uploadingWebsiteLogo} inputRef={websiteLogoInputRef} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300 flex items-center gap-1.5"><ImageIcon className="w-3.5 h-3.5" />Banner</label>
                      <MediaToggle tab={websiteBannerTab} setTab={setWebsiteBannerTab} linkValue={websiteSettings?.bannerUrl || ""} onLink={onWebsiteChange("bannerUrl")} onUpload={handleWebsiteBannerUpload} uploading={uploadingWebsiteBanner} inputRef={websiteBannerInputRef} />
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />Contact Phone</label>
                      <input type="text" value={websiteSettings?.contactPhone || ""} onChange={onWebsiteChange("contactPhone")} placeholder="03XX-XXXXXXX" className={inp} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" />Contact Email</label>
                      <input type="email" value={websiteSettings?.contactEmail || ""} onChange={onWebsiteChange("contactEmail")} placeholder="contact@restaurant.com" className={inp} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300 flex items-center gap-1.5">
                      {websiteSettings?.isPublic ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      Website Visibility
                    </label>
                    <select value={websiteSettings?.isPublic ? "yes" : "no"} onChange={e => setWebsiteSettings(p => ({ ...p, isPublic: e.target.value === "yes" }))}
                      className={inp + " font-semibold"}>
                      <option value="yes">✓ Visible to Public</option>
                      <option value="no">✗ Hidden (Website Offline)</option>
                    </select>
                  </div>

                  <button type="submit" disabled={websiteSaving}
                    className="inline-flex items-center gap-2 h-10 px-6 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
                    {websiteSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : "Save Branding"}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* ════ BRANCHES ════ */}
          <div id="section-branches">
            <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md flex-shrink-0">
                    <Building2 className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Branches</h3>
                    <p className="text-xs text-gray-500 dark:text-neutral-400">Manage your restaurant locations</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {deletedBranches.length > 0 && (
                    <div className="relative">
                      <button type="button" onClick={() => setDeletedDropdownOpen(p => !p)}
                        className="inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border-2 border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors">
                        <RotateCcw className="w-3.5 h-3.5" />Restore
                        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-600 text-[10px] text-white font-bold">{deletedBranches.length}</span>
                      </button>
                      {deletedDropdownOpen && (
                        <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white dark:bg-neutral-950 border-2 border-amber-200 dark:border-amber-700/50 shadow-xl z-20">
                          <div className="px-4 py-2.5 border-b border-amber-100 dark:border-amber-800/50 flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-800 dark:text-amber-200">Recently deleted (48h)</span>
                            {deletedLoading && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />}
                          </div>
                          <div className="max-h-64 overflow-y-auto py-1">
                            {deletedBranches.map(branch => (
                              <div key={branch.id} className="px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-amber-50/60 dark:hover:bg-amber-900/20">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{branch.name}</p>
                                  {branch.code && <p className="text-[10px] text-gray-500 font-mono">{branch.code}</p>}
                                </div>
                                <button type="button" className="h-7 px-3 rounded-lg bg-emerald-600 text-[11px] text-white font-semibold hover:bg-emerald-700 flex-shrink-0 transition-colors"
                                  onClick={async () => {
                                    const toastId = toast.loading(`Restoring "${branch.name}"...`);
                                    try {
                                      await restoreBranch(branch.id);
                                      const [a, d] = await Promise.all([getBranches(), getDeletedBranches()]);
                                      setBranches(a?.branches ?? (Array.isArray(a) ? a : []));
                                      setDeletedBranches(d?.branches ?? (Array.isArray(d) ? d : []));
                                      setDeletedDropdownOpen(false);
                                      toast.success(`"${branch.name}" restored!`, { id: toastId });
                                    } catch (err) { toast.error(err.message || "Failed to restore", { id: toastId }); }
                                  }}>Restore</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <button type="button" onClick={openCreateBranch}
                    className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all">
                    <Plus className="w-3.5 h-3.5" /> Add Branch
                  </button>
                </div>
              </div>

              {isLoading && displayList.length === 0 ? (
                <div className="flex items-center justify-center gap-3 py-20">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm text-gray-500 dark:text-neutral-400">Loading branches…</span>
                </div>
              ) : displayList.length === 0 ? (
                <div className="py-20 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mx-auto mb-4">
                    <MapPin className="w-8 h-8 text-gray-300 dark:text-neutral-700" />
                  </div>
                  <p className="text-sm font-semibold text-gray-600 dark:text-neutral-400">No branches yet</p>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1 max-w-xs mx-auto">Add your first branch to manage multiple locations</p>
                  <button type="button" onClick={openCreateBranch}
                    className="mt-4 inline-flex items-center gap-2 h-9 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-xs font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all">
                    <Plus className="w-3.5 h-3.5" /> Add First Branch
                  </button>
                </div>
              ) : (
                <div className="p-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 relative">
                  {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 dark:bg-neutral-950/60 backdrop-blur-sm rounded-b-2xl">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 shadow-lg">
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        <span className="text-xs font-semibold text-gray-700 dark:text-neutral-300">Refreshing...</span>
                      </div>
                    </div>
                  )}
                  {displayList.map(branch => {
                    const isActive = currentBranch?.id === branch.id;
                    return (
                      <div key={branch.id} className={`relative rounded-xl border-2 p-4 transition-all ${isActive ? "border-primary bg-primary/5 dark:bg-primary/10 shadow-md shadow-primary/10" : "border-gray-200 dark:border-neutral-700 hover:border-primary/40 hover:shadow-md"}`}>
                        {isActive && (
                          <div className="absolute top-3 right-3 h-6 w-6 rounded-full bg-primary flex items-center justify-center shadow-sm">
                            <Check className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isActive ? "bg-gradient-to-br from-orange-500 to-orange-600 shadow-md shadow-orange-500/30" : "bg-gray-100 dark:bg-neutral-800"}`}>
                            <MapPin className={`w-5 h-5 ${isActive ? "text-white" : "text-gray-500 dark:text-neutral-400"}`} />
                          </div>
                          <div className="min-w-0 flex-1 pr-6">
                            <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">{branch.name}</h4>
                            {branch.code && <p className="text-[11px] text-gray-400 dark:text-neutral-500 font-mono mt-0.5">{branch.code}</p>}
                          </div>
                        </div>
                        {branch.address && (
                          <p className="text-xs text-gray-500 dark:text-neutral-400 mb-2 line-clamp-2 flex items-start gap-1">
                            <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-gray-400" />{branch.address}
                          </p>
                        )}
                        <div className="flex items-center gap-1 mb-3">
                          <Clock className="w-3 h-3 text-gray-400" />
                          <span className="text-[11px] text-gray-400 dark:text-neutral-500">Resets at {formatCutoff(branch.businessDayCutoffHour ?? 4)}</span>
                        </div>
                        <div className="flex gap-2 pt-1 border-t border-gray-100 dark:border-neutral-800">
                          {!isActive && (
                            <button type="button" onClick={() => setCurrentBranch(branch)}
                              className="flex-1 h-8 rounded-lg bg-primary/10 dark:bg-primary/20 text-primary text-xs font-semibold hover:bg-primary/20 dark:hover:bg-primary/30 transition-colors">
                              Switch
                            </button>
                          )}
                          <button type="button" onClick={() => openEditBranch(branch)} className="h-8 px-3 rounded-lg border-2 border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors" title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => { setDeleteTarget(branch); setDeleteConfirmName(""); }} className="h-8 px-3 rounded-lg border-2 border-red-200 dark:border-red-500/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors" title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {displayList.length > 0 && (
                <div className="mx-5 mb-5 bg-blue-50 dark:bg-blue-500/5 border-2 border-blue-100 dark:border-blue-500/20 rounded-xl px-4 py-3">
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    <span className="font-semibold">Tip:</span> Selecting a branch scopes dashboard data (orders, inventory, POS) to that specific location via the{" "}
                    <code className="bg-blue-100 dark:bg-neutral-800 px-1.5 py-0.5 rounded font-mono">x-branch-id</code> header.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ════ BILL SETTINGS ════ */}
          <div id="section-bill">
            <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-md flex-shrink-0">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Bill Settings</h3>
                    <p className="text-xs text-gray-500 dark:text-neutral-400">Logo and footer shown on every printed bill</p>
                  </div>
                </div>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-neutral-400 bg-gray-100 dark:bg-neutral-800 px-2.5 py-1 rounded-lg">
                  <FileText className="w-3 h-3" /> Live preview on right
                </span>
              </div>

              <div className="p-6 flex gap-8 items-start">
                <div className="flex-1 space-y-5 min-w-0">

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">Logo Source</label>
                    <div className="inline-flex rounded-xl border-2 border-gray-200 dark:border-neutral-700 overflow-hidden">
                      {[["link", LinkIcon, "Paste URL"], ["upload", Upload, "Upload"]].map(([t, Icon, label]) => (
                        <button key={t} type="button" onClick={() => setLogoTab(t)}
                          className={`inline-flex items-center gap-1.5 px-4 h-9 text-xs font-semibold transition-colors ${t !== "link" ? "border-l-2 border-gray-200 dark:border-neutral-700" : ""} ${logoTab === t ? "bg-gradient-to-r from-primary to-secondary text-white" : "bg-white dark:bg-neutral-950 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900"}`}>
                          <Icon className="w-3.5 h-3.5" />{label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {logoTab === "link" ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-gray-600 dark:text-neutral-400">Logo URL</label>
                      <div className="flex gap-3 items-center">
                        <input type="text" value={restaurantLogoUrl} onChange={e => { setRestaurantSettings(p => ({ ...(p || {}), restaurantLogoUrl: e.target.value })); setLogoDirty(true); }} placeholder="https://your-logo.png" disabled={logoLoading} className={inp + " flex-1"} />
                        {restaurantLogoUrl
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={restaurantLogoUrl} alt="Logo" className="h-10 w-10 rounded-lg object-cover border-2 border-gray-200 dark:border-neutral-700 flex-shrink-0" />
                          : <div className="h-10 w-10 rounded-lg border-2 border-dashed border-gray-200 dark:border-neutral-700 flex items-center justify-center flex-shrink-0"><ImageIcon className="w-4 h-4 text-gray-300" /></div>
                        }
                      </div>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-28 rounded-xl border-2 border-dashed border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:border-primary/50 hover:bg-primary/5 cursor-pointer transition-colors">
                      {logoUploading ? <><Loader2 className="w-6 h-6 text-primary animate-spin" /><span className="text-xs font-semibold text-primary mt-1">Uploading...</span></>
                        : <><Upload className="w-6 h-6 text-gray-400" /><span className="text-xs font-semibold text-gray-600 dark:text-neutral-400 mt-1">Click or drag & drop</span><span className="text-[10px] text-gray-400 mt-0.5">JPG, PNG, WEBP · max 5 MB</span></>
                      }
                      <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUploadChange} disabled={logoUploading} />
                    </label>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600 dark:text-neutral-400">Logo Print Size</label>
                    <div className="flex items-center gap-3">
                      <select value={logoHeight} onChange={e => { const v = parseInt(e.target.value, 10) || 100; setLogoHeight(v); setRestaurantSettings(p => ({ ...(p || {}), restaurantLogoHeightPx: v })); setLogoDirty(true); }} disabled={logoLoading}
                        className="h-10 px-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all">
                        <option value={60}>Small (60px)</option>
                        <option value={80}>Medium (80px)</option>
                        <option value={100}>Large (100px)</option>
                        <option value={120}>XL (120px)</option>
                        <option value={140}>2XL (140px)</option>
                        <option value={160}>3XL (160px)</option>
                        <option value={180}>4XL (180px)</option>
                      </select>
                      <span className="text-xs text-gray-400 dark:text-neutral-500">Height on printed bill</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-gray-600 dark:text-neutral-400">Bill Footer Message</label>
                    <input type="text" value={billFooterMessage} onChange={e => { setBillFooterMessage(e.target.value); setLogoDirty(true); }} placeholder="Thank you for your order!" maxLength={120} disabled={logoLoading} className={inp} />
                    <p className="text-[11px] text-gray-400 dark:text-neutral-500">Shown at the bottom of every printed bill · max 120 characters</p>
                  </div>

                  <button type="button" onClick={handleLogoSave} disabled={logoSaving || logoLoading || !logoDirty}
                    className="inline-flex items-center gap-2 h-10 px-6 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none">
                    {logoSaving ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> : "Save Bill Settings"}
                  </button>
                </div>

                <BillPreviewPane logoUrl={restaurantLogoUrl} logoHeightPx={logoHeight} footerMessage={billFooterMessage} />
              </div>
            </div>
          </div>

          {/* ════ PAYMENT ACCOUNTS ════ */}
          <div id="section-payment-accounts">
            <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-6 py-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 flex items-center justify-center shadow-md flex-shrink-0">
                    <Wallet className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900 dark:text-white">Payment Accounts</h3>
                    <p className="text-xs text-gray-500 dark:text-neutral-400">Online receiving accounts shown to cashiers at checkout</p>
                  </div>
                </div>
                <button type="button" onClick={openCreateAccount}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 text-white text-xs font-semibold hover:shadow-lg hover:shadow-violet-500/30 hover:-translate-y-0.5 transition-all">
                  <Plus className="w-3.5 h-3.5" /> Add Account
                </button>
              </div>

              <div className="px-6 pb-6">
                {accountsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-10">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <span className="text-sm text-gray-500 dark:text-neutral-400">Loading accounts...</span>
                  </div>
                ) : paymentAccounts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center mb-3">
                      <Wallet className="w-6 h-6 text-violet-400" />
                    </div>
                    <p className="text-sm font-semibold text-gray-700 dark:text-neutral-300">No payment accounts yet</p>
                    <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Add accounts like JazzCash, Easypaisa, or your bank details.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {paymentAccounts.map((acc) => (
                      <div key={acc.id} className="flex items-center justify-between px-4 py-3 rounded-xl border-2 border-gray-100 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/40 hover:border-violet-200 dark:hover:border-violet-500/20 transition-colors group">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                            <Wallet className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{acc.name}</p>
                            {acc.description && (
                              <p className="text-xs text-gray-400 dark:text-neutral-500 truncate">{acc.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                          <button type="button" onClick={() => openEditAccount(acc)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-500/10 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={() => setAccountDeleteTarget(acc)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ── Create / Edit Branch Modal ── */}
      {branchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">{branchForm.id ? "Edit Branch" : "Add New Branch"}</h2>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">Each branch can have its own POS and reports</p>
              </div>
              <button type="button" onClick={() => { resetBranchForm(); setBranchModalOpen(false); }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {branchModalError && (
              <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-2.5 text-xs text-red-700 dark:text-red-400">{branchModalError}</div>
            )}
            <form onSubmit={handleBranchSubmit} className="p-6 space-y-4">
              {[
                { label: "Branch Name", key: "name", placeholder: "e.g. DHA Phase 5", required: true },
                { label: "Branch Code", key: "code", placeholder: "e.g. dha5", optional: true },
                { label: "Address", key: "address", placeholder: "Street, area, city", optional: true },
              ].map(field => (
                <div key={field.key} className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">
                    {field.label} {field.optional && <span className="text-gray-400 font-normal">(optional)</span>}
                  </label>
                  <input type="text" value={branchForm[field.key]} onChange={e => setBranchForm(p => ({ ...p, [field.key]: e.target.value }))} placeholder={field.placeholder} className={inp} />
                </div>
              ))}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">Day resets at</label>
                <select value={branchForm.businessDayCutoffHour} onChange={e => setBranchForm(p => ({ ...p, businessDayCutoffHour: parseInt(e.target.value, 10) }))} className={inp}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>
                      {h === 0 ? "12:00 AM (midnight)" : h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM (noon)" : `${h - 12}:00 PM`}
                      {h === 4 ? " — recommended" : ""}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-gray-400 dark:text-neutral-500">A new business day begins at this time. Orders placed before it still count toward the previous day&apos;s report.</p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { resetBranchForm(); setBranchModalOpen(false); }} disabled={branchSaving}
                  className="h-10 px-4 rounded-xl border-2 border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={branchSaving}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-semibold hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-70">
                  {branchSaving ? <><Loader2 className="w-4 h-4 animate-spin" />{branchForm.id ? "Saving..." : "Creating..."}</> : <>{branchForm.id ? "Save Changes" : "Create Branch"}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Delete Branch</h2>
              </div>
              <button type="button" onClick={() => { setDeleteTarget(null); setDeleteConfirmName(""); }} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600 dark:text-neutral-400">
                This will soft-delete <span className="font-semibold text-gray-900 dark:text-white">"{deleteTarget.name}"</span>. It can be recovered within <span className="font-semibold">48 hours</span>.
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">
                  Type <span className="font-mono text-red-600 dark:text-red-400">{deleteTarget.name}</span> to confirm
                </label>
                <input type="text" value={deleteConfirmName} onChange={e => setDeleteConfirmName(e.target.value)} placeholder={deleteTarget.name}
                  className="w-full h-10 px-4 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-red-500 focus:ring-4 focus:ring-red-500/10 transition-all" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-neutral-800">
              <button type="button" onClick={() => { setDeleteTarget(null); setDeleteConfirmName(""); }}
                className="h-10 px-4 rounded-xl border-2 border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors">
                Cancel
              </button>
              <button type="button" disabled={deleteLoading || deleteConfirmName.trim() !== (deleteTarget.name || "").trim()}
                onClick={async () => {
                  setDeleteLoading(true);
                  const toastId = toast.loading(`Deleting "${deleteTarget.name}"...`);
                  try {
                    await deleteBranch(deleteTarget.id);
                    const [d, del] = await Promise.all([getBranches(), getDeletedBranches()]);
                    setBranches(d?.branches ?? (Array.isArray(d) ? d : []));
                    setDeletedBranches(del?.branches ?? (Array.isArray(del) ? del : []));
                    setDeleteTarget(null); setDeleteConfirmName("");
                    toast.success(`"${deleteTarget.name}" deleted!`, { id: toastId });
                  } catch (err) { toast.error(err.message || "Failed to delete", { id: toastId }); }
                  finally { setDeleteLoading(false); }
                }}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" />Delete Branch</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add / Edit Payment Account Modal ── */}
      {accountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
              <div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">{accountForm.id ? "Edit Account" : "Add Payment Account"}</h2>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">This will appear as an option when recording online payments</p>
              </div>
              <button type="button" onClick={() => setAccountModalOpen(false)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            {accountModalError && (
              <div className="mx-6 mt-4 rounded-xl border border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 px-4 py-2.5 text-xs text-red-700 dark:text-red-400">{accountModalError}</div>
            )}
            <form onSubmit={handleAccountSubmit} className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">Account Name <span className="text-red-500">*</span></label>
                <input type="text" value={accountForm.name} onChange={e => setAccountForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. JazzCash – 03001234567" className={inp} autoFocus />
                <p className="text-[11px] text-gray-400 dark:text-neutral-500">Include the account number or holder name so cashiers know which account to use.</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-neutral-300">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" value={accountForm.description} onChange={e => setAccountForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="e.g. For Easypaisa transfers only" className={inp} />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAccountModalOpen(false)} disabled={accountSaving}
                  className="h-10 px-4 rounded-xl border-2 border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={accountSaving}
                  className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-gradient-to-r from-violet-500 to-violet-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-violet-500/30 transition-all disabled:opacity-70">
                  {accountSaving ? <><Loader2 className="w-4 h-4 animate-spin" />{accountForm.id ? "Saving..." : "Adding..."}</> : <>{accountForm.id ? "Save Changes" : "Add Account"}</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Payment Account confirmation ── */}
      {accountDeleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                </div>
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">Delete Account</h2>
              </div>
              <button type="button" onClick={() => setAccountDeleteTarget(null)} className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-5">
              <p className="text-sm text-gray-600 dark:text-neutral-400">
                Remove <span className="font-semibold text-gray-900 dark:text-white">&ldquo;{accountDeleteTarget.name}&rdquo;</span> from your payment accounts? This won&apos;t affect past orders.
              </p>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 dark:border-neutral-800">
              <button type="button" onClick={() => setAccountDeleteTarget(null)} disabled={accountDeleteLoading}
                className="h-10 px-4 rounded-xl border-2 border-gray-200 dark:border-neutral-700 text-sm font-semibold text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={() => handleAccountDelete(accountDeleteTarget)} disabled={accountDeleteLoading}
                className="inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50">
                {accountDeleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Trash2 className="w-4 h-4" />Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
