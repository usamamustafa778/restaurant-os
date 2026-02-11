import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { login } from "../lib/apiClient";
import { buildTenantUrl } from "../lib/routes";
import { ShieldCheck, Loader2, Eye, EyeOff } from "lucide-react";

const ALLOWED_ROLES = [
  "super_admin",
  "restaurant_admin",
  "staff",
  "admin",
  "product_manager",
  "cashier",
  "manager",
  "kitchen_staff"
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

      // Decide target dashboard route
      let target = "/dashboard/overview";
      const fromQuery = router.query.from;

      // Prefer redirect from middleware if present
      if (typeof fromQuery === "string" && fromQuery.startsWith("/")) {
        target = fromQuery;
      } else if (user.role === "super_admin") {
        target = "/dashboard/super/overview";
      } else {
        // For tenant users, redirect to tenant-specific dashboard when slug is available
        const slug = user.restaurantSlug || data.restaurant?.subdomain;
        if (slug) {
          target = buildTenantUrl(slug, "/dashboard/overview");
        } else {
          target = "/dashboard/overview";
        }
      }

      // Persist auth info for client-side use (e.g. showing name/role)
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "restaurantos_auth",
          JSON.stringify({
            user,
            token: data.token || null,
            refreshToken: data.refreshToken || null
          })
        );
      }

      // Navigate to dashboard (keep loading true during navigation)
      window.location.href = target;
    } catch (err) {
      setError(err.message || "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary dark:bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold">
            EO
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">EatOut Admin</div>
            <div className="text-xs text-gray-800 dark:text-neutral-400">Restaurant Owner Dashboard</div>
          </div>
        </div>

        <h1 className="text-lg font-semibold tracking-tight mb-1 text-gray-900 dark:text-white">Admin Login</h1>
        <p className="text-xs text-neutral-400 mb-5">
          Sign in with your admin credentials to manage orders and menu.
        </p>

        {error && (
          <div className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-700 dark:text-neutral-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-700 dark:text-neutral-300">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3 py-2 pr-10 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-neutral-200 rounded"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Sign in as Admin
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-neutral-400">
            Don't have an account?{" "}
            <Link href="/signup" className="text-primary hover:underline font-medium">
              Sign up as a restaurant owner
            </Link>
          </p>
        </div>

        <p className="mt-4 text-[11px] text-neutral-500 text-center">
          Use your RestaurantOS credentials (super_admin, restaurant_admin, admin, product manager,
          cashier, manager, or kitchen staff).
        </p>
      </div>
    </div>
  );
}

