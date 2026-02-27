// NOTE: Orders-related helpers below (getOrders, getNextStatuses, updateOrderStatus, getOrderHistory)
// still use in-memory mock data for now. They can be wired to real POS/order APIs later.

export async function getOrders() {
  return apiFetch("/api/admin/orders");
}

export async function getOrder(orderId) {
  return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}`);
}

export async function updateOrder(orderId, payload) {
  return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

const STATUS_FLOW = ["NEW_ORDER", "PROCESSING", "READY", "DELIVERED", "CANCELLED"];

const LEGACY_NEXT = { UNPROCESSED: "PROCESSING", PENDING: "READY", COMPLETED: "" };

export function getNextStatuses(currentStatus) {
  if (currentStatus === "DELIVERED" || currentStatus === "CANCELLED") return [];
  const legacyNext = LEGACY_NEXT[currentStatus];
  if (legacyNext) return legacyNext ? [legacyNext] : [];
  const idx = STATUS_FLOW.indexOf(currentStatus);
  if (idx === -1) return [];
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

export async function deleteOrder(orderId) {
  return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}`, {
    method: "DELETE"
  });
}

// POS – create a new order via backend (paymentMethod PENDING | CASH | CARD; CASH/CARD => order created as COMPLETED)
export async function createPosOrder({ items, orderType, paymentMethod, discountAmount, customerName, customerPhone, deliveryAddress, branchId, appliedDeals, tableName, amountReceived }) {
  const payload = {
    items,
    orderType,
    paymentMethod: paymentMethod === "CASH" || paymentMethod === "CARD" ? paymentMethod : "PENDING",
    discountAmount,
    customerName,
    customerPhone,
    deliveryAddress,
    appliedDeals
  };
  if (branchId) payload.branchId = branchId;
  if (tableName != null && tableName !== "") payload.tableName = tableName;
  if (paymentMethod === "CASH" && amountReceived != null) payload.amountReceived = amountReceived;
  return apiFetch("/api/pos/orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

// Record payment on order (cashier on Orders page): CASH with amountReceived/amountReturned, or CARD
export async function recordOrderPayment(orderId, { paymentMethod, amountReceived, amountReturned }) {
  const body = { paymentMethod };
  if (amountReceived != null) body.amountReceived = amountReceived;
  if (amountReturned != null) body.amountReturned = amountReturned;
  return apiFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/payment`, {
    method: "PUT",
    body: JSON.stringify(body)
  });
}

// POS DRAFTS
export async function getPosDrafts() {
  return apiFetch("/api/pos/drafts");
}

export async function createPosDraft(data) {
  return apiFetch("/api/pos/drafts", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function updatePosDraft(id, data) {
  return apiFetch(`/api/pos/drafts/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

export async function deletePosDraft(id) {
  await apiFetch(`/api/pos/drafts/${id}`, {
    method: "DELETE"
  });
  return true;
}

export async function getPosDraft(id) {
  return apiFetch(`/api/pos/drafts/${id}`);
}

// POS TRANSACTIONS (Previous Sales)
export async function getPosTransactions(params = {}) {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  if (params.status) query.set("status", params.status);
  const queryString = query.toString() ? `?${query.toString()}` : "";
  return apiFetch(`/api/pos/transactions${queryString}`);
}

export async function getPosTransaction(id) {
  return apiFetch(`/api/pos/transactions/${id}`);
}

export async function deletePosTransaction(id) {
  await apiFetch(`/api/pos/transactions/${id}`, {
    method: "DELETE"
  });
  return true;
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
const AUTH_STORAGE_KEY = "restaurantos_auth";
const BRANCH_STORAGE_KEY = "restaurantos_branch_id";
const ACTING_AS_COOKIE = "restaurantos_acting_as";
const TOKEN_COOKIE = "token";
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "";

// Build the domain part for cookies so they work across all subdomains.
// Only set the root domain when actually on that domain (not on localhost).
function getCookieDomain() {
  if (ROOT_DOMAIN && typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname.endsWith(ROOT_DOMAIN)) {
      return `; domain=.${ROOT_DOMAIN}`;
    }
  }
  return "";
}

/**
 * Try to build auth from legacy/alternate localStorage keys (e.g. accessToken, refreshToken, user).
 * Returns null if not found or invalid. Does not write to storage.
 */
function getLegacyAuth() {
  if (typeof window === "undefined") return null;
  try {
    const token =
      window.localStorage.getItem("accessToken") ||
      window.localStorage.getItem("token") ||
      null;
    const refreshToken = window.localStorage.getItem("refreshToken") || null;
    const userRaw = window.localStorage.getItem("user") || null;
    if (!token) return null;
    let user = null;
    if (userRaw) {
      try {
        user = typeof userRaw === "string" ? JSON.parse(userRaw) : userRaw;
      } catch {
        user = null;
      }
    }
    let tenantSlug = user?.tenantSlug ?? null;
    if (!tenantSlug && token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        tenantSlug = payload.tenantSlug || null;
        if (!user) user = {};
        if (payload.role != null) user.role = payload.role;
        if (payload.id != null) user.id = payload.id;
        if (payload.name != null) user.name = payload.name;
        if (payload.email != null) user.email = payload.email;
      } catch {
        /* ignore */
      }
    }
    return {
      token,
      refreshToken: refreshToken || null,
      user: user || {},
      tenantSlug,
    };
  } catch {
    return null;
  }
}

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

/** Build auth from legacy keys only. Used by login page to migrate once; never auto-called from getStoredAuth to avoid redirect loops. */
export function getLegacyAuthOnly() {
  return getLegacyAuth();
}

export function setStoredAuth(next) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
}

export function clearStoredAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  // Clear legacy keys so we don't re-migrate and cause redirect loops after 401
  window.localStorage.removeItem("accessToken");
  window.localStorage.removeItem("token");
  window.localStorage.removeItem("refreshToken");
  window.localStorage.removeItem("user");
  // Clear cookie on root domain (shared across subdomains) and current domain
  const domainPart = getCookieDomain();
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax${domainPart}`;
  // Also clear on current hostname in case it was set without domain
  document.cookie = `${TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

/** Super admin: set acting-as restaurant (subdomain). Sets cookie for middleware and tenantSlug in auth. */
export function setActingAsRestaurant(subdomain) {
  if (typeof window === "undefined" || !subdomain) return;
  const domainPart = getCookieDomain();
  document.cookie = `${ACTING_AS_COOKIE}=${encodeURIComponent(subdomain)}; path=/; max-age=86400; SameSite=Lax${domainPart}`;
  document.cookie = `${ACTING_AS_COOKIE}=${encodeURIComponent(subdomain)}; path=/; max-age=86400; SameSite=Lax`;
  const auth = getStoredAuth();
  if (auth) {
    const next = {
      ...auth,
      tenantSlug: subdomain,
      user: { ...(auth.user || {}), tenantSlug: subdomain },
    };
    setStoredAuth(next);
  }
}

/** Super admin: clear acting-as and return to platform context. */
export function clearActingAsRestaurant() {
  if (typeof window === "undefined") return;
  const domainPart = getCookieDomain();
  document.cookie = `${ACTING_AS_COOKIE}=; path=/; max-age=0; SameSite=Lax${domainPart}`;
  document.cookie = `${ACTING_AS_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  const auth = getStoredAuth();
  if (auth) {
    const { tenantSlug, ...restUser } = auth.user || {};
    const next = { ...auth, tenantSlug: null, user: restUser };
    setStoredAuth(next);
  }
}

/** Read acting-as slug from cookie (client-side). Middleware reads the same cookie name. */
export function getActingAsSlug() {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${ACTING_AS_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function getToken() {
  const auth = getStoredAuth();
  return auth?.token || null;
}

/** Decode JWT and check exp (with 30s buffer). Returns true if token exists and is not expired. */
export function isAccessTokenValid(token) {
  if (!token || typeof token !== "string") return false;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload?.exp;
    if (!exp) return true; // no exp claim → treat as valid
    return exp * 1000 > Date.now() + 30 * 1000; // 30s buffer
  } catch {
    return false;
  }
}

/** Try to refresh stored auth using refreshToken. Updates storage and returns true on success. */
export async function tryRefreshStoredAuth() {
  const auth = getStoredAuth();
  const refreshToken = auth?.refreshToken || null;
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken })
    });
    if (!res.ok) return false;
    const data = await res.json();
    const updated = {
      ...(auth || {}),
      token: data.token ?? auth?.token,
      refreshToken: data.refreshToken ?? refreshToken
    };
    setStoredAuth(updated);
    if (data.token && typeof window !== "undefined") {
      setTokenCookie(data.token);
    }
    return true;
  } catch {
    clearStoredAuth();
    return false;
  }
}

export function setTokenCookie(token) {
  if (typeof document === "undefined") return;
  const domainPart = getCookieDomain();
  document.cookie = `${TOKEN_COOKIE}=${encodeURIComponent(
    token
  )}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax${domainPart}`;
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
  return data;
}

async function handleResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || "Request failed");
  }
  return data;
}

export async function verifyEmail(payload) {
  const res = await fetch(`${API_BASE}/api/auth/verify-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse(res);
}

export async function requestPasswordReset(email) {
  const res = await fetch(`${API_BASE}/api/auth/request-password-reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse(res);
}

export async function resetPassword({ email, otp, newPassword }) {
  const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp, newPassword }),
  });
  return handleResponse(res);
}

export async function resendVerificationEmail(email) {
  const res = await fetch(`${API_BASE}/api/auth/request-password-reset`, {
    // For now, backend already resends verification OTP on login;
    // this helper is left as a placeholder if a dedicated resend endpoint is added.
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse(res);
}

export class SubscriptionInactiveError extends Error {
  constructor(message) {
    super(message);
    this.name = "SubscriptionInactiveError";
  }
}

function getTenantSlugFromLocation() {
  if (typeof window === "undefined") return null;

  // Primary source: stored auth (dashboard pages always get tenant from JWT/auth)
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const auth = JSON.parse(raw);
      const slug = auth?.user?.tenantSlug || auth?.tenantSlug || null;
      if (slug) return slug;
    }
  } catch { /* ignore */ }

  // Fallback: subdomain mode for customer website (e.g. urbanspoon.sufieats.com)
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "";
  if (rootDomain) {
    const hostname = window.location.hostname;
    if (hostname.endsWith(rootDomain)) {
      const prefix = hostname.slice(0, -(rootDomain.length + 1));
      if (prefix && prefix !== "www" && !prefix.includes(".")) {
        return prefix;
      }
    }
  }

  return null;
}

/** Current branch id for dashboard requests (from BranchContext / localStorage). */
export function getCurrentBranchId() {
  if (typeof window === "undefined") return null;
  const id = window.localStorage.getItem(BRANCH_STORAGE_KEY);
  return id && id !== "all" ? id : null;
}

async function apiFetch(path, options = {}) {
  const auth = getStoredAuth();
  let token = auth?.token || null;
  const refreshToken = auth?.refreshToken || null;
  const tenantSlug = getTenantSlugFromLocation();
  const branchId = getCurrentBranchId();

  async function doRequest(currentToken) {
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
    if (currentToken) headers.Authorization = `Bearer ${currentToken}`;
    if (tenantSlug) headers["x-tenant-slug"] = tenantSlug;
    if (branchId) headers["x-branch-id"] = branchId;

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

// PROFILE

export async function getProfile() {
  return apiFetch("/api/profile");
}

export async function updateProfile(data) {
  return apiFetch("/api/profile", { method: "PUT", body: JSON.stringify(data) });
}

export async function changePassword(data) {
  return apiFetch("/api/profile/password", { method: "PUT", body: JSON.stringify(data) });
}

export async function uploadAvatar(file) {
  const auth = getStoredAuth();
  const token = auth?.token || null;
  const tenantSlug = getTenantSlugFromLocation();

  const formData = new FormData();
  formData.append("image", file);

  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantSlug) headers["x-tenant-slug"] = tenantSlug;

  const res = await fetch(`${API_BASE}/api/profile/avatar`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || "Avatar upload failed");
  }

  return res.json(); // { profileImageUrl, publicId }
}

export async function removeAvatar() {
  return apiFetch("/api/profile/avatar", { method: "DELETE" });
}

// DASHBOARD & REPORTS (tenant)

export async function getOverview() {
  const summary = await apiFetch("/api/admin/dashboard/summary");
  return {
    totalOrders: summary.todaysOrdersCount ?? 0,
    pendingOrders: summary.pendingOrdersCount ?? 0,
    revenue: summary.todaysRevenue ?? 0,
    totalBudgetCost: summary.totalBudgetCost ?? 0,
    totalProfit: summary.totalProfit ?? 0,
    lowStockItems: summary.lowStockItems ?? [],
    hourlySales: summary.hourlySales ?? new Array(24).fill(0),
    salesTypeDistribution: summary.salesTypeDistribution ?? {},
    paymentDistribution: summary.paymentDistribution ?? {},
    sourceDistribution: summary.sourceDistribution ?? {},
    topProducts: summary.topProducts ?? [],
    productsPerformance: summary.productsPerformance ?? [],
  };
}

export async function getDayReport(date) {
  const params = new URLSearchParams();
  if (date) params.set("date", date);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/api/admin/reports/day${query}`);
}

export async function getSalesReport({ from, to } = {}) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString() ? `?${params.toString()}` : "";
  return apiFetch(`/api/admin/reports/sales${query}`);
}

/** Get daily currency note counts for a date (YYYY-MM-DD). */
export async function getDailyCurrency(date) {
  const query = date ? `?date=${encodeURIComponent(date)}` : "";
  return apiFetch(`/api/admin/currency/daily${query}`);
}

/** Save daily currency note counts; only allowed for today or yesterday. */
export async function saveDailyCurrency(date, quantities) {
  return apiFetch("/api/admin/currency/daily", {
    method: "PUT",
    body: JSON.stringify({ date, quantities }),
  });
}

export async function getMenu(branchId) {
  const query = branchId && branchId !== "all" ? `?branchId=${encodeURIComponent(branchId)}` : "";
  return apiFetch(`/api/admin/menu${query}`);
}

// Branch-aware menu (uses finalPrice and finalAvailable)
export async function getBranchMenu(branchId, restaurantId) {
  const params = new URLSearchParams();
  if (restaurantId) params.set("restaurantId", restaurantId);
  const query = params.toString() ? `?${params.toString()}` : "";
  const data = await apiFetch(`/api/menu/branch/${branchId}/by-category${query}`);
  
  // Transform to match the format expected by getMenu()
  const categories = data || [];
  const items = categories.flatMap(cat => 
    (cat.items || []).map(item => ({
      ...item,
      categoryId: cat._id || cat.id
    }))
  );
  
  return {
    categories: categories.map(cat => ({
      id: cat._id || cat.id,
      name: cat.name,
      description: cat.description,
      isActive: cat.isActive,
      createdAt: cat.createdAt
    })),
    items: items.map(item => ({
      id: item._id || item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      finalPrice: item.finalPrice,
      finalAvailable: item.finalAvailable,
      available: item.available,
      hasBranchOverride: item.hasBranchOverride,
      branchPriceOverride: item.branchOverride?.priceOverride,
      branchAvailable: item.branchOverride?.available,
      availableAtAllBranches: item.availableAtAllBranches,
      categoryId: item.categoryId,
      imageUrl: item.imageUrl,
      isFeatured: item.isFeatured,
      isBestSeller: item.isBestSeller,
      dietaryType: item.dietaryType || 'non_veg',
      inventoryConsumptions: item.inventoryConsumptions,
      inventorySufficient: item.inventorySufficient,
      insufficientIngredients: item.insufficientIngredients,
      createdAt: item.createdAt
    }))
  };
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

// Branch copy: list categories/items from another branch (for bulk copy UI)
export async function getSourceBranchMenu(sourceBranchId) {
  const params = new URLSearchParams({ sourceBranchId });
  return apiFetch(`/api/admin/branch-copy/menu?${params.toString()}`);
}

// Copy selected categories and items from source branch to current branch (x-branch-id)
export async function copyMenuFromBranch(sourceBranchId, { categoryIds = [], itemIds = [] }) {
  return apiFetch("/api/admin/branch-copy/menu", {
    method: "POST",
    body: JSON.stringify({ sourceBranchId, categoryIds, itemIds })
  });
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

// Branch inventory copy (definitions + per-branch stock=0)
export async function getSourceBranchInventory(sourceBranchId) {
  const params = new URLSearchParams({ sourceBranchId });
  return apiFetch(`/api/admin/branch-copy/inventory?${params.toString()}`);
}

export async function copyInventoryFromBranch(sourceBranchId, { itemIds = [] }) {
  return apiFetch("/api/admin/branch-copy/inventory", {
    method: "POST",
    body: JSON.stringify({ sourceBranchId, itemIds }),
  });
}

// WEBSITE SETTINGS (tenant)

export async function getWebsiteSettings() {
  return apiFetch("/api/admin/website");
}

export async function updateWebsiteSettings(data) {
  return apiFetch("/api/admin/website", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// RESTAURANT SETTINGS (tenant-wide, shared across branches)

export async function getRestaurantSettings() {
  return apiFetch("/api/admin/settings");
}

export async function updateRestaurantSettings(data) {
  return apiFetch("/api/admin/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// BRANCHES (tenant-scoped; backend returns { branches: [...] } or array)
export async function getBranches() {
  const data = await apiFetch("/api/admin/branches");
  return data;
}

export async function getDeletedBranches() {
  const data = await apiFetch("/api/admin/branches/deleted");
  return data;
}

export async function getBranch(id) {
  const data = await apiFetch(`/api/admin/branches/${id}`);
  return data;
}

export async function updateBranch(id, data) {
  const res = await apiFetch(`/api/admin/branches/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
  return res;
}

// Tables (simple: name + isAvailable)
export async function getTables() {
  const data = await apiFetch("/api/admin/tables");
  return data?.tables ?? [];
}

export async function createTable(data) {
  return apiFetch("/api/admin/tables", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTable(id, data) {
  return apiFetch(`/api/admin/tables/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteTable(id) {
  await apiFetch(`/api/admin/tables/${id}`, { method: "DELETE" });
  return true;
}

export async function createBranch(data) {
  return apiFetch("/api/admin/branches", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function deleteBranch(id) {
  await apiFetch(`/api/admin/branches/${id}`, {
    method: "DELETE",
  });
  return true;
}

export async function restoreBranch(id) {
  return apiFetch(`/api/admin/branches/${id}/restore`, {
    method: "POST",
  });
}

// CUSTOMERS (branch-scoped; ?allBranches=true for owner cross-branch view)
export async function getCustomers(allBranches = false) {
  const q = allBranches ? "?allBranches=true" : "";
  return apiFetch(`/api/admin/customers${q}`);
}

export async function getCustomer(id) {
  return apiFetch(`/api/admin/customers/${id}`);
}

export async function createCustomer(data) {
  return apiFetch("/api/admin/customers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateCustomer(id, data) {
  return apiFetch(`/api/admin/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteCustomer(id) {
  await apiFetch(`/api/admin/customers/${id}`, { method: "DELETE" });
  return true;
}

// BRANCH MENU OVERRIDES (NEW API - branch-aware)
export async function setBranchPrice(branchId, menuItemId, priceOverride) {
  return apiFetch(`/api/menu/branch/${branchId}/item/${menuItemId}/price`, {
    method: "POST",
    body: JSON.stringify({ priceOverride })
  });
}

export async function setBranchAvailability(branchId, menuItemId, available) {
  return apiFetch(`/api/menu/branch/${branchId}/item/${menuItemId}/availability`, {
    method: "POST",
    body: JSON.stringify({ available })
  });
}

export async function clearBranchOverride(branchId, menuItemId) {
  await apiFetch(`/api/menu/branch/${branchId}/item/${menuItemId}/override`, {
    method: "DELETE"
  });
  return true;
}

// LEGACY BRANCH MENU OVERRIDES (keep for backward compatibility)
export async function getBranchMenuOverrides() {
  return apiFetch("/api/admin/branch-menu");
}

export async function updateBranchMenuItem(menuItemId, data) {
  // Get current branch from context
  const branchId = getCurrentBranchId();
  if (!branchId) {
    throw new Error("No branch selected");
  }
  
  // Use new API endpoints based on what's being updated
  if (data.priceOverride !== undefined) {
    await setBranchPrice(branchId, menuItemId, data.priceOverride);
  }
  if (data.available !== undefined) {
    await setBranchAvailability(branchId, menuItemId, data.available);
  }
  
  return { success: true };
}

export async function deleteBranchMenuItem(menuItemId) {
  const branchId = getCurrentBranchId();
  if (!branchId) {
    throw new Error("No branch selected");
  }
  await clearBranchOverride(branchId, menuItemId);
  return true;
}

// SUPER ADMIN

/** Public: submit contact/lead form (no auth). */
export async function submitContact(data) {
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "";
  const res = await fetch(`${API_BASE}/api/contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.message || "Failed to send message");
  return out;
}

export async function getRestaurantsForSuperAdmin() {
  return apiFetch("/api/super/restaurants");
}

// Super admin: users
export async function getUsersForSuperAdmin() {
  return apiFetch("/api/super/users");
}

export async function createUserForSuperAdmin(data) {
  return apiFetch("/api/super/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/** Super admin: list contact form leads. */
export async function getLeadsForSuperAdmin() {
  const data = await apiFetch("/api/super/leads");
  return data?.leads ?? [];
}

/** Super admin: list soft-deleted restaurants (last 48 hours). */
export async function getDeletedRestaurantsForSuperAdmin() {
  const data = await apiFetch("/api/super/restaurants/deleted");
  return data?.restaurants ?? [];
}

/** Super admin: soft-delete restaurant (recoverable within 48 hours). */
export async function deleteRestaurantForSuperAdmin(id) {
  return apiFetch(`/api/super/restaurants/${id}`, { method: "DELETE" });
}

/** Super admin: restore a soft-deleted restaurant within 48 hours. */
export async function restoreRestaurantForSuperAdmin(id) {
  return apiFetch(`/api/super/restaurants/${id}/restore`, { method: "POST" });
}

/** Super admin: list all branches across all restaurants. */
export async function getSuperBranches() {
  return apiFetch("/api/super/branches");
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

export async function deleteSubscriptionScreenshot(requestId) {
  return apiFetch(`/api/subscription/request/${requestId}/screenshot`, {
    method: "DELETE",
  });
}

export async function deleteSubscriptionRequest(requestId) {
  return apiFetch(`/api/subscription/request/${requestId}`, {
    method: "DELETE",
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

// DEALS & PROMOTIONS

export async function getDeals() {
  return apiFetch("/api/admin/deals");
}

export async function getActiveDealsByBranch(branchId) {
  const params = branchId ? `?branchId=${branchId}` : "";
  return apiFetch(`/api/deals/active${params}`);
}

export async function getDeal(id) {
  return apiFetch(`/api/admin/deals/${id}`);
}

export async function createDeal(data) {
  return apiFetch("/api/admin/deals", {
    method: "POST",
    body: JSON.stringify(data)
  });
}

export async function updateDeal(id, data) {
  return apiFetch(`/api/admin/deals/${id}`, {
    method: "PUT",
    body: JSON.stringify(data)
  });
}

export async function deleteDeal(id) {
  await apiFetch(`/api/admin/deals/${id}`, {
    method: "DELETE"
  });
  return true;
}

export async function toggleDeal(id) {
  return apiFetch(`/api/admin/deals/${id}/toggle`, {
    method: "POST"
  });
}

export async function getDealUsageStats(id) {
  return apiFetch(`/api/admin/deals/${id}/usage`);
}

export async function checkDealEligibility(dealId, customerId, orderItems) {
  return apiFetch(`/api/deals/${dealId}/check-eligibility`, {
    method: "POST",
    body: JSON.stringify({ customerId, orderItems })
  });
}

export async function findApplicableDeals(orderItems, subtotal, customerId, branchId) {
  return apiFetch("/api/deals/find-applicable", {
    method: "POST",
    body: JSON.stringify({ orderItems, subtotal, customerId, branchId })
  });
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

