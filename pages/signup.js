import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { registerRestaurant, verifyEmail } from "../lib/apiClient";
import { Loader2, Eye, EyeOff, ArrowRight, ArrowLeft, Plus, Trash2 } from "lucide-react";
import SEO from "../components/SEO";
import AuthDashboardMockupPanel from "../components/AuthDashboardMockupPanel";

function getFlagEmoji(iso2) {
  if (!iso2 || iso2.length !== 2) return "";
  return iso2
    .toUpperCase()
    .split("")
    .map((c) => String.fromCodePoint(0x1f1e6 - 65 + c.charCodeAt(0)))
    .join("");
}

const COUNTRY_CODES = [
  { code: "+1", country: "US/Canada", dial: "1", iso2: "US" },
  { code: "+44", country: "UK", dial: "44", iso2: "GB" },
  { code: "+92", country: "+92", dial: "92", iso2: "PK" },
  { code: "+91", country: "India", dial: "91", iso2: "IN" },
  { code: "+971", country: "UAE", dial: "971", iso2: "AE" },
  { code: "+966", country: "Saudi Arabia", dial: "966", iso2: "SA" },
  { code: "+49", country: "Germany", dial: "49", iso2: "DE" },
  { code: "+33", country: "France", dial: "33", iso2: "FR" },
  { code: "+61", country: "Australia", dial: "61", iso2: "AU" },
  { code: "+81", country: "Japan", dial: "81", iso2: "JP" },
  { code: "+86", country: "China", dial: "86", iso2: "CN" },
  { code: "+90", country: "Turkey", dial: "90", iso2: "TR" },
  { code: "+27", country: "South Africa", dial: "27", iso2: "ZA" },
  { code: "+65", country: "Singapore", dial: "65", iso2: "SG" },
  { code: "+60", country: "Malaysia", dial: "60", iso2: "MY" },
  { code: "+62", country: "Indonesia", dial: "62", iso2: "ID" },
  { code: "+234", country: "Nigeria", dial: "234", iso2: "NG" },
  { code: "+20", country: "Egypt", dial: "20", iso2: "EG" },
  { code: "+55", country: "Brazil", dial: "55", iso2: "BR" },
  { code: "+52", country: "Mexico", dial: "52", iso2: "MX" },
];

function formatPhoneDisplay(value) {
  const digits = (value || "").replace(/\D/g, "");
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  if (digits.length <= 10) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 10)} ${digits.slice(10, 15)}`;
}

function slugifyForSubdomain(name) {
  if (!name || !name.trim()) return "";
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[''"`]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s+/g, "-");
}

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [countryCode, setCountryCode] = useState("+92");
  const [phone, setPhone] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [subdomain, setSubdomain] = useState("");
  const [branches, setBranches] = useState([{ name: "" }]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyEmailAddress, setVerifyEmailAddress] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const router = useRouter();

  // --- Subdomain validation ---
  function validateSubdomain(value) {
    const s = (value || "").trim().toLowerCase();
    if (!s) return "Please choose a subdomain for your restaurant URL";
    if (s.length < 2) return "Subdomain must be at least 2 characters";
    if (s.length > 50) return "Subdomain must be 50 characters or less";
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$|^[a-z0-9]{2}$/.test(s)) {
      return "Subdomain can only contain letters, numbers and hyphens (no leading/trailing hyphens)";
    }
    return null;
  }

  // --- Step navigation ---
  function goToStep2(e) {
    e.preventDefault();
    setError("");
    if (!restaurantName.trim()) { setError("Restaurant name is required"); return; }
    const subErr = validateSubdomain(subdomain);
    if (subErr) { setError(subErr); return; }
    const validBranches = branches.filter((b) => b.name.trim());
    if (validBranches.length === 0) { setError("At least one branch is required"); return; }
    const phoneDigits = (phone || "").replace(/\D/g, "");
    if (phoneDigits.length === 0) { setError("Phone number is required"); return; }
    if (phoneDigits.length < 7 || phoneDigits.length > 15) { setError("Phone number must be 7–15 digits"); return; }
    setStep(2);
  }

  function goBackToStep1() {
    setError("");
    setStep(1);
  }

  // --- Branch helpers ---
  function updateBranch(index, field, value) {
    setBranches(prev => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
  }

  function addBranch() {
    setBranches(prev => [...prev, { name: "" }]);
  }

  function removeBranch(index) {
    if (branches.length <= 1) return;
    setBranches(prev => prev.filter((_, i) => i !== index));
  }

  // --- Submit ---
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!ownerName.trim()) { setError("Name is required"); return; }
    if (!email.trim()) { setError("Email is required"); return; }
    const phoneDigits = (phone || "").replace(/\D/g, "");
    if (phoneDigits.length === 0) { setError("Phone number is required"); return; }
    if (phoneDigits.length < 7 || phoneDigits.length > 15) { setError("Phone number must be 7–15 digits"); return; }
    if (!password || password.length < 6) { setError("Password must be at least 6 characters"); return; }
    const subErr = validateSubdomain(subdomain);
    if (subErr) { setError(subErr); return; }

    const validBranches = branches.filter((b) => b.name.trim());
    if (validBranches.length === 0) { setError("At least one branch is required"); return; }

    setLoading(true);

    try {
      const payload = {
        restaurantName: restaurantName.trim(),
        subdomain: subdomain.trim().toLowerCase(),
        ownerName: ownerName.trim(),
        email: email.trim(),
        password,
        phone: (() => {
          const digits = (phone || "").replace(/\D/g, "");
          const dial = COUNTRY_CODES.find((c) => c.code === countryCode)?.dial || countryCode.replace(/\D/g, "");
          return digits ? `${dial}${digits}` : undefined;
        })(),
        branches: validBranches.map((b) => ({ name: b.name.trim() })),
      };

      const data = await registerRestaurant(payload);
      const user = data.user;

      // Show inline verification modal (OTP already sent by backend)
      setVerifyEmailAddress(user.email);
      setVerifyCode("");
      setVerifyError("");
      setShowVerifyModal(true);
    } catch (err) {
      setError(err.message || "Registration failed");
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

      // Store auth data with tenantSlug (same pattern as login)
      const user = data.user || {};
      let restaurantSlug = user.restaurantSlug || null;
      if (!restaurantSlug && data.token) {
        try {
          const payload = JSON.parse(atob(data.token.split(".")[1]));
          restaurantSlug = payload.tenantSlug || null;
        } catch {
          /* ignore */
        }
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
      router.push("/overview");
    } catch (err) {
      setVerifyError(err.message || "Verification failed");
      setVerifyLoading(false);
    }
  }

  return (
    <>
      <SEO
        title="Start Free Trial - Eats Desk Restaurant Management System"
        description="Start your 3-months free trial of Eats Desk. Get a complete restaurant management system with POS, inventory, and free website. No credit card required!"
        keywords="restaurant management free trial, POS system trial, restaurant software demo, free restaurant website, start restaurant business"
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
                <img
                  src="/favicon.png"
                  alt=""
                  width={44}
                  height={44}
                  className="shrink-0"
                />
                <div>
                  <div className="auth-brand-title">EatsDesk</div>
                  <div className="auth-brand-sub">Restaurant OS</div>
                </div>
              </div>

              <div className="auth-card">
                {step === 1 && (
                  <>
                    <h1 className="auth-card-title">Set up your restaurant</h1>
                    <p className="auth-card-lead">
                      Restaurant name, URL, and branch locations
                    </p>

                    {error && <div className="auth-error">{error}</div>}

                    <form onSubmit={goToStep2} className="space-y-4">
                      <div className="space-y-1">
                        <label className="auth-label">Restaurant name</label>
                        <input
                          type="text"
                          required
                          value={restaurantName}
                          onChange={(e) => {
                            const name = e.target.value;
                            setRestaurantName(name);
                            const sugg = slugifyForSubdomain(name);
                            setSubdomain(sugg);
                          }}
                          placeholder="e.g., Burger Palace"
                          className="auth-input"
                        />
                        <div className="auth-url-hint">
                          <span>URL:</span>
                          <input
                            type="text"
                            autoComplete="off"
                            value={subdomain}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase();
                              setSubdomain(v);
                            }}
                            placeholder="myrestaurant"
                            className="auth-inline-url"
                          />
                          <span className="auth-url-suffix">.eatsdesk.app</span>
                        </div>
                      </div>

                      {/* Branches */}
                      <div className="space-y-2">
                        <label className="auth-label">Branch</label>
                        {branches.map((branch, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={branch.name}
                              onChange={(e) => updateBranch(index, "name", e.target.value)}
                              placeholder="e.g., Main street, Mall outlet"
                              className="auth-input"
                              required={index === 0}
                            />
                            {branches.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeBranch(index)}
                                className="auth-icon-btn"
                                aria-label="Remove branch"
                              >
                                <Trash2 className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        ))}
                        <div className="pt-2 flex justify-end">
                          <button
                            type="button"
                            onClick={addBranch}
                            className="auth-btn-outline-sm"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add branch
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="auth-label">
                          Phone number <span style={{ color: "#ff8a80" }}>*</span>
                        </label>
                        <div className="auth-phone-row">
                          <select
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="auth-input auth-input-select-sm"
                          >
                            {COUNTRY_CODES.map((c) => (
                              <option key={c.code} value={c.code}>
                                {getFlagEmoji(c.iso2)} {c.code}
                              </option>
                            ))}
                          </select>
                          <input
                            type="tel"
                            required
                            value={formatPhoneDisplay(phone)}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "");
                              setPhone(digits);
                            }}
                            placeholder="300 123 4567"
                            maxLength={18}
                            className="auth-input"
                          />
                        </div>
                        <p className="text-[11px] text-[var(--gray-3)] mt-1">
                          Without country code (7–15 digits)
                        </p>
                      </div>

                      <button type="submit" className="auth-btn-primary mt-4">
                        Continue
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                  </>
                )}

                {/* Step 2: Owner/Account Info */}
                {step === 2 && (
                  <>
                    <h1 className="auth-card-title">Create your account</h1>
                    <p className="auth-card-lead">
                      30-day free trial · No credit card required
                    </p>

                    {error && <div className="auth-error">{error}</div>}

                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div className="space-y-1">
                        <label className="auth-label">Your name</label>
                        <input
                          type="text"
                          required
                          value={ownerName}
                          onChange={(e) => setOwnerName(e.target.value)}
                          placeholder="Full name"
                          className="auth-input"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="auth-label">Email</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@company.com"
                          className="auth-input"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="auth-label">Password</label>
                        <div className="auth-input-wrap">
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimum 6 characters"
                            minLength={6}
                            className="auth-input"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="auth-toggle-visibility"
                            aria-label={showPassword ? "Hide password" : "Show password"}
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <button
                          type="button"
                          onClick={goBackToStep1}
                          className="auth-btn-ghost shrink-0"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          Back
                        </button>
                        <div className="flex-1 min-w-0">
                          <button
                            type="submit"
                            disabled={loading}
                            className="auth-btn-primary"
                          >
                            {loading ? (
                              <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Creating…
                              </>
                            ) : (
                              <>
                                Create account
                                <ArrowRight className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </form>
                  </>
                )}

                <div className="auth-footer-rule">
                  <p>
                    Already have an account?{" "}
                    <Link href="/login">Sign in →</Link>
                  </p>
                </div>
              </div>

              <div className="auth-trust">
                <span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  No credit card
                </span>
                <span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  SSL encrypted
                </span>
                <span>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Setup in one day
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
              . Enter it below to activate your account.
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
    </>
  );
}
