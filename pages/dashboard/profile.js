import { useEffect, useState, useRef } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
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
  Trash2,
  Loader2,
} from "lucide-react";

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
  const [loading, setLoading] = useState(true);

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
        setInfoMsg({ type: "error", text: err.message || "Failed to load profile" });
      } finally {
        setLoading(false);
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

  if (loading) {
    return (
      <AdminLayout title="Profile">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Profile">
      <div className="grid gap-5 lg:grid-cols-3">

        {/* ══════ Left Column: Avatar & Quick Info ══════ */}
        <div className="lg:col-span-1">
          <Card>
            <div className="flex flex-col items-center text-center">
              {/* Avatar */}
              <div className="relative group">
                {profile?.profileImageUrl ? (
                  <img
                    src={profile.profileImageUrl}
                    alt={profile.name}
                    className="w-28 h-28 rounded-full object-cover border-4 border-secondary shadow-lg"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-bg-secondary dark:bg-neutral-800 border-4 border-secondary flex items-center justify-center shadow-lg">
                    <User className="w-12 h-12 text-primary/40 dark:text-neutral-500" />
                  </div>
                )}
                {/* Overlay button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-colors cursor-pointer"
                >
                  {avatarUploading ? (
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  ) : (
                    <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
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
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  {avatarUploading ? "Uploading..." : "Change Photo"}
                </button>
                {profile?.profileImageUrl && (
                  <>
                    <span className="text-gray-300 dark:text-neutral-700">|</span>
                    <button
                      type="button"
                      onClick={handleRemoveAvatar}
                      disabled={avatarUploading}
                      className="text-[11px] font-medium text-red-500 hover:text-red-600 transition-colors"
                    >
                      Remove
                    </button>
                  </>
                )}
              </div>

              {avatarMsg.text && (
                <p className={`mt-2 text-[11px] ${avatarMsg.type === "error" ? "text-red-500" : "text-green-600 dark:text-green-400"}`}>
                  {avatarMsg.text}
                </p>
              )}

              {/* Name & Role */}
              <h3 className="mt-4 text-base font-bold text-gray-900 dark:text-white">{profile?.name}</h3>
              <span className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 dark:bg-primary/20 text-[11px] font-semibold text-primary dark:text-secondary">
                <Shield className="w-3 h-3" />
                {getRoleLabel(profile?.role)}
              </span>

              {/* Quick info */}
              <div className="w-full mt-5 pt-4 border-t border-gray-200 dark:border-neutral-800 space-y-3 text-left">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Mail className="w-3.5 h-3.5 text-primary dark:text-secondary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider font-semibold">Email</p>
                    <p className="text-xs text-gray-800 dark:text-neutral-300 truncate">{profile?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-primary dark:text-secondary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-500 dark:text-neutral-500 uppercase tracking-wider font-semibold">Joined</p>
                    <p className="text-xs text-gray-800 dark:text-neutral-300">
                      {profile?.createdAt
                        ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
                        : "—"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>

        {/* ══════ Right Column: Edit Forms ══════ */}
        <div className="lg:col-span-2 space-y-5">

          {/* Personal Information */}
          <Card title="Personal Information" description="Update your name and email address.">
            {infoMsg.text && (
              <div className={`mb-4 rounded-lg border px-3 py-2 text-[11px] ${
                infoMsg.type === "error"
                  ? "border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 text-red-700 dark:text-red-400"
                  : "border-green-300 bg-green-50 dark:bg-green-500/10 dark:border-green-500/30 text-green-700 dark:text-green-400"
              }`}>
                {infoMsg.text}
              </div>
            )}
            <form onSubmit={handleInfoSave} className="space-y-4" autoComplete="off">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Full Name</label>
                  <input
                    type="text"
                    autoComplete="off"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Your name"
                    className="w-full px-3 py-2 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60 transition-shadow"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Email Address</label>
                  <input
                    type="email"
                    autoComplete="off"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-3 py-2 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60 transition-shadow"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" className="gap-1.5" disabled={infoSaving}>
                  {infoSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>

          {/* Change Password */}
          <Card title="Change Password" description="Keep your account secure with a strong password.">
            {pwMsg.text && (
              <div className={`mb-4 rounded-lg border px-3 py-2 text-[11px] ${
                pwMsg.type === "error"
                  ? "border-red-300 bg-red-50 dark:bg-red-500/10 dark:border-red-500/30 text-red-700 dark:text-red-400"
                  : "border-green-300 bg-green-50 dark:bg-green-500/10 dark:border-green-500/30 text-green-700 dark:text-green-400"
              }`}>
                {pwMsg.text}
              </div>
            )}
            <form onSubmit={handlePasswordChange} className="space-y-4" autoComplete="off">
              <div className="space-y-1.5">
                <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full px-3 py-2 pr-10 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60 transition-shadow"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
                  >
                    {showCurrent ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">New Password</label>
                  <div className="relative">
                    <input
                      type={showNew ? "text" : "password"}
                      autoComplete="new-password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Min 6 characters"
                      className="w-full px-3 py-2 pr-10 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60 transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew(!showNew)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
                    >
                      {showNew ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-gray-700 dark:text-neutral-300 text-[11px] font-medium">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full px-3 py-2 pr-10 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-xs text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60 transition-shadow"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
                    >
                      {showConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" className="gap-1.5" disabled={pwSaving}>
                  {pwSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
                  Update Password
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}
