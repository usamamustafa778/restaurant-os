import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { login, getStoredAuth, getLegacyAuthOnly, isAccessTokenValid, tryRefreshStoredAuth, setStoredAuth, setTokenCookie, clearStoredAuth } from "../lib/apiClient";
import { Loader2, Eye, EyeOff, ArrowRight } from "lucide-react";
import SEO from "../components/SEO";

const ALLOWED_ROLES = [
  "super_admin",
  "restaurant_admin",
  "staff",
  "admin",
  "product_manager",
  "cashier",
  "manager",
  "kitchen_staff",
];

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingStoredAuth, setCheckingStoredAuth] = useState(true);
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
      typeof fromQuery === "string" && fromQuery.startsWith("/dashboard")
        ? fromQuery
        : "/dashboard/overview";

    if (auth.token && isAccessTokenValid(auth.token)) {
      router.replace(target);
      return;
    }
    if (auth.refreshToken) {
      tryRefreshStoredAuth().then((ok) => {
        setCheckingStoredAuth(false);
        if (ok) {
          router.replace(target);
        } else {
          clearStoredAuth();
        }
      });
      return;
    }
    clearStoredAuth();
    setCheckingStoredAuth(false);
  }, [router.isReady, router.query.from]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await login(email, password);
      const user = data.user || data;

      if (!user || !ALLOWED_ROLES.includes(user.role)) {
        setError("Invalid credentials or not an admin/staff user");
        setLoading(false);
        return;
      }

      // Resolve the user's actual restaurant slug from API response or JWT
      let restaurantSlug = user.restaurantSlug || null;
      if (!restaurantSlug && data.token) {
        try {
          const payload = JSON.parse(atob(data.token.split(".")[1]));
          restaurantSlug = payload.tenantSlug || null;
        } catch (_) {
          /* ignore decode errors */
        }
      }

      // Decide target dashboard route — always on main domain, no slug prefix
      let target = "/dashboard/overview";
      const fromQuery = router.query.from;

      // Prefer redirect from middleware if present
      if (typeof fromQuery === "string" && fromQuery.startsWith("/dashboard")) {
        target = fromQuery;
      } else if (user.role === "super_admin") {
        target = "/dashboard/super/overview";
      }

      // Persist auth info for client-side use (e.g. showing name/role)
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

      // Navigate to dashboard (keep loading true during navigation)
      window.location.href = "/dashboard/overview";
    } catch (err) {
      setError(err.message || "Login failed");
      setLoading(false);
    }
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

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="text-xs text-gray-700 font-semibold">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-700 font-semibold">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
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
    </>
  );
}
