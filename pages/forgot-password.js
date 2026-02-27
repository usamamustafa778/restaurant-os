import { useState } from "react";
import SEO from "../components/SEO";
import { requestPasswordReset } from "../lib/apiClient";
import { useRouter } from "next/router";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setLoading(false);
      setMessage("If this email is registered, we have sent a reset code.");
      router.push({ pathname: "/reset-password", query: { email: email.trim() } });
    } catch (err) {
      setLoading(false);
      setError(err.message || "Failed to request reset");
    }
  }

  return (
    <>
      <SEO title="Forgot password - Eats Desk" />
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-black px-4">
        <div className="w-full max-w-md bg-white dark:bg-neutral-950 rounded-2xl shadow-xl border border-gray-200 dark:border-neutral-800 p-6">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            Forgot password
          </h1>
          <p className="text-xs text-gray-500 dark:text-neutral-400 mb-4">
            Enter your email and we&apos;ll send you a 6‑digit code to reset your password.
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
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
            {message && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                {message}
              </p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Sending..." : "Send reset code"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}

