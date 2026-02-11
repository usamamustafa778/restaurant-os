import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Eye, EyeOff, Loader2, ShieldCheck, User, Store } from "lucide-react";
import { login, getToken, getStoredAuth, clearStoredAuth } from "../../../lib/apiClient";
import { buildTenantUrl } from "../../../lib/routes";

const ROLES = [
  { id: "restaurant_admin", label: "Admin" },
  { id: "product_manager", label: "Product Manager" },
  { id: "cashier", label: "Cashier" },
  { id: "manager", label: "Manager" },
  { id: "kitchen_staff", label: "Kitchen Staff" },
  { id: "order_taker", label: "Order Taker" }
];

export default function TenantLoginPage() {
  const router = useRouter();
  const { subdomain, role: roleFromQuery } = router.query;

  const [selectedRole, setSelectedRole] = useState(ROLES[0].id);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [shopName, setShopName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // If already authenticated for THIS restaurant, skip login and go to dashboard
  useEffect(() => {
    if (!subdomain) return;
    if (typeof window === "undefined") return;

    // Preselect role from URL query if valid
    if (typeof roleFromQuery === "string") {
      const found = ROLES.find(r => r.id === roleFromQuery);
      if (found) {
        setSelectedRole(found.id);
      }
    }

    const token = getToken();
    if (token) {
      // Only auto-redirect if the stored token belongs to this restaurant
      const auth = getStoredAuth();
      const storedSlug = auth?.user?.tenantSlug || auth?.user?.restaurantSlug || auth?.tenantSlug;
      if (storedSlug && storedSlug !== subdomain) {
        // Token belongs to a different restaurant — clear it and let user log in fresh
        clearStoredAuth();
        return;
      }
      const roleSegment = typeof roleFromQuery === "string" ? `/${encodeURIComponent(roleFromQuery)}` : "";
      window.location.href = buildTenantUrl(subdomain, `${roleSegment}/dashboard`);
    }
  }, [router, subdomain, roleFromQuery]);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Reuse existing login API (treat username as email/identifier)
      const data = await login(username, password);
      const user = data.user || data;

      // Persist auth info for client-side use
      const effectiveRole = user.role || selectedRole;

      // Determine the user's ACTUAL restaurant slug:
      // 1. From the API response (backend looked up the restaurant)
      // 2. From the JWT payload (backend embedded it during token generation)
      // 3. Last resort: the URL subdomain
      let userSlug = user.restaurantSlug || null;

      // If backend didn't return restaurantSlug, decode it from the JWT
      if (!userSlug && data.token) {
        try {
          const payload = JSON.parse(atob(data.token.split(".")[1]));
          userSlug = payload.tenantSlug || null;
        } catch (_) { /* ignore decode errors */ }
      }

      // Final fallback to URL subdomain (should rarely happen)
      if (!userSlug) userSlug = subdomain;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "restaurantos_auth",
          JSON.stringify({
            user: {
              ...user,
              role: effectiveRole,
              tenantSlug: userSlug
            },
            token: data.token || null,
            refreshToken: data.refreshToken || null,
            tenantSlug: userSlug,
            shopName: shopName || null
          })
        );
      }

      // Always redirect to the user's own restaurant dashboard
      const target = userSlug
        ? buildTenantUrl(userSlug, `/${encodeURIComponent(effectiveRole)}/dashboard`)
        : "/dashboard/overview";

      window.location.href = target;
    } catch (err) {
      setError(err.message || "Login failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary dark:bg-black flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary flex items-center justify-center text-white font-bold">
            <Store className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900 dark:text-white">
              {subdomain ? `${subdomain} Staff Login` : "Restaurant Staff Login"}
            </div>
            <div className="text-xs text-gray-800 dark:text-neutral-400">
              Sign in to manage orders, POS and daily operations.
            </div>
          </div>
        </div>

        <h1 className="text-lg font-semibold tracking-tight mb-1 text-gray-900 dark:text-white">
          Sign In
        </h1>
        <p className="text-xs text-neutral-400 mb-5">
          Nice to see you again. Please log in to continue.
        </p>

        {/* Role selection */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {ROLES.map(role => {
            const isActive = selectedRole === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => setSelectedRole(role.id)}
                className={`flex flex-col items-center justify-center gap-1 rounded-xl border text-xs py-3 transition-colors ${
                  isActive
                    ? "bg-primary text-white border-primary"
                    : "bg-bg-primary dark:bg-neutral-900 text-gray-700 dark:text-neutral-200 border-gray-300 dark:border-neutral-800 hover:border-primary/60"
                }`}
              >
                <User className="w-4 h-4" />
                <span>{role.label}</span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-700 dark:text-neutral-300">
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Manager"
              className="w-full px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-700 dark:text-neutral-300">
              Password
            </label>
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
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-gray-700 dark:text-neutral-300">
              Shop Name
            </label>
            <input
              type="text"
              value={shopName}
              onChange={e => setShopName(e.target.value)}
              placeholder="Enter Shop Name"
              className="w-full px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
            />
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
                Sign In
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

