// NOTE: Orders-related helpers below (getOrders, getNextStatuses, updateOrderStatus, getOrderHistory)
// still use in-memory mock data for now. They can be wired to real POS/order APIs later.

export async function getOrders() {
  return apiFetch("/api/admin/orders");
}

const STATUS_FLOW = ["UNPROCESSED", "PENDING", "READY", "COMPLETED", "CANCELLED"];

export function getNextStatuses(currentStatus) {
  if (currentStatus === "COMPLETED" || currentStatus === "CANCELLED") return [];
  const idx = STATUS_FLOW.indexOf(currentStatus);
  if (idx === -1) return [];
  // Return only the next status in the flow (not "CANCELLED" – that's a separate action)
  const next = STATUS_FLOW[idx + 1];
  return next && next !== "CANCELLED" ? [next] : [];
}

export async function updateOrderStatus(orderId, newStatus) {
  const updated = await apiFetch(`/api/admin/orders/${orderId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status: newStatus })
  });
  return updated;
}

// POS – create a new order via backend
export async function createPosOrder({ items, orderType, paymentMethod, discountAmount, customerName, customerPhone, deliveryAddress }) {
  return apiFetch("/api/pos/orders", {
    method: "POST",
    body: JSON.stringify({ items, orderType, paymentMethod, discountAmount, customerName, customerPhone, deliveryAddress })
  });
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const AUTH_STORAGE_KEY = "restaurantos_auth";
const TOKEN_COOKIE = "token";

export function getStoredAuth() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredAuth(next) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
}

export function clearStoredAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  // Also clear cookie used by middleware protection
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function getToken() {
  const auth = getStoredAuth();
  return auth?.token || null;
}

export function setTokenCookie(token) {
  if (typeof document === "undefined") return;
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(
    token
  )}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
}

export async function login(email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Login failed");
  }

  const data = await res.json();
  if (data.token && typeof window !== "undefined") {
    setTokenCookie(data.token);
  }
  return data;
}

export async function registerRestaurant(restaurantData) {
  const res = await fetch(`${API_BASE}/api/auth/register-restaurant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(restaurantData)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Registration failed");
  }

  const data = await res.json();
  if (data.token && typeof window !== "undefined") {
    setTokenCookie(data.token);
  }
  return data;
}

export class SubscriptionInactiveError extends Error {
  constructor(message) {
    super(message);
    this.name = "SubscriptionInactiveError";
  }
}

function getTenantSlugFromLocation() {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/r\/([^/]+)\/(?:[^/]+\/)?dashboard/);
  return match ? match[1] : null;
}

async function apiFetch(path, options = {}) {
  const auth = getStoredAuth();
  let token = auth?.token || null;
  const refreshToken = auth?.refreshToken || null;
  const tenantSlug = getTenantSlugFromLocation();

  async function doRequest(currentToken) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
    if (currentToken) headers.Authorization = `Bearer ${currentToken}`;
    if (tenantSlug) headers["x-tenant-slug"] = tenantSlug;

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });
    return res;
  }

  let res = await doRequest(token);

  // If unauthorized and we have a refresh token, try to refresh once
  if ((res.status === 401 || res.status === 403) && refreshToken) {
    try {
      const refreshRes = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken })
      });

      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        const updatedAuth = {
          ...(auth || {}),
          token: refreshData.token,
          refreshToken: refreshData.refreshToken
        };
        setStoredAuth(updatedAuth);
        if (refreshData.token && typeof window !== "undefined") {
          setTokenCookie(refreshData.token);
        }
        token = refreshData.token;
        res = await doRequest(token);
      } else {
        // Refresh failed – clear auth and bubble error
        clearStoredAuth();
      }
    } catch {
      clearStoredAuth();
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const message = err.message || "Request failed";
    const lower = message.toLowerCase();
    if (res.status === 401 || res.status === 403) {
      clearStoredAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
      const error = new Error(message);
      error.code = res.status;
      error.isAuthError = true;
      error.details = err;
      throw error;
    }
    if (res.status === 402 || lower.includes("subscription inactive") || lower.includes("subscription expired") || lower.includes("read-only mode")) {
      const subError = new SubscriptionInactiveError(message);
      subError.readonly = err.readonly || false;
      throw subError;
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

// FILE UPLOAD (multipart – skips JSON Content-Type)

export async function uploadImage(file) {
  const auth = getStoredAuth();
  const token = auth?.token || null;
  const tenantSlug = getTenantSlugFromLocation();

  const formData = new FormData();
  formData.append("image", file);

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantSlug) headers["x-tenant-slug"] = tenantSlug;

  const res = await fetch(`${API_BASE}/api/upload/image`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Image upload failed");
  }

  return res.json(); // { url, publicId }
}

// DASHBOARD & REPORTS (tenant)

export async function getOverview() {
  const summary = await apiFetch("/api/admin/dashboard/summary");
  return {
    totalOrders: summary.todaysOrdersCount ?? 0,
    pendingOrders: summary.todaysOrdersCount ?? 0, // placeholder until live order statuses are wired
    revenue: summary.todaysRevenue ?? 0,
    lowStockItems: summary.lowStockItems ?? []
  };
}

export async function getSalesReport({ from, to } = {}) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/api/admin/reports/sales${query}`);
}

export async function getMenu() {
  return apiFetch("/api/admin/menu");
}

export async function createCategory(data) {
  return apiFetch("/api/admin/categories", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function updateCategory(id, data) {
  return apiFetch(`/api/admin/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

export async function deleteCategory(id) {
  await apiFetch(`/api/admin/categories/${id}`, {
    method: "DELETE"
  });
  return true;
}

export async function createItem(data) {
  return apiFetch("/api/admin/items", {
    method: "POST",
    body: JSON.stringify({
      ...data,
      categoryId: data.categoryId
    })
  });
}

export async function updateItem(id, data) {
  return apiFetch(`/api/admin/items/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

export async function deleteItem(id) {
  await apiFetch(`/api/admin/items/${id}`, {
    method: "DELETE"
  });
  return true;
}

// USER MANAGEMENT

export async function getUsers() {
  return apiFetch("/api/admin/users");
}

export async function createUser(data) {
  return apiFetch("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function updateUser(id, data) {
  return apiFetch(`/api/admin/users/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

export async function deleteUser(id) {
  await apiFetch(`/api/admin/users/${id}`, {
    method: "DELETE"
  });
  return true;
}

// INVENTORY (tenant)

export async function getInventory() {
  return apiFetch("/api/admin/inventory");
}

export async function createInventoryItem(data) {
  return apiFetch("/api/admin/inventory", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function updateInventoryItem(id, data) {
  return apiFetch(`/api/admin/inventory/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

export async function deleteInventoryItem(id) {
  await apiFetch(`/api/admin/inventory/${id}`, {
    method: "DELETE"
  });
  return true;
}

// WEBSITE SETTINGS (tenant)

export async function getWebsiteSettings() {
  return apiFetch("/api/admin/website");
}

export async function updateWebsiteSettings(data) {
  return apiFetch("/api/admin/website", {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

// SUPER ADMIN

export async function getRestaurantsForSuperAdmin() {
  return apiFetch("/api/super/restaurants");
}

export async function createRestaurantForSuperAdmin(data) {
  return apiFetch("/api/super/restaurants", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function updateRestaurantSubscription(id, data) {
  return apiFetch(`/api/super/restaurants/${id}/subscription`, {
    method: "PATCH",
    body: JSON.stringify(data)
  });
}

// SUBSCRIPTION

export async function getSubscriptionStatus() {
  return apiFetch("/api/subscription/status");
}

export async function submitSubscriptionRequest(data) {
  return apiFetch("/api/subscription/request", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateSubscriptionScreenshot(requestId, paymentScreenshot) {
  return apiFetch(`/api/subscription/request/${requestId}/screenshot`, {
    method: "PUT",
    body: JSON.stringify({ paymentScreenshot }),
  });
}

export async function getSubscriptionHistory() {
  return apiFetch("/api/subscription/history");
}

// Super admin subscription management

export async function getSuperSubscriptionRequests(status = "pending") {
  return apiFetch(`/api/subscription/super/requests?status=${status}`);
}

export async function approveSubscriptionRequest(id) {
  return apiFetch(`/api/subscription/super/requests/${id}/approve`, {
    method: "PUT",
  });
}

export async function rejectSubscriptionRequest(id) {
  return apiFetch(`/api/subscription/super/requests/${id}/reject`, {
    method: "PUT",
  });
}

export async function getSuperSubscriptionHistory() {
  return apiFetch("/api/subscription/super/history");
}

// Payment methods (platform-level)

export async function getPaymentMethods() {
  return apiFetch("/api/subscription/payment-methods");
}

export async function getSuperPaymentMethods() {
  return apiFetch("/api/subscription/super/payment-methods");
}

export async function createPaymentMethod(data) {
  return apiFetch("/api/subscription/super/payment-methods", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updatePaymentMethod(id, data) {
  return apiFetch(`/api/subscription/super/payment-methods/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deletePaymentMethod(id) {
  return apiFetch(`/api/subscription/super/payment-methods/${id}`, {
    method: "DELETE",
  });
}

// INTEGRATIONS (Foodpanda etc.)

export async function getIntegrations() {
  return apiFetch("/api/integrations");
}

export async function saveIntegration(data) {
  return apiFetch("/api/integrations", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function toggleIntegration(id) {
  return apiFetch(`/api/integrations/${id}/toggle`, {
    method: "PUT"
  });
}

export async function deleteIntegration(id) {
  await apiFetch(`/api/integrations/${id}`, {
    method: "DELETE"
  });
  return true;
}

export async function getDeals() {
  return [
    {
      id: "d1",
      name: "Lunch Combo",
      description: "Any main + drink",
      discountPercent: 15,
      active: true
    },
    {
      id: "d2",
      name: "Happy Hour",
      description: "50% off starters 4–6pm",
      discountPercent: 50,
      active: false
    }
  ];
}

export async function getOrderHistory({ status, from, to } = {}) {
  let result = [...orders];

  if (status && status !== "ALL") {
    result = result.filter(o => o.status === status);
  }

  if (from) {
    const fromDate = new Date(from);
    result = result.filter(o => new Date(o.createdAt) >= fromDate);
  }

  if (to) {
    const toDate = new Date(to);
    result = result.filter(o => new Date(o.createdAt) <= toDate);
  }

  return result.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

