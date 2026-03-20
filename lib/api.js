/**
 * Public API for tenant websites
 * This file provides API functions for public-facing pages (restaurant websites)
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Fetch utility with error handling
 */
async function apiFetch(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`;
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Get public tenant/restaurant information (storefront config)
 * @param {string} slug - Restaurant subdomain/slug
 * @returns {Promise<Object>} Restaurant information
 */
export async function getPublicTenantInfo(slug) {
  const c = await apiFetch(`/api/storefront/${encodeURIComponent(slug)}/config`);
  return {
    name: c.name,
    website: {
      ...c,
      themeColors: c.themeColors,
    },
  };
}

/**
 * Get public menu for a restaurant
 * @param {string} slug - Restaurant subdomain/slug
 * @returns {Promise<Object>} Menu with categories and items
 */
export async function getPublicMenu(slug) {
  const data = await apiFetch(`/api/storefront/${encodeURIComponent(slug)}/menu`);
  return {
    categories: data.categories || [],
    items: data.menu || [],
    restaurant: data.restaurant,
    branches: data.branches,
  };
}

/**
 * Get a single menu item details
 * @param {string} slug - Restaurant subdomain/slug
 * @param {string} itemId - Menu item ID
 * @returns {Promise<Object>} Menu item details
 */
export async function getPublicMenuItem(slug, itemId) {
  const data = await getPublicMenu(slug);
  const item = (data.items || []).find((i) => i.id === itemId || i._id === itemId);
  if (!item) throw new Error('Menu item not found');
  return item;
}

/**
 * Get menu categories for a restaurant
 * @param {string} slug - Restaurant subdomain/slug
 * @returns {Promise<Array>} Categories array
 */
export async function getPublicCategories(slug) {
  const data = await getPublicMenu(slug);
  return data.categories || [];
}

/**
 * Create a public order (COD)
 * @param {string} slug - Restaurant subdomain/slug
 * @param {Object} orderData - Order details
 * @returns {Promise<Object>} Created order
 */
export async function createPublicOrder(slug, orderData) {
  return apiFetch(`/api/storefront/${encodeURIComponent(slug)}/orders`, {
    method: 'POST',
    body: JSON.stringify(orderData),
  });
}

/**
 * Get order details (for confirmation page)
 * @param {string} slug - Restaurant subdomain/slug
 * @param {string} orderId - Order ID
 * @returns {Promise<Object>} Order details
 */
export async function getPublicOrder(slug, orderId) {
  return apiFetch(`/api/public/restaurant/${slug}/orders/${orderId}`);
}

/**
 * Get active deals for a restaurant
 * @param {string} slug - Restaurant subdomain/slug
 * @returns {Promise<Array>} Active deals
 */
export async function getPublicDeals(slug) {
  return apiFetch(`/api/storefront/${encodeURIComponent(slug)}/deals`);
}

/**
 * Send a message to the storefront AI chat agent (when enabled in dashboard).
 */
export async function sendStorefrontChatMessage(slug, { message, sessionId }) {
  return apiFetch(`/api/storefront/${encodeURIComponent(slug)}/agent/chat`, {
    method: 'POST',
    body: JSON.stringify({ message, sessionId }),
  });
}

/**
 * Utility: Get image URL (handles both full URLs and relative paths)
 * @param {string} path - Image path or URL
 * @returns {string} Full image URL
 */
export function getImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/')) return path;
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

/**
 * Utility: Format price in PKR
 * @param {number} price - Price amount
 * @returns {string} Formatted price
 */
export function formatPrice(price) {
  return `Rs ${typeof price === 'number' ? price.toFixed(0) : price}`;
}

// Legacy compatibility - these were used in the hotel system, now mapped to menu
export const getPublicProperties = getPublicMenu;
export const getPublicProperty = getPublicMenuItem;
