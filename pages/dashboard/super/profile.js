import { useEffect, useRef, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import {
  changePassword,
  getProfile,
  getStoredAuth,
  removeAvatar,
  setStoredAuth,
  updateProfile,
  uploadAvatar,
} from "../../../lib/apiClient";
import {
  Camera,
  Loader2,
  Lock,
  Mail,
  Phone,
  Save,
  Shield,
  User,
  Eye,
  EyeOff,
} from "lucide-react";
import toast from "react-hot-toast";
import { usePermissions } from "../../../contexts/PermissionContext";

export default function SuperProfilePage() {
  const { roleName } = usePermissions();
  const [profile, setProfile] = useState(null);
  const [pageLoading, setPageLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [infoSaving, setInfoSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);

  const fileInputRef = useRef(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await getProfile();
        setProfile(data);
        setName(data.name || "");
        setEmail(data.email || "");
        setPhone(data.phone || "");
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
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required");
      return;
    }
    setInfoSaving(true);
    try {
      const updated = await updateProfile({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
      });
      setProfile(updated);
      setName(updated.name);
      setEmail(updated.email);
      setPhone(updated.phone || "");
      syncLocalStorage({
        name: updated.name,
        email: updated.email,
      });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setInfoSaving(false);
    }
  }

  async function handlePasswordChange(e) {
    e.preventDefault();
    if (!currentPassword || !newPassword) {
      toast.error("Current and new password are required");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setPwSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password changed successfully");
    } catch (err) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setPwSaving(false);
    }
  }

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const data = await uploadAvatar(file);
      setProfile((prev) => ({
        ...prev,
        profileImageUrl: data.profileImageUrl,
      }));
      syncLocalStorage({ profileImageUrl: data.profileImageUrl });
      toast.success("Photo updated");
    } catch (err) {
      toast.error(err.message || "Upload failed");
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRemoveAvatar() {
    setAvatarUploading(true);
    try {
      await removeAvatar();
      setProfile((prev) => ({ ...prev, profileImageUrl: null }));
      syncLocalStorage({ profileImageUrl: null });
      toast.success("Photo removed");
    } catch (err) {
      toast.error(err.message || "Failed to remove photo");
    } finally {
      setAvatarUploading(false);
    }
  }

  return (
    <AdminLayout
      title="Profile"
      subtitle="Your EatsDesk platform account"
    >
      {pageLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
          <p className="text-sm font-medium text-gray-600 dark:text-neutral-400">
            Loading profile…
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[340px_1fr] max-w-5xl">
          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col items-center text-center">
              <div className="relative group mb-4">
                {profile?.profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.profileImageUrl}
                    alt={profile.name}
                    className="w-28 h-28 rounded-full object-cover border-4 border-primary/30 shadow-lg"
                  />
                ) : (
                  <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 border-4 border-primary/20 flex items-center justify-center">
                    <User className="w-14 h-14 text-primary" />
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/50 flex items-center justify-center transition-all"
                >
                  {avatarUploading ? (
                    <Loader2 className="w-7 h-7 text-white animate-spin" />
                  ) : (
                    <Camera className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
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
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Change photo
                </button>
                {profile?.profileImageUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    disabled={avatarUploading}
                    className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                {profile?.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-neutral-400 mt-1">
                {profile?.email}
              </p>
              <span className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold">
                <Shield className="w-3.5 h-3.5" />
                {roleName || "Owner"}
              </span>
              <p className="mt-2 text-[11px] text-neutral-500 dark:text-neutral-400">
                Platform role is assigned by an owner on the Team page.
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <section className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4">
                Basic details
              </h2>
              <form onSubmit={handleInfoSave} className="space-y-4">
                <label className="block">
                  <span className="text-xs font-medium text-gray-600 dark:text-neutral-400">
                    Name
                  </span>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-sm"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600 dark:text-neutral-400 flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-sm"
                    required
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-gray-600 dark:text-neutral-400 flex items-center gap-1">
                    <Phone className="w-3 h-3" /> Phone
                  </span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-sm"
                    placeholder="Optional"
                  />
                </label>
                <button
                  type="submit"
                  disabled={infoSaving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
                >
                  {infoSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Save changes
                </button>
              </form>
            </section>

            <section className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Change password
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-4">
                Use a strong password you don&apos;t use elsewhere.
              </p>
              <form onSubmit={handlePasswordChange} className="space-y-3">
                <PasswordField
                  label="Current password"
                  value={currentPassword}
                  onChange={setCurrentPassword}
                  show={showCurrent}
                  onToggle={() => setShowCurrent((v) => !v)}
                />
                <PasswordField
                  label="New password"
                  value={newPassword}
                  onChange={setNewPassword}
                  show={showNew}
                  onToggle={() => setShowNew((v) => !v)}
                />
                <PasswordField
                  label="Confirm new password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  show={showConfirm}
                  onToggle={() => setShowConfirm((v) => !v)}
                />
                <button
                  type="submit"
                  disabled={pwSaving}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-semibold disabled:opacity-50"
                >
                  {pwSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Lock className="w-4 h-4" />
                  )}
                  Update password
                </button>
              </form>
            </section>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function PasswordField({ label, value, onChange, show, onToggle }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-600 dark:text-neutral-400">
        {label}
      </span>
      <div className="relative mt-1">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2.5 pr-10 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-sm"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </label>
  );
}
