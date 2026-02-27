import { useState } from "react";
import { useRouter } from "next/router";
import SEO from "../components/SEO";
import { verifyEmail } from "../lib/apiClient";

export default function VerifyEmailPage() {
  const router = useRouter();
  const initialEmail =
    (typeof router.query.email === "string" && router.query.email) || "";
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await verifyEmail({ email, otp: code.trim() });

      // Store auth data like login
      if (typeof window !== "undefined") {
        window.localStorage.setItem(
          "restaurantos_auth",
          JSON.stringify({
            user: data.user,
            token: data.token || null,
            refreshToken: data.refreshToken || null,
            tenantSlug: data.user?.restaurantSlug || null,
          }),
        );
      }

      router.push("/overview");
    } catch (err) {
      setError(err.message || "Verification failed");
      setLoading(false);
    }
  }

  return (
    <>
      <SEO
        title="Verify your email - Eats Desk"
        description="Enter the verification code sent to your email to activate your Eats Desk account."
      />
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black px-4">
        <div className="w-full max-w-md bg-white dark:bg-neutral-950 rounded-2xl shadow-xl border border-gray-200 dark:border-neutral-800 p-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            Verify your email
          </h1>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4">
            We&apos;ve sent a 6‑digit code to{" "}
            <span className="font-semibold">{email || "your email"}</span>.
            Enter it below to complete signup.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
              />
            </div>
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
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/[^0-9]/g, ""))
                }
                className="w-full px-3 py-2.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 tracking-[0.4em] text-center"
                placeholder="••••••"
              />
            </div>
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Verifying..." : "Verify email"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

