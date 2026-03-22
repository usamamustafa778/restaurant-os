import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { registerRestaurant, verifyEmail } from "../lib/apiClient";
import { Loader2, Eye, EyeOff, ArrowRight, ArrowLeft, Plus, Trash2 } from "lucide-react";
import SEO from "../components/SEO";

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
  { code: "+92", country: "Pakistan", dial: "92", iso2: "PK" },
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

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white transition-all";

  return (
    <>
      <SEO
        title="Start Free Trial - Eats Desk Restaurant Management System"
        description="Start your 3-months free trial of Eats Desk. Get a complete restaurant management system with POS, inventory, and free website. No credit card required!"
        keywords="restaurant management free trial, POS system trial, restaurant software demo, free restaurant website, start restaurant business"
      />
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-6">
        {/* Modern gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-white to-secondary/5" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div
          className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        />

        <div className="relative w-full max-w-5xl mx-auto">
          <div className="relative grid gap-8 md:grid-cols-2 bg-white dark:bg-black py-10 rounded-3xl items-stretch">
            <Link href="/" className="absolute top-4 left-4 z-10">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            {/* Left: illustration image (same as login) */}
            <div className="hidden relative md:flex rounded-3xl overflow-hidden">
              <div className="relative w-full">
                <div className="dark:hidden h-full flex items-center justify-center">
                  <img
                    src="/st-images/light.png"
                    alt="Eats Desk illustration"
                    className="h-full max-h-[500px] w-auto object-cover"
                  />
                </div>
                <div className="hidden dark:flex h-full items-center justify-center">
                  <img
                    src="/st-images/dark.png"
                    alt="Eats Desk illustration (dark)"
                    className="h-full max-h-[500px] w-auto object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Right: logo + signup form */}
            <div className="relative w-full max-w-md mx-auto flex flex-col">
              {/* Logo */}
              <div className="flex items-center justify-center gap-2 mb-5">
                <img
                  src="/favicon.png"
                  alt="Eats Desk"
                  className="h-11 w-11 shrink-0 rounded-xl object-cover"
                  width={44}
                  height={44}
                />
                <div>
                  <div className="text-base font-bold text-gray-900">Eats Desk</div>
                  <div className="text-[11px] text-gray-600">Restaurant Operations Platform</div>
                </div>
              </div>

              {/* Card */}
              <div className="bg-white/90 backdrop-blur-xl rounded-2xl shadow-xl border border-white/50 px-6 py-6">
                {/* Step 1: Restaurant Info */}
                {step === 1 && (
                  <>
                    <div className="text-center mb-4">
                      <h1 className="text-xl font-bold tracking-tight text-gray-900 mb-1">Set up your restaurant</h1>
                      <p className="text-xs text-gray-600">Restaurant name, URL and branch locations</p>
                    </div>

                    {error && (
                      <div className="mb-3 text-xs text-red-600 bg-red-50/80 border border-red-200 rounded-lg px-3 py-2 backdrop-blur-sm">
                        {error}
                      </div>
                    )}

                    <form onSubmit={goToStep2} className="space-y-4">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-700 font-semibold">Restaurant Name</label>
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
                          className={inputClass}
                        />
                        <p className="text-[11px] text-gray-500 mt-1.5 flex items-baseline gap-0.5">
                          <span className="text-gray-400">URL:</span>
                          <input
                            type="text"
                            autoComplete="off"
                            value={subdomain}
                            onChange={(e) => {
                              const v = e.target.value.replace(/[^a-z0-9-]/gi, "").toLowerCase();
                              setSubdomain(v);
                            }}
                            placeholder="myrestaurant"
                            className="min-w-[8ch] max-w-[24ch] px-0.5 py-0 text-[11px] font-mono text-gray-600 bg-transparent border-none border-b border-gray-300/60 hover:border-gray-400 focus:border-gray-500 focus:outline-none focus:ring-0"
                          />
                          <span className="text-gray-400 font-mono">.eatsdesk.app</span>
                        </p>
                      </div>

                      {/* Branches */}
                      <div className="space-y-2">
                        <label className="text-xs text-gray-700 font-semibold block">Branch</label>
                        {branches.map((branch, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input
                              type="text"
                              value={branch.name}
                              onChange={(e) => updateBranch(index, "name", e.target.value)}
                              placeholder="e.g., DHA Phase 5, Gulberg Main"
                              className={inputClass}
                              required={index === 0}
                            />
                            {branches.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeBranch(index)}
                                className="flex-shrink-0 p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
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
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-primary text-xs font-semibold text-primary hover:bg-primary/5 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Branch
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-gray-700 font-semibold">
                          Phone Number <span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                          <select
                            value={countryCode}
                            onChange={(e) => setCountryCode(e.target.value)}
                            className="w-28 px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white transition-all"
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
                            className={`${inputClass} flex-1`}
                          />
                        </div>
                        <p className="text-[11px] text-gray-500">Enter number without country code (7–15 digits)</p>
                      </div>

                      <button
                        type="submit"
                        className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-bold hover:shadow-lg hover:shadow-primary/30 transition-all mt-4"
                      >
                        Continue
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </form>
                  </>
                )}

                {/* Step 2: Owner/Account Info */}
                {step === 2 && (
                  <>
                    <div className="text-center mb-4">
                      <h1 className="text-xl font-bold tracking-tight text-gray-900 mb-1">Create your account</h1>
                      <p className="text-xs text-gray-600">3-months free trial • No credit card required</p>
                    </div>

                    {error && (
                      <div className="mb-3 text-xs text-red-600 bg-red-50/80 border border-red-200 rounded-lg px-3 py-2 backdrop-blur-sm">
                        {error}
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs text-gray-700 font-semibold">Your Name</label>
                        <input
                          type="text"
                          required
                          value={ownerName}
                          onChange={(e) => setOwnerName(e.target.value)}
                          placeholder="Full name"
                          className={inputClass}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-gray-700 font-semibold">Email Address</label>
                        <input
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="name@company.com"
                          className={inputClass}
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs text-gray-700 font-semibold">Create Password</label>
                        <div className="relative">
                          <input
                            type={showPassword ? "text" : "password"}
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Minimum 6 characters"
                            minLength={6}
                            className={`${inputClass} pr-10`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors"
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
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          Back
                        </button>
                        <button
                          type="submit"
                          disabled={loading}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-bold hover:shadow-lg hover:shadow-emerald-500/30 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {loading ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Creating…
                            </>
                          ) : (
                            <>
                              Create Account & Start Trial
                              <ArrowRight className="w-4 h-4" />
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-center text-xs text-gray-600">
                    Already have an account?{" "}
                    <Link href="/login" className="font-bold text-primary hover:text-secondary transition-colors">
                      Sign in here →
                    </Link>
                  </p>
                </div>
              </div>

              {/* Trust indicators */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  No credit card
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  SSL encrypted
                </span>
                <span className="flex items-center gap-1">
                  <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  Setup in 2 min
                </span>
              </div>
            </div>
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
              <span className="font-semibold">{verifyEmailAddress}</span>. Enter
              it below to activate your account.
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
    </>
  );
}
