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
} from "lucide-react";
import toast from "react-hot-toast";

const ROLE_LABELS = {
  super_admin: "Super Admin",
  restaurant_admin: "Owner",
  admin: "Admin",
  product_manager: "Product Manager",
  cashier: "Cashier",
  manager: "Manager",
  kitchen_staff: "Kitchen Staff",
};

function getRoleLabel(role) {
  return ROLE_LABELS[role] || role;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  // Edit info
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMsg, setInfoMsg] = useState({ type: "", text: "" });

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState({ type: "", text: "" });

  // Avatar
  const fileInputRef = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState({ type: "", text: "" });

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

  // Sync localStorage when profile updates
  function syncLocalStorage(updates) {
    const auth = getStoredAuth();
    if (auth?.user) {
      const updatedUser = { ...auth.user, ...updates };
      setStoredAuth({ ...auth, user: updatedUser });
    }
  }

  async function handleInfoSave(e) {
    e.preventDefault();
    if (!name.trim()) { setInfoMsg({ type: "error", text: "Name is required" }); return; }
    if (!email.trim()) { setInfoMsg({ type: "error", text: "Email is required" }); return; }
    setInfoMsg({ type: "", text: "" });
    setInfoSaving(true);
    try {
      const updated = await updateProfile({ name: name.trim(), email: email.trim() });
      setProfile(updated);
      setName(updated.name);
      setEmail(updated.email);
      syncLocalStorage({ name: updated.name, email: updated.email });
      setInfoMsg({ type: "success", text: "Profile updated successfully" });
    } catch (err) {
      setInfoMsg({ type: "error", text: err.message || "Failed to update profile" });
    } finally {
      setInfoSaving(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (!currentPassword) { setPwMsg({ type: "error", text: "Current password is required" }); return; }
    if (!newPassword) { setPwMsg({ type: "error", text: "New password is required" }); return; }
    if (newPassword.length < 6) { setPwMsg({ type: "error", text: "New password must be at least 6 characters" }); return; }
    if (newPassword !== confirmPassword) { setPwMsg({ type: "error", text: "Passwords do not match" }); return; }
    setPwMsg({ type: "", text: "" });
    setPwSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwMsg({ type: "success", text: "Password changed successfully" });
    } catch (err) {
      setPwMsg({ type: "error", text: err.message || "Failed to change password" });
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
      setProfile(prev => ({ ...prev, profileImageUrl: data.profileImageUrl }));
      syncLocalStorage({ profileImageUrl: data.profileImageUrl });
      setAvatarMsg({ type: "success", text: "Photo uploaded successfully" });
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
      setProfile(prev => ({ ...prev, profileImageUrl: null }));
      syncLocalStorage({ profileImageUrl: null });
      setAvatarMsg({ type: "success", text: "Photo removed" });
    } catch (err) {
      setAvatarMsg({ type: "error", text: err.message || "Failed to remove photo" });
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <AdminLayout title="Profile">
      {pageLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
            <User className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
              Loading profile...
            </p>
          </div>
        </div>
      ) : (
        <>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">

        {/* ══════ Left Column: Avatar & Quick Info ══════ */}
        <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all">
          <div className="flex flex-col items-center text-center">
            {/* Avatar */}
            <div className="relative group mb-5">
              {profile?.profileImageUrl ? (
                <img
                  src={profile.profileImageUrl}
                  alt={profile.name}
                  className="w-32 h-32 rounded-full object-cover border-4 border-primary shadow-2xl"
                />
              ) : (
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border-4 border-primary/30 flex items-center justify-center shadow-2xl">
                  <User className="w-16 h-16 text-primary" />
                </div>
              )}
              {/* Overlay button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/60 flex items-center justify-center transition-all cursor-pointer"
              >
                {avatarUploading ? (
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                ) : (
                  <Camera className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-lg" />
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

            {/* Upload / Remove buttons */}
            <div className="flex items-center gap-3 mb-5">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
              >
                {avatarUploading ? "Uploading..." : "Change Photo"}
              </button>
              {profile?.profileImageUrl && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarUploading}
                  className="px-4 py-2 rounded-lg text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>

            {avatarMsg.text && (
              <div className={`mb-4 px-3 py-2 rounded-lg text-sm font-medium ${
                avatarMsg.type === "error" 
                  ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400" 
                  : "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              }`}>
                {avatarMsg.text}
              </div>
            )}

            {/* Name & Role */}
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{profile?.name}</h3>
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-primary/10 to-secondary/10 border border-primary/20 text-sm font-bold text-primary dark:text-secondary">
              <Shield className="w-4 h-4" />
              {getRoleLabel(profile?.role)}
            </span>

            {/* Quick info */}
            <div className="w-full mt-6 pt-6 border-t-2 border-gray-100 dark:border-neutral-800 space-y-4">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-neutral-900">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase font-bold mb-0.5">Email</p>
                  <p className="text-sm text-gray-900 dark:text-white font-semibold truncate">{profile?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-neutral-900">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0 shadow-lg">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-xs text-gray-500 dark:text-neutral-500 uppercase font-bold mb-0.5">Joined</p>
                  <p className="text-sm text-gray-900 dark:text-white font-semibold">
                    {profile?.createdAt
                      ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                      : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ══════ Right Column: Edit Forms ══════ */}
        <div className="space-y-6">

          {/* Personal Information */}
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                <User className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Personal Information</h3>
                <p className="text-xs text-gray-500 dark:text-neutral-400">Update your name and email address</p>
              </div>
            </div>

            {infoMsg.text && (
              <div className={`mb-5 rounded-xl border-2 px-4 py-3 text-sm font-medium ${
                infoMsg.type === "error"
                  ? "border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 text-red-700 dark:text-red-400"
                  : "border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
              }`}>
                {infoMsg.text}
              </div>
            )}

            <form onSubmit={handleInfoSave} className="space-y-5" autoComplete="off">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                    <User className="w-3.5 h-3.5" />
                    Full Name
                  </label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    Email Address
                  </label>
                  <input
                    type="email"
                    autoComplete="off"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={infoSaving}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {infoSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>

          {/* Change Password */}
          <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm hover:shadow-xl transition-all">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                <Lock className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">Change Password</h3>
                <p className="text-xs text-gray-500 dark:text-neutral-400">Keep your account secure with a strong password</p>
              </div>
            </div>

            {pwMsg.text && (
              <div className={`mb-5 rounded-xl border-2 px-4 py-3 text-sm font-medium ${
                pwMsg.type === "error"
                  ? "border-red-200 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 text-red-700 dark:text-red-400"
                  : "border-emerald-200 bg-emerald-50 dark:bg-emerald-500/10 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
              }`}>
                {pwMsg.text}
              </div>
            )}

            <form onSubmit={handlePasswordChange} className="space-y-5" autoComplete="off">
              <div className="space-y-2">
                <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                  >
                    {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">New Password</label>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                    >
                      {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-gray-700 dark:text-neutral-300 text-sm font-semibold">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-4 py-3 pr-12 rounded-xl bg-gray-50 dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
                    >
                      {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                >
                  {pwSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                  Update Password
                </button>
              </div>
            </form>
          </div>
        </div>
          </div>
        </>
      )}
    </AdminLayout>
  );
}
