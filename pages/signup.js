import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { registerRestaurant } from "../lib/apiClient";
import { Loader2, Eye, EyeOff, ArrowRight, ArrowLeft, Plus, X, MapPin } from "lucide-react";
import SEO from "../components/SEO";

export default function SignupPage() {
  const [step, setStep] = useState(1);
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [restaurantName, setRestaurantName] = useState("");
  const [branches, setBranches] = useState([{ name: "", address: "" }]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // --- Step navigation ---
  function goToStep2(e) {
    e.preventDefault();
    setError("");
    if (!ownerName.trim()) { setError("Name is required"); return; }
    if (!email.trim()) { setError("Email is required"); return; }
    const phoneDigits = (phone || "").replace(/\D/g, "");
    if (phoneDigits.length === 0) { setError("Phone number is required"); return; }
    if (phoneDigits.length !== 11) { setError("Phone number must be exactly 11 digits"); return; }
    if (!password || password.length < 6) { setError("Password must be at least 6 characters"); return; }
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
    setBranches(prev => [...prev, { name: "", address: "" }]);
  }

  function removeBranch(index) {
    if (branches.length <= 1) return;
    setBranches(prev => prev.filter((_, i) => i !== index));
  }

  // --- Submit ---
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!restaurantName.trim()) { setError("Restaurant name is required"); return; }

    const validBranches = branches.filter(b => b.name.trim());
    if (validBranches.length === 0) { setError("At least one branch is required"); return; }

    setLoading(true);

    try {
      const payload = {
        restaurantName: restaurantName.trim(),
        ownerName: ownerName.trim(),
        email: email.trim(),
        password,
        phone: (phone || "").replace(/\D/g, "").slice(0, 11) || undefined,
        branches: validBranches.map(b => ({
          name: b.name.trim(),
          address: b.address.trim() || undefined,
        })),
      };

      const data = await registerRestaurant(payload);
      const user = data.user;

      // Resolve the restaurant slug from API response or JWT
      let restaurantSlug = user.restaurantSlug || null;
      if (!restaurantSlug && data.token) {
        try {
          const payload = JSON.parse(atob(data.token.split(".")[1]));
          restaurantSlug = payload.tenantSlug || null;
        } catch (_) {
          /* ignore decode errors */
        }
      }

      // Store auth data with tenantSlug
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "restaurantos_auth",
          JSON.stringify({
            user: { ...user, tenantSlug: restaurantSlug },
            token: data.token || null,
            refreshToken: data.refreshToken || null,
            tenantSlug: restaurantSlug,
          })
        );
      }

      window.location.href = "/dashboard/overview";
    } catch (err) {
      setError(err.message || "Registration failed");
      setLoading(false);
    }
  }

  const inputClass =
    "w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white transition-all";

  return (
    <>
      <SEO
        title="Start Free Trial - Eats Desk Restaurant Management System"
        description="Start your 14-day free trial of Eats Desk. Get a complete restaurant management system with POS, inventory, and free website. No credit card required!"
        keywords="restaurant management free trial, POS system trial, restaurant software demo, free restaurant website, start restaurant business"
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
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold transition-all shadow ${
              step === 1 ? "bg-gradient-to-br from-primary to-secondary text-white scale-105" : "bg-primary/10 text-primary"
            }`}>
              1
            </div>
            <div className="w-12 h-0.5 rounded-full bg-gradient-to-r from-primary to-secondary opacity-30" />
            <div className={`flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold transition-all shadow ${
              step === 2 ? "bg-gradient-to-br from-primary to-secondary text-white scale-105" : "bg-gray-100 text-gray-400"
            }`}>
              2
            </div>
          </div>

          {/* Step 1: Owner Info */}
          {step === 1 && (
            <>
              <div className="text-center mb-4">
                <h1 className="text-xl font-bold tracking-tight text-gray-900 mb-1">Create your account</h1>
                <p className="text-xs text-gray-600">14-day free trial • No credit card required</p>
              </div>

              {error && (
                <div className="mb-3 text-xs text-red-600 bg-red-50/80 border border-red-200 rounded-lg px-3 py-2 backdrop-blur-sm">
                  {error}
                </div>
              )}

              <form onSubmit={goToStep2} className="space-y-3">
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
                  <label className="text-xs text-gray-700 font-semibold">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="03XXXXXXXXX (11 digits)"
                    maxLength={14}
                    className={inputClass}
                  />
                  <p className="text-[11px] text-gray-500">Must be exactly 11 digits</p>
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

                <button
                  type="submit"
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-sm font-bold hover:shadow-lg hover:shadow-primary/30 transition-all mt-4"
                >
                  Continue to Step 2
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </>
          )}

          {/* Step 2: Restaurant Info */}
          {step === 2 && (
            <>
              <div className="text-center mb-4">
                <h1 className="text-xl font-bold tracking-tight text-gray-900 mb-1">Set up your restaurant</h1>
                <p className="text-xs text-gray-600">Restaurant name and branch locations</p>
              </div>

              {error && (
                <div className="mb-3 text-xs text-red-600 bg-red-50/80 border border-red-200 rounded-lg px-3 py-2 backdrop-blur-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs text-gray-700 font-semibold">Restaurant Name</label>
                  <input
                    type="text"
                    required
                    value={restaurantName}
                    onChange={(e) => setRestaurantName(e.target.value)}
                    placeholder="e.g., Burger Palace"
                    className={inputClass}
                  />
                </div>

                {/* Branches */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-700 font-semibold flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-primary" />
                      Branch Locations
                    </label>
                    <button
                      type="button"
                      onClick={addBranch}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-secondary transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add Branch
                    </button>
                  </div>

                  <div className="space-y-2">
                    {branches.map((branch, index) => (
                      <div
                        key={index}
                        className="relative rounded-lg border border-gray-200 bg-gray-50/50 p-3 space-y-2"
                      >
                        {branches.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeBranch(index)}
                            className="absolute top-2 right-2 p-1 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            aria-label="Remove branch"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <div className="space-y-1">
                          <label className="text-[11px] text-gray-600 font-semibold">Branch {index + 1} Name</label>
                          <input
                            type="text"
                            value={branch.name}
                            onChange={(e) => updateBranch(index, "name", e.target.value)}
                            placeholder="e.g., DHA Phase 5, Gulberg Main"
                            className={inputClass}
                            required={index === 0}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[11px] text-gray-600 font-semibold">
                            Address <span className="text-gray-400 font-normal">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={branch.address}
                            onChange={(e) => updateBranch(index, "address", e.target.value)}
                            placeholder="Full address"
                            className={inputClass}
                          />
                        </div>
                      </div>
                    ))}
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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            SSL encrypted
          </span>
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Setup in 2 min
          </span>
        </div>
      </div>
    </div>
    </>
  );
}
