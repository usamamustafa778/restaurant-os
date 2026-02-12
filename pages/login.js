import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { login } from "../lib/apiClient";
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
  const router = useRouter();

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
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center px-4 py-8">
      {/* Modern gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-white to-secondary/5" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-primary/30">
            ED
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">
              Eats Desk
            </div>
            <div className="text-xs text-gray-600">
              Restaurant Operations Platform
            </div>
          </div>
        </div>

        {/* Card */}
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/50 px-10 py-12">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 mb-2">
              Welcome back
            </h1>
            <p className="text-sm text-gray-600">
              Sign in to your dashboard to continue
            </p>
          </div>

          {error && (
            <div className="mb-6 text-sm text-red-600 bg-red-50/80 border border-red-200 rounded-xl px-4 py-3 backdrop-blur-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm text-gray-700 font-semibold">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-700 font-semibold">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full px-4 py-3.5 rounded-xl bg-gray-50 border border-gray-200 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 focus:bg-white transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-to-r from-primary to-secondary text-white text-base font-bold hover:shadow-lg hover:shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0 mt-8"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in to Dashboard
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-center text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="font-bold text-primary hover:text-secondary transition-colors"
              >
                Create free account →
              </Link>
            </p>
          </div>
        </div>

        {/* Trust indicators */}
        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            14-day free trial
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
