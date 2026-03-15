/**
 * ONE-TIME MIGRATION: Move all PENDING/completed orders to ONLINE (Easypaisa).
 *
 * This is a thin proxy that accepts a Bearer token from the client-side migration page.
 * It calls the backend order-by-order to record payment.
 *
 * DELETE THIS FILE after running the migration.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: "No auth token" });

  const { orderIds, accountName } = req.body || {};
  if (!Array.isArray(orderIds) || !accountName) {
    return res.status(400).json({ error: "orderIds (array) and accountName (string) required" });
  }

  const headers = {
    "Content-Type": "application/json",
    Authorization: authHeader,
  };
  if (req.headers["x-tenant-slug"]) headers["x-tenant-slug"] = req.headers["x-tenant-slug"];
  if (req.headers["x-branch-id"]) headers["x-branch-id"] = req.headers["x-branch-id"];

  let success = 0;
  let failed = 0;
  const errors = [];

  for (const orderId of orderIds) {
    try {
      const payRes = await fetch(`${API_BASE}/api/admin/orders/${encodeURIComponent(orderId)}/payment`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ paymentMethod: "ONLINE", paymentProvider: accountName }),
      });
      if (payRes.ok) {
        success++;
      } else {
        failed++;
        const errBody = await payRes.text().catch(() => "");
        errors.push({ orderId, status: payRes.status, error: errBody.slice(0, 200) });
      }
    } catch (err) {
      failed++;
      errors.push({ orderId, error: err.message });
    }
  }

  return res.status(200).json({ success, failed, errors: errors.slice(0, 30) });
}
