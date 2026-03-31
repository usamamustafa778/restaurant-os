import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import {
  login,
  verifyEmail,
  requestPasswordReset,
  resetPassword,
  getStoredAuth,
  getLegacyAuthOnly,
  isAccessTokenValid,
  tryRefreshStoredAuth,
  setStoredAuth,
  setTokenCookie,
  clearStoredAuth,
  getRestaurantSettings,
  setStoredCurrencyCode,
} from "../lib/apiClient";
import { Loader2, Eye, EyeOff, ArrowRight, ArrowLeft } from "lucide-react";
import SEO from "../components/SEO";
import AuthDashboardMockupPanel from "../components/AuthDashboardMockupPanel";
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
  "delivery_rider",
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
  const [showForgotConfirmPassword, setShowForgotConfirmPassword] =
    useState(false);
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
    } else if (user.role === "delivery_rider") {
      target = "/rider";
    } else if (user.role === "cashier") {
      target = "/orders";
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

    // Fetch restaurant settings once after login to prime currency code
    getRestaurantSettings()
      .then((s) => {
        if (s?.currencyCode) {
          setStoredCurrencyCode(s.currencyCode);
        }
      })
      .catch(() => {
        /* ignore */
      })
      .finally(() => {
        window.location.href = target;
      });
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
      if (
        msg === "EMAIL_NOT_VERIFIED" ||
        msg.toLowerCase().includes("email not verified")
      ) {
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

  return (
    <>
      <SEO
        title="Login - Eats Desk Restaurant Management System"
        description="Sign in to your Eats Desk account to access your restaurant dashboard, POS system, inventory management, and more."
        keywords="eats desk login, restaurant dashboard login, POS login, restaurant management system login"
        noindex={true}
      />
      <div className="auth-page">
        <div className="auth-page-bg" aria-hidden />
        <div className="auth-page-inner">
          <div className="auth-page-grid">
            <Link href="/" className="auth-back" aria-label="Back to home">
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <AuthDashboardMockupPanel />

            <div className="auth-page-form-col">
              <div className="auth-brand">
                <img src="/favicon.png" alt="" width={44} height={44} />
                <div>
                  <div className="auth-brand-title">EatsDesk</div>
                  <div className="auth-brand-sub">Restaurant OS</div>
                </div>
              </div>

              <div className="auth-card">
                {checkingStoredAuth ? (
                  <div className="auth-loading-box">
                    <Loader2 className="w-8 h-8 animate-spin" />
                    <p>Checking existing session…</p>
                  </div>
                ) : (
                  <>
                    <h1 className="auth-card-title">Welcome back</h1>
                    <p className="auth-card-lead">
                      Sign in to your dashboard to continue
                    </p>

                    {error && <div className="auth-error">{error}</div>}

                    <form
                      onSubmit={handleSubmit}
                      className="space-y-3"
                      autoComplete="off"
                    >
                      <div className="space-y-1">
                        <label className="auth-label">Email Address</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@company.com"
                          autoComplete="off"
                          className="auth-input"
                        />
                      </div>

                      {!showResetFields && (
                        <div className="space-y-1">
                          <label className="auth-label">Password</label>
                          <div className="auth-input-wrap">
                            <input
                              type={showPassword ? "text" : "password"}
                              required
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              placeholder="Enter your password"
                              autoComplete="off"
                              className="auth-input"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="auth-toggle-visibility"
                              aria-label={
                                showPassword ? "Hide password" : "Show password"
                              }
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
                            <label className="auth-label">New password</label>
                            <div className="auth-input-wrap">
                              <input
                                type={showForgotPassword ? "text" : "password"}
                                required
                                value={forgotNewPassword}
                                onChange={(e) =>
                                  setForgotNewPassword(e.target.value)
                                }
                                placeholder="Enter new password"
                                autoComplete="new-password"
                                className="auth-input"
                              />
                              <button
                                type="button"
                                onClick={() => setShowForgotPassword((v) => !v)}
                                className="auth-toggle-visibility"
                                aria-label={
                                  showForgotPassword
                                    ? "Hide new password"
                                    : "Show new password"
                                }
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
                            <label className="auth-label">Confirm password</label>
                            <div className="auth-input-wrap">
                              <input
                                type={
                                  showForgotConfirmPassword
                                    ? "text"
                                    : "password"
                                }
                                required
                                value={forgotConfirmPassword}
                                onChange={(e) =>
                                  setForgotConfirmPassword(e.target.value)
                                }
                                placeholder="Re-enter new password"
                                autoComplete="new-password"
                                className="auth-input"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setShowForgotConfirmPassword((v) => !v)
                                }
                                className="auth-toggle-visibility"
                                aria-label={
                                  showForgotConfirmPassword
                                    ? "Hide confirm password"
                                    : "Show confirm password"
                                }
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
                          className="auth-link-text"
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
                              setForgotError(
                                "Password should be at least 6 characters.",
                              );
                              return;
                            }
                            if (forgotNewPassword !== forgotConfirmPassword) {
                              setForgotError(
                                "New password and confirm password do not match.",
                              );
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
                              toast.success(
                                "Password updated. Please sign in with your new password.",
                              );
                            } catch (err) {
                              setForgotError(
                                err.message || "Failed to reset password",
                              );
                            }
                          }}
                          className="auth-btn-primary mt-4"
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
                          className="auth-btn-primary mt-4"
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

                    <div className="auth-footer-rule">
                      <p>
                        Don&apos;t have an account?{" "}
                        <Link href="/signup">Create free account →</Link>
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="auth-trust">
                <span>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  30-day free trial
                </span>
                <span>
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  Secure & encrypted
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showVerifyModal && (
        <div className="auth-modal-overlay">
          <div className="auth-modal">
            <h2>Verify your email</h2>
            <p>
              We&apos;ve sent a 6‑digit code to{" "}
              <span style={{ color: "var(--white)", fontWeight: 600 }}>
                {verifyEmailAddress}
              </span>
              . Enter it below to complete sign‑in.
            </p>
            <form onSubmit={handleVerifySubmit} className="space-y-3">
              <div>
                <label className="auth-label">Verification code</label>
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
                  className="auth-input tracking-[0.35em] text-center"
                  placeholder="••••••"
                />
              </div>
              {verifyError && (
                <p className="auth-error-text">{verifyError}</p>
              )}
              <div className="auth-modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setShowVerifyModal(false);
                    setVerifyCode("");
                    setVerifyError("");
                  }}
                  className="auth-btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={verifyLoading}
                  className="auth-btn-primary"
                >
                  {verifyLoading ? "Verifying..." : "Verify & continue"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showForgotModal && (
        <div className="auth-modal-overlay">
          <div className="auth-modal">
            <h2>Reset your password</h2>
            <p>
              {forgotStep === 1
                ? "Enter your email and we will send you a one‑time code."
                : "Enter the code we sent to your email, then set a new password on the main form."}
            </p>

            {forgotError && (
              <p className="auth-error-text">{forgotError}</p>
            )}
            {forgotSuccess && (
              <p className="auth-success-text">{forgotSuccess}</p>
            )}

            {forgotStep === 1 ? (
              <form onSubmit={handleForgotRequest} className="space-y-3">
                <div>
                  <label className="auth-label">Email address</label>
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="auth-input"
                    placeholder="you@example.com"
                  />
                </div>
                <div className="auth-modal-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      setForgotError("");
                      setForgotSuccess("");
                    }}
                    className="auth-btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="auth-btn-primary"
                  >
                    {forgotLoading ? "Sending..." : "Send code"}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleForgotVerifyCode} className="space-y-3">
                <div>
                  <label className="auth-label">Verification code</label>
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
                    className="auth-input tracking-[0.35em] text-center"
                    placeholder="••••••"
                  />
                </div>
                <div className="auth-modal-actions">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgotModal(false);
                      setForgotError("");
                      setForgotSuccess("");
                    }}
                    className="auth-btn-ghost"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="auth-btn-primary"
                  >
                    {forgotLoading ? "Updating..." : "Continue"}
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
