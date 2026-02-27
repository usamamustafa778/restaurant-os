import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { login, verifyEmail, requestPasswordReset, resetPassword, getStoredAuth, getLegacyAuthOnly, isAccessTokenValid, tryRefreshStoredAuth, setStoredAuth, setTokenCookie, clearStoredAuth } from "../lib/apiClient";
import { Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";
import SEO from "../components/SEO";
import toast from "react-hot-toast";

const ALLOWED_ROLES = [
  "super_admin",
  "restaurant_admin",
  "staff",
  "admin",
  "product_manager",
  "cashier",
  "manager",
  "kitchen_staff",
  "order_taker",
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingStoredAuth, setCheckingStoredAuth] = useState(true);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyEmailAddress, setVerifyEmailAddress] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotStep, setForgotStep] = useState(1); // 1: email, 2: otp
  const [forgotCode, setForgotCode] = useState("");
  const [forgotNewPassword, setForgotNewPassword] = useState("");
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [forgotSuccess, setForgotSuccess] = useState("");
  const [showResetFields, setShowResetFields] = useState(false);
  const router = useRouter();

  // If user already has valid auth (restaurantos_auth or legacy keys), redirect to dashboard.
  // Legacy migration runs only here so we don't re-migrate after 401 and cause a redirect loop.
  useEffect(() => {
    if (typeof window === "undefined" || !router.isReady) return;
    let auth = getStoredAuth();
    if (!auth) {
      const legacy = getLegacyAuthOnly();
      if (legacy?.token) {
        setStoredAuth(legacy);
        if (legacy.token) setTokenCookie(legacy.token);
        auth = legacy;
      }
    }
    if (!auth) {
      setCheckingStoredAuth(false);
      return;
    }
    const fromQuery = router.query.from;
    const target =
      typeof fromQuery === "string" && fromQuery.startsWith("/")
        ? fromQuery
        : "/overview";

    if (auth.token && isAccessTokenValid(auth.token)) {
      router.replace(target).catch(() => {
        clearStoredAuth();
        setCheckingStoredAuth(false);
      });
      // Fallback: if navigation doesn't complete within 3s, show the form
      setTimeout(() => setCheckingStoredAuth(false), 3000);
      return;
    }
    if (auth.refreshToken) {
      tryRefreshStoredAuth()
        .then((ok) => {
          setCheckingStoredAuth(false);
          if (ok) {
            router.replace(target);
          } else {
            clearStoredAuth();
          }
        })
        .catch(() => {
          clearStoredAuth();
          setCheckingStoredAuth(false);
        });
      return;
    }
    clearStoredAuth();
    setCheckingStoredAuth(false);
  }, [router.isReady, router.query.from]);

  function openForgotModal() {
    setForgotEmail(email || "");
    setForgotStep(1);
    setForgotCode("");
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setShowForgotPassword(false);
    setShowForgotConfirmPassword(false);
    setForgotError("");
    setForgotSuccess("");
    setShowForgotModal(true);
  }

  function redirectWithAuth(data) {
    const user = data.user || data;

    if (!user || !ALLOWED_ROLES.includes(user.role)) {
      setError("Invalid credentials or not an admin/staff user");
      return;
    }

    // Resolve the user's actual restaurant slug from API response or JWT
    let restaurantSlug = user.restaurantSlug || null;
    if (!restaurantSlug && data.token) {
      try {
        const payload = JSON.parse(atob(data.token.split(".")[1]));
        restaurantSlug = payload.tenantSlug || null;
      } catch {
        /* ignore decode errors */
      }
    }

    let target = "/overview";
    const fromQuery = router.query.from;

    if (user.role === "order_taker") {
      target = "/order-taker";
    } else if (typeof fromQuery === "string" && fromQuery.startsWith("/")) {
      target = fromQuery;
    } else if (user.role === "super_admin") {
      target = "/super/overview";
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        "restaurantos_auth",
        JSON.stringify({
          user: { ...user, tenantSlug: restaurantSlug },
          token: data.token || null,
          refreshToken: data.refreshToken || null,
          tenantSlug: restaurantSlug,
        }),
      );
    }

    window.location.href = target;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await login(email, password);
      redirectWithAuth(data);
    } catch (err) {
      const msg = err.message || "Login failed";
      if (msg === "EMAIL_NOT_VERIFIED" || msg.toLowerCase().includes("email not verified")) {
        // Show verify OTP modal (backend has already sent OTP)
        setLoading(false);
        setVerifyEmailAddress(email);
        setVerifyCode("");
        setVerifyError("");
        setShowVerifyModal(true);
        return;
      }
      setError(msg);
      setLoading(false);
    }
  }

  async function handleVerifySubmit(e) {
    e.preventDefault();
    setVerifyLoading(true);
    setVerifyError("");
    try {
      const data = await verifyEmail({
        email: verifyEmailAddress.trim(),
        otp: verifyCode.trim(),
      });
      redirectWithAuth(data);
    } catch (err) {
      setVerifyError(err.message || "Verification failed");
      setVerifyLoading(false);
    }
  }

  async function handleForgotRequest(e) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError("");
    setForgotSuccess("");
    try {
      await requestPasswordReset(forgotEmail.trim());
      setForgotLoading(false);
      setForgotStep(2);
      setForgotSuccess("We have sent a code to your email.");
    } catch (err) {
      setForgotLoading(false);
      setForgotError(err.message || "Failed to send reset code");
    }
  }

  async function handleForgotVerifyCode(e) {
    e.preventDefault();
    setForgotLoading(true);
    setForgotError("");
    setForgotSuccess("");
    // For now we just store the code and move to reset fields on main form.
    // Backend requires OTP + new password together; we will send them when user submits new password.
    if (!forgotCode.trim()) {
      setForgotLoading(false);
      setForgotError("Please enter the verification code.");
      return;
    }
    setForgotLoading(false);
    setShowForgotModal(false);
    // Clear any previous new password values so the field is empty when shown
    setForgotNewPassword("");
    setForgotConfirmPassword("");
    setShowResetFields(true);
  }

  const inputClass =
    "w-full px-3.5 py-2.5 rounded-lg bg-white border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-shadow";

  return (
    <>
      <SEO
        title="Login - Eats Desk Restaurant Management System"
        description="Sign in to your Eats Desk account to access your restaurant dashboard, POS system, inventory management, and more."
        keywords="eats desk login, restaurant dashboard login, POS login, restaurant management system login"
        noindex={true}
      />
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-6">
      {/* Modern gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-white to-secondary/5" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-black text-lg shadow-lg shadow-primary/30">
            ED
          </div>
          <div>
            <div className="text-base font-bold text-gray-900">Eats Desk</div>
            <div className="text-[11px] text-gray-600">Restaurant Operations Platform</div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 px-6 py-6">
          {checkingStoredAuth ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-xs text-gray-600">Checking existing session…</p>
            </div>
          ) : (
            <>
          <div className="text-center mb-4">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 mb-1">Welcome back</h1>
            <p className="text-xs text-gray-600">Sign in to your dashboard to continue</p>
          </div>

          {error && (
            <div className="mb-3 text-xs text-red-600 bg-red-50/80 border border-red-200 rounded-lg px-3 py-2 backdrop-blur-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3" autoComplete="off">
            <div className="space-y-1">
              <label className="text-xs text-gray-700 font-semibold">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                autoComplete="off"
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white transition-all"
              />
            </div>

            {!showResetFields && (
              <div className="space-y-1">
                <label className="text-xs text-gray-700 font-semibold">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    autoComplete="off"
                    className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white transition-all pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {showResetFields && (
              <div className="space-y-2 mt-2">
                <div className="space-y-1">
                  <label className="text-xs text-gray-700 font-semibold">New password</label>
                  <div className="relative">
                    <input
                      type={showForgotPassword ? "text" : "password"}
                      required
                      value={forgotNewPassword}
                      onChange={(e) => setForgotNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors"
                      aria-label={showForgotPassword ? "Hide new password" : "Show new password"}
                    >
                      {showForgotPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-gray-700 font-semibold">Confirm password</label>
                  <div className="relative">
                    <input
                      type={showForgotConfirmPassword ? "text" : "password"}
                      required
                      value={forgotConfirmPassword}
                      onChange={(e) => setForgotConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                      className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white transition-all pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowForgotConfirmPassword((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors"
                      aria-label={showForgotConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showForgotConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={openForgotModal}
                className="text-[11px] text-primary hover:text-secondary font-semibold"
              >
                Forgot password?
              </button>
            </div>

            {showResetFields ? (
              <button
                type="button"
                disabled={forgotLoading}
                onClick={async () => {
                  setForgotError("");
                  if (forgotNewPassword.length < 6) {
                    setForgotError("Password should be at least 6 characters.");
                    return;
                  }
                  if (forgotNewPassword !== forgotConfirmPassword) {
                    setForgotError("New password and confirm password do not match.");
                    return;
                  }
                  const newPass = forgotNewPassword;
                  try {
                    await resetPassword({
                      email: forgotEmail.trim(),
                      otp: forgotCode.trim(),
                      newPassword: newPass,
                    });
                    setShowResetFields(false);
                    setPassword(newPass);
                    setForgotNewPassword("");
                    setForgotConfirmPassword("");
                    setShowForgotPassword(false);
                    setShowForgotConfirmPassword(false);
                    toast.success("Password updated. Please sign in with your new password.");
                  } catch (err) {
                    setForgotError(err.message || "Failed to reset password");
                  }
                }}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-bold hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-4"
              >
                {forgotLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Updating password…
                  </>
                ) : (
                  <>Set new password</>
                )}
              </button>
            ) : (
              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-bold hover:shadow-lg hover:shadow-primary/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-4"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in to Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            )}
          </form>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-center text-xs text-gray-600">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-bold text-primary hover:text-secondary transition-colors">
                Create free account →
              </Link>
            </p>
          </div>
            </>
          )}
        </div>

        {/* Trust indicators */}
        <div className="mt-4 flex items-center justify-center gap-3 text-[11px] text-gray-500">
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            14-day free trial
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Secure & encrypted
          </span>
        </div>
      </div>
    </div>

    {showVerifyModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-2xl">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Verify your email
          </h2>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mb-3">
            We&apos;ve sent a 6‑digit code to{" "}
            <span className="font-semibold">{verifyEmailAddress}</span>. Enter it
            below to complete sign‑in.
          </p>
          <form onSubmit={handleVerifySubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">
                Verification code
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                required
                maxLength={6}
                value={verifyCode}
                onChange={(e) =>
                  setVerifyCode(e.target.value.replace(/[^0-9]/g, ""))
                }
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 tracking-[0.4em] text-center"
                placeholder="••••••"
              />
            </div>
            {verifyError && (
              <p className="text-xs text-red-600 dark:text-red-400">
                {verifyError}
              </p>
            )}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowVerifyModal(false);
                  setVerifyCode("");
                  setVerifyError("");
                }}
                className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-medium text-gray-700 dark:text-neutral-300"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={verifyLoading}
                className="flex-1 px-3 py-2.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {verifyLoading ? "Verifying..." : "Verify & continue"}
              </button>
            </div>
          </form>
        </div>
      </div>
    )}

    {showForgotModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-6 shadow-2xl">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
            Reset your password
          </h2>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mb-3">
            {forgotStep === 1
              ? "Enter your email and we will send you a one‑time code."
              : "Enter the code we sent to your email and choose a new password."}
          </p>

          {forgotError && (
            <p className="text-xs text-red-600 dark:text-red-400 mb-2">
              {forgotError}
            </p>
          )}
          {forgotSuccess && (
            <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2">
              {forgotSuccess}
            </p>
          )}

          {forgotStep === 1 ? (
            <form onSubmit={handleForgotRequest} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  Email address
                </label>
                <input
                  type="email"
                  required
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
                  placeholder="you@example.com"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotError("");
                    setForgotSuccess("");
                  }}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-medium text-gray-700 dark:text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {forgotLoading ? "Sending..." : "Send code"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleForgotVerifyCode} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  Verification code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  required
                  maxLength={6}
                  value={forgotCode}
                  onChange={(e) =>
                    setForgotCode(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 tracking-[0.4em] text-center"
                  placeholder="••••••"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(false);
                    setForgotError("");
                    setForgotSuccess("");
                  }}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-xs font-medium text-gray-700 dark:text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={forgotLoading}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {forgotLoading ? "Updating..." : "Set new password"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    )}
    </>
  );
}
