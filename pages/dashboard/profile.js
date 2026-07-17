import { useEffect, useState, useRef } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getProfile,
  updateProfile,
  changePassword,
  uploadAvatar,
  removeAvatar,
  getStoredAuth,
  setStoredAuth,
  clearStoredAuth,
} from "../../lib/apiClient";
import {
  User,
  Mail,
  Shield,
  Calendar,
  Camera,
  Save,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  LogOut,
} from "lucide-react";
import toast from "react-hot-toast";
import WaiterProfileView from "../../components/order-taker/WaiterProfileView";

const ROLE_LABELS = {
  super_admin: "Super Admin",
  restaurant_admin: "Owner",
  admin: "Admin",
  product_manager: "Product Manager",
  cashier: "Cashier",
  manager: "Manager",
  kitchen_staff: "Kitchen Staff",
  order_taker: "Waiter",
  delivery_rider: "Rider",
};

function getRoleLabel(role) {
  return ROLE_LABELS[role] || role || "Staff";
}

function getInitials(name) {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/);
  if (parts.length > 1) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const inputCls =
  "w-full h-11 px-3.5 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-shadow";

const labelCls =
  "block text-xs font-semibold text-gray-500 dark:text-neutral-400 mb-1.5";

function AlertBanner({ type, text }) {
  if (!text) return null;
  const err = type === "error";
  return (
    <div
      className={`mb-4 rounded-xl px-3.5 py-2.5 text-xs font-semibold ${
        err
          ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400"
      }`}
    >
      {text}
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [isWaiter, setIsWaiter] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMsg, setInfoMsg] = useState({ type: "", text: "" });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: "", text: "" });

  const fileInputRef = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState({ type: "", text: "" });
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const auth = getStoredAuth();
    const role = auth?.user?.role;
    setIsWaiter(role === "order_taker" || role === "delivery_rider");
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const data = await getProfile();
        setProfile(data);
        setName(data.name || "");
        setEmail(data.email || "");
      } catch (err) {
        toast.error(err.message || "Failed to load profile");
      } finally {
        setPageLoading(false);
      }
    })();
  }, []);

  function syncLocalStorage(updates) {
    const auth = getStoredAuth();
    if (auth?.user) {
      setStoredAuth({ ...auth, user: { ...auth.user, ...updates } });
    }
  }

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* still clear local session */
    }
    clearStoredAuth();
    window.location.href = "/login";
  }

  async function handleInfoSave(e) {
    e.preventDefault();
    if (!name.trim()) {
      setInfoMsg({ type: "error", text: "Name is required" });
      return;
    }
    if (!email.trim()) {
      setInfoMsg({ type: "error", text: "Email is required" });
      return;
    }
    setInfoMsg({ type: "", text: "" });
    setInfoSaving(true);
    try {
      const updated = await updateProfile({
        name: name.trim(),
        email: email.trim(),
      });
      setProfile(updated);
      setName(updated.name);
      setEmail(updated.email);
      syncLocalStorage({ name: updated.name, email: updated.email });
      setInfoMsg({ type: "success", text: "Profile updated successfully" });
    } catch (err) {
      setInfoMsg({
        type: "error",
        text: err.message || "Failed to update profile",
      });
    } finally {
      setInfoSaving(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (!currentPassword) {
      setPwMsg({ type: "error", text: "Current password is required" });
      return;
    }
    if (!newPassword) {
      setPwMsg({ type: "error", text: "New password is required" });
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg({
        type: "error",
        text: "New password must be at least 6 characters",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: "error", text: "Passwords do not match" });
      return;
    }
    setPwMsg({ type: "", text: "" });
    setPwSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwMsg({ type: "success", text: "Password changed successfully" });
    } catch (err) {
      setPwMsg({
        type: "error",
        text: err.message || "Failed to change password",
      });
    } finally {
      setPwSaving(false);
    }
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarMsg({ type: "", text: "" });
    setAvatarUploading(true);
    try {
      const data = await uploadAvatar(file);
      setProfile((prev) => ({ ...prev, profileImageUrl: data.profileImageUrl }));
      syncLocalStorage({ profileImageUrl: data.profileImageUrl });
      setAvatarMsg({ type: "success", text: "Photo uploaded" });
    } catch (err) {
      setAvatarMsg({ type: "error", text: err.message || "Upload failed" });
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setAvatarMsg({ type: "", text: "" });
    setAvatarUploading(true);
    try {
      await removeAvatar();
      setProfile((prev) => ({ ...prev, profileImageUrl: null }));
      syncLocalStorage({ profileImageUrl: null });
      setAvatarMsg({ type: "success", text: "Photo removed" });
    } catch (err) {
      setAvatarMsg({
        type: "error",
        text: err.message || "Failed to remove photo",
      });
    } finally {
      setAvatarUploading(false);
    }
  }

  if (isWaiter) {
    const role = getStoredAuth()?.user?.role;
    return (
      <WaiterProfileView
        backHref={role === "delivery_rider" ? "/rider" : "/order-taker"}
        roleLabel={role === "delivery_rider" ? "Rider" : "Waiter"}
      />
    );
  }

  const joined = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";

  return (
    <AdminLayout title="Profile">
      {pageLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm font-semibold text-gray-500 dark:text-neutral-400">
            Loading profile…
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-4 pb-10">
          {/* Identity */}
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 md:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="relative self-center sm:self-auto shrink-0">
                {profile?.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.profileImageUrl}
                    alt={profile.name}
                    className="w-20 h-20 rounded-2xl object-cover border border-gray-200 dark:border-neutral-700"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                    <span className="text-xl font-black text-primary">
                      {getInitials(profile?.name)}
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute -bottom-1.5 -right-1.5 w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-md disabled:opacity-50"
                  aria-label="Change photo"
                >
                  {avatarUploading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>

              <div className="min-w-0 flex-1 text-center sm:text-left">
                <h2 className="text-xl font-black text-gray-900 dark:text-white truncate">
                  {profile?.name || "Your profile"}
                </h2>
                <div className="mt-2 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                    <Shield className="w-3 h-3" />
                    {getRoleLabel(profile?.role)}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate max-w-[220px]">{profile?.email}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-neutral-400">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    Joined {joined}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                    className="h-8 px-3 rounded-lg text-xs font-bold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50"
                  >
                    {avatarUploading ? "Uploading…" : "Change photo"}
                  </button>
                  {profile?.profileImageUrl ? (
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={avatarUploading}
                      className="h-8 px-3 rounded-lg text-xs font-bold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
                <AlertBanner type={avatarMsg.type} text={avatarMsg.text} />
              </div>
            </div>
          </div>

          {/* Personal details */}
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 md:p-6">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                Personal details
              </h3>
              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                Update your name and email
              </p>
            </div>
            <AlertBanner type={infoMsg.type} text={infoMsg.text} />
            <form onSubmit={handleInfoSave} className="space-y-4" autoComplete="off">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Full name</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your name"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className={inputCls}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={infoSaving}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-white text-sm font-bold shadow-sm shadow-primary/20 hover:opacity-95 disabled:opacity-50"
                >
                  {infoSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save changes
                </button>
              </div>
            </form>
          </div>

          {/* Password */}
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 md:p-6">
            <div className="mb-4">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-primary" />
                Password
              </h3>
              <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                Use a strong password you don’t reuse elsewhere
              </p>
            </div>
            <AlertBanner type={pwMsg.type} text={pwMsg.text} />
            <form
              onSubmit={handlePasswordChange}
              className="space-y-4"
              autoComplete="off"
            >
              <div>
                <label className={labelCls}>Current password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className={`${inputCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
                  >
                    {showCurrent ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>New password</label>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className={`${inputCls} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
                    >
                      {showNew ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Confirm new password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className={`${inputCls} pr-11`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
                    >
                      {showConfirm ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary text-white text-sm font-bold shadow-sm shadow-primary/20 hover:opacity-95 disabled:opacity-50"
                >
                  {pwSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Update password
                </button>
              </div>
            </form>
          </div>

          {/* Logout */}
          <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 md:px-6 md:py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                  Sign out
                </h3>
                <p className="text-xs text-gray-500 dark:text-neutral-400 mt-0.5">
                  End your session on this device
                </p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm font-bold hover:bg-red-100 dark:hover:bg-red-500/15 disabled:opacity-50"
              >
                {loggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
