import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import { registerRestaurant } from "../lib/apiClient";
import { Store, Loader2, Eye, EyeOff, CheckCircle2 } from "lucide-react";

export default function SignupPage() {
  const [formData, setFormData] = useState({
    restaurantName: "",
    subdomain: "",
    ownerName: "",
    email: "",
    password: "",
    phone: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const data = await registerRestaurant(formData);
      const user = data.user;
      const slug = data.restaurant?.subdomain;

      // Store auth data
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "restaurantos_auth",
          JSON.stringify({ user, token: data.token || null })
        );
      }

      // Redirect to dashboard — always on the main domain
      window.location.href = "/dashboard/overview";
    } catch (err) {
      setError(err.message || "Registration failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary dark:bg-black flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-xl bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-800 rounded-2xl p-8 shadow-xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-12 w-12 rounded-xl bg-primary flex items-center justify-center text-white font-bold text-lg">
            ROS
          </div>
          <div>
            <div className="text-base font-semibold text-gray-900 dark:text-white">RestaurantOS</div>
            <div className="text-xs text-gray-800 dark:text-neutral-400">Start Your Free Trial</div>
          </div>
        </div>

        <h1 className="text-2xl font-bold tracking-tight mb-2 text-gray-900 dark:text-white">Create Your Restaurant Account</h1>
        <p className="text-sm text-gray-900 dark:text-neutral-400 mb-6">
          Get started with a 14-day free trial. No credit card required.
        </p>

        {error && (
          <div className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Restaurant Details */}
          <div className="space-y-4 p-4 bg-bg-primary dark:bg-neutral-900/50 border border-gray-300 dark:border-neutral-800 rounded-xl">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-200 flex items-center gap-2">
              <Store className="w-4 h-4" />
              Restaurant Details
            </h3>
            
            <div className="space-y-1">
              <label className="text-xs text-gray-700 dark:text-neutral-300">Restaurant Name *</label>
              <input
                type="text"
                name="restaurantName"
                required
                value={formData.restaurantName}
                onChange={handleChange}
                placeholder="e.g., Pizza Palace"
                className="w-full px-3 py-2.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-700 dark:text-neutral-300">
                Subdomain * <span className="text-neutral-500">(yourname.restaurantos.com)</span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  name="subdomain"
                  required
                  value={formData.subdomain}
                  onChange={handleChange}
                  placeholder="pizzapalace"
                  pattern="[a-z0-9-]+"
                  title="Only lowercase letters, numbers, and hyphens"
                  className="flex-1 px-3 py-2.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
                />
                <span className="text-xs text-neutral-500">.restaurantos.com</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-700 dark:text-neutral-300">Phone (optional)</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+1 (555) 123-4567"
                className="w-full px-3 py-2.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
              />
            </div>
          </div>

          {/* Owner Details */}
          <div className="space-y-4 p-4 bg-bg-primary dark:bg-neutral-900/50 border border-gray-300 dark:border-neutral-800 rounded-xl">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-neutral-200">Your Account</h3>
            
            <div className="space-y-1">
              <label className="text-xs text-gray-700 dark:text-neutral-300">Your Name *</label>
              <input
                type="text"
                name="ownerName"
                required
                value={formData.ownerName}
                onChange={handleChange}
                placeholder="John Doe"
                className="w-full px-3 py-2.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-700 dark:text-neutral-300">Email *</label>
              <input
                type="email"
                name="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-gray-700 dark:text-neutral-300">Password *</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a strong password"
                  minLength={6}
                  className="w-full px-3 py-2.5 pr-10 rounded-lg bg-bg-secondary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
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
          </div>

          {/* Features List */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-primary mb-3">What's included in your trial:</h4>
            <div className="space-y-2 text-xs text-gray-700 dark:text-neutral-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span>Point of Sale (POS) system</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span>Inventory management</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span>Free public restaurant website</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary" />
                <span>Sales reports & analytics</span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating your account...
              </>
            ) : (
              <>
                <Store className="w-4 h-4" />
                Start Free Trial
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-900 dark:text-neutral-400">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-4 text-[10px] text-gray-800 dark:text-neutral-600 text-center leading-relaxed">
          By signing up, you agree to our Terms of Service and Privacy Policy.
          <br />
          Your 14-day trial starts immediately. Cancel anytime.
        </p>
      </div>
    </div>
  );
}
