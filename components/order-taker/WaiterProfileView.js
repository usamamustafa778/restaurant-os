import { useEffect, useState, useRef } from "react";
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
  Camera,
  Save,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ChevronLeft,
  LogOut,
} from "lucide-react";
import toast from "react-hot-toast";
import SEO from "../SEO";

/**
 * Mobile profile screen for order_taker (waiter) and delivery_rider roles.
 */
export default function WaiterProfileView({
  backHref = "/order-taker",
  roleLabel = "Waiter",
}) {
  const [profile, setProfile] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

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

  return (
    <>
      <SEO title="My Profile - Eats Desk" noindex />
      <div className="min-h-[100dvh] bg-gray-50 dark:bg-neutral-950 text-gray-900 dark:text-white flex flex-col">
        <header className="flex-shrink-0 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-md border-b border-gray-100 dark:border-neutral-800 sticky top-0 z-20">
          <div className="flex items-center gap-2.5 px-4 h-14">
            <button
              type="button"
              onClick={() => {
                window.location.href = backHref;
              }}
              className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-neutral-900 flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Back"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-neutral-300" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="text-[15px] font-extrabold truncate leading-tight">
                My Profile
              </h1>
              <p className="text-[11px] text-gray-500 dark:text-neutral-400 truncate leading-tight">
                Account · password · logout
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4 pb-10 space-y-3 max-w-lg mx-auto w-full">
          {pageLoading ? (
            <div className="flex items-center justify-center py-20 gap-2 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
              <span className="text-sm font-semibold">Loading…</span>
            </div>
          ) : (
            <>
              <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-5">
                <div className="flex items-center gap-3.5">
                  <div className="relative shrink-0">
                    {profile?.profileImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.profileImageUrl}
                        alt={profile.name}
                        className="w-16 h-16 rounded-2xl object-cover border border-orange-200 dark:border-orange-500/30"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-orange-500/15 flex items-center justify-center border border-orange-500/25">
                        <User className="w-7 h-7 text-orange-500" />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={avatarUploading}
                      className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center shadow"
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
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-extrabold truncate">
                      {profile?.name}
                    </p>
                    <p className="text-xs font-bold text-orange-500 mt-0.5">
                      {roleLabel}
                    </p>
                    <p className="text-[11px] text-gray-500 dark:text-neutral-400 truncate mt-0.5">
                      {profile?.email}
                    </p>
                    {avatarMsg.text ? (
                      <p
                        className={`mt-1 text-xs font-medium ${
                          avatarMsg.type === "error"
                            ? "text-red-500"
                            : "text-emerald-500"
                        }`}
                      >
                        {avatarMsg.text}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
                <h2 className="text-sm font-extrabold mb-3">Personal details</h2>
                {infoMsg.text && (
                  <div
                    className={`mb-3 rounded-xl px-3 py-2 text-xs font-medium ${
                      infoMsg.type === "error"
                        ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                    }`}
                  >
                    {infoMsg.text}
                  </div>
                )}
                <form
                  onSubmit={handleInfoSave}
                  className="space-y-3"
                  autoComplete="off"
                >
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-neutral-400">
                      Full name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 dark:text-neutral-400">
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1 w-full px-3.5 py-2.5 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={infoSaving}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold disabled:opacity-50"
                  >
                    {infoSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save details
                  </button>
                </form>
              </div>

              <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-4">
                <h2 className="text-sm font-extrabold mb-3">Change password</h2>
                {pwMsg.text && (
                  <div
                    className={`mb-3 rounded-xl px-3 py-2 text-xs font-medium ${
                      pwMsg.type === "error"
                        ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                    }`}
                  >
                    {pwMsg.text}
                  </div>
                )}
                <form
                  onSubmit={handlePasswordChange}
                  className="space-y-3"
                  autoComplete="off"
                >
                  {[
                    {
                      label: "Current password",
                      value: currentPassword,
                      set: setCurrentPassword,
                      show: showCurrent,
                      setShow: setShowCurrent,
                    },
                    {
                      label: "New password",
                      value: newPassword,
                      set: setNewPassword,
                      show: showNew,
                      setShow: setShowNew,
                    },
                    {
                      label: "Confirm new password",
                      value: confirmPassword,
                      set: setConfirmPassword,
                      show: showConfirm,
                      setShow: setShowConfirm,
                    },
                  ].map((field) => (
                    <div key={field.label}>
                      <label className="text-xs font-semibold text-gray-500 dark:text-neutral-400">
                        {field.label}
                      </label>
                      <div className="relative mt-1">
                        <input
                          type={field.show ? "text" : "password"}
                          value={field.value}
                          onChange={(e) => field.set(e.target.value)}
                          className="w-full px-3.5 py-2.5 pr-10 rounded-xl bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15"
                        />
                        <button
                          type="button"
                          onClick={() => field.setShow(!field.show)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                        >
                          {field.show ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="submit"
                    disabled={pwSaving}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold disabled:opacity-50"
                  >
                    {pwSaving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    Update password
                  </button>
                </form>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                disabled={loggingOut}
                className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 text-sm font-bold disabled:opacity-50"
              >
                {loggingOut ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                Logout
              </button>

              <p className="text-center text-[10px] text-gray-400 dark:text-neutral-600 pt-1">
                Powered by{" "}
                <span className="font-semibold text-gray-500 dark:text-neutral-500">
                  EatsDesk
                </span>
              </p>
            </>
          )}
        </main>
      </div>
    </>
  );
}
