import Head from "next/head";
import { useState, useRef, useEffect, useCallback } from "react";
import { Phone, Mail, MapPin, Clock, Facebook, Instagram, Twitter, Youtube, ChevronLeft, ChevronRight, Star, ShoppingBag, X, Plus, Minus, ShoppingCart, Trash2, ArrowRight, CheckCircle, AlertTriangle, ChevronDown, Tag, Sparkles } from "lucide-react";
import SectionSlider from "../../components/website/SectionSlider";
import WebsiteSectionsView from "../../components/website/WebsiteSectionsView";

function groupByCategory(menu) {
  const byCategory = {};
  for (const item of menu) {
    const key = item.category || "Menu";
    if (!byCategory[key]) byCategory[key] = [];
    byCategory[key].push(item);
  }
  return byCategory;
}

/* ─────────────────────────────────────────────
   Item Detail Modal
   ───────────────────────────────────────────── */
function ItemDetailModal({ item, onClose, onAddToCart, primaryColor }) {
  const [qty, setQty] = useState(1);
  if (!item) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 bg-white rounded-full p-1.5 shadow-lg hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>

        <div className="md:flex">
          {/* Image */}
          <div className="md:w-1/2 h-64 md:h-auto bg-gray-100 relative flex-shrink-0">
            {item.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover md:rounded-l-2xl" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-6xl md:rounded-l-2xl">
                🍽
              </div>
            )}
          </div>

          {/* Details */}
          <div className="md:w-1/2 p-6 pt-10 md:pt-6 flex flex-col justify-between">
            <div className="flex flex-col gap-0 ">

            <div className="flex items-start justify-between gap-3 mb-2 pr-8">
              <h2 className="text-2xl font-bold text-gray-900">{item.name}</h2>
              <span className="text-2xl font-black whitespace-nowrap" style={{ color: primaryColor }}>
                PKR {item.price}
              </span>
            </div>

            <p className="text-sm text-gray-500 mb-1">{item.category}</p>

            <p className="text-sm text-gray-600 leading-relaxed mt-4 mb-6">
              {item.description || "A delicious item from our menu. Order now and enjoy!"}
            </p>
            </div>


            {/* Quantity Picker */}
            <div>

            <div className="flex items-center gap-4 mb-6">
              <span className="text-sm font-semibold text-gray-700">Quantity</span>
              <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setQty(Math.max(1, qty - 1))}
                  className="px-3 py-2 hover:bg-gray-100 transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="px-4 py-2 text-sm font-semibold min-w-[40px] text-center border-x border-gray-300">
                  {qty}
                </span>
                <button
                  onClick={() => setQty(qty + 1)}
                  className="px-3 py-2 hover:bg-gray-100 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Add to Cart Button */}
            <button
              onClick={() => { onAddToCart(item, qty); onClose(); }}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold text-base hover:opacity-90 transition-opacity"
              style={{ backgroundColor: primaryColor }}
            >
              <ShoppingCart className="w-5 h-5" />
              Add to Cart — PKR {(item.price * qty).toLocaleString()}
            </button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Cart Drawer
   ───────────────────────────────────────────── */
function CartDrawer({ cart, onClose, onUpdateQty, onRemove, onCheckout, primaryColor }) {
  const total = cart.reduce((sum, c) => sum + c.item.price * c.qty, 0);

  return (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" />
            Your Cart ({cart.length})
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-5">
          {cart.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Your cart is empty</p>
            </div>
          ) : (
            <div className="space-y-4">
              {cart.map((c, idx) => (
                <div key={idx} className="flex gap-3 bg-gray-50 rounded-xl p-3">
                  {c.item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.item.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-gray-200 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-gray-900 truncate">{c.item.name}</h4>
                      <button onClick={() => onRemove(idx)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-xs text-gray-500">PKR {c.item.price}</p>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
                        <button onClick={() => onUpdateQty(idx, Math.max(1, c.qty - 1))} className="px-2 py-1 hover:bg-gray-100 text-xs">
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 py-1 text-xs font-semibold border-x border-gray-200">{c.qty}</span>
                        <button onClick={() => onUpdateQty(idx, c.qty + 1)} className="px-2 py-1 hover:bg-gray-100 text-xs">
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-sm font-bold" style={{ color: primaryColor }}>PKR {(c.item.price * c.qty).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="border-t px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total</span>
              <span className="text-xl font-black" style={{ color: primaryColor }}>PKR {total.toLocaleString()}</span>
            </div>
            <button
              onClick={onCheckout}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold hover:opacity-90 transition-opacity"
              style={{ backgroundColor: primaryColor }}
            >
              Proceed to Checkout
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Checkout Modal
   ───────────────────────────────────────────── */
function CheckoutModal({ cart, restaurant, allowOrders, onClose, onOrderPlaced, onBlocked, primaryColor, subdomain, branchId }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const total = cart.reduce((sum, c) => sum + c.item.price * c.qty, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!phone.trim()) { setError("Phone number is required"); return; }
    setError("");
    setSubmitting(true);

    try {
      const base = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_API_BASE_URL || "") : "";
      const body = {
        subdomain,
        customerName: name,
        customerPhone: phone,
        deliveryAddress: address,
        items: cart.map(c => ({ menuItemId: c.item.id, quantity: c.qty })),
      };
      if (branchId) body.branchId = branchId;
      const res = await fetch(`${base}/api/orders/website`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        // If 403 and ordering is blocked, show the blocked modal
        if (res.status === 403 && onBlocked) {
          onBlocked();
          return;
        }
        throw new Error(err.message || "Failed to place order");
      }

      const data = await res.json();
      onOrderPlaced(data);
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-3 right-3 z-10 bg-white rounded-full p-1.5 shadow hover:bg-gray-100">
          <X className="w-5 h-5 text-gray-600" />
        </button>

        {/* Blocked state */}
        {!allowOrders ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Ordering Temporarily Unavailable</h2>
            <p className="text-sm text-gray-600 mb-6">
              Online ordering is temporarily blocked. Please contact us directly to place your order.
            </p>
            <div className="space-y-3 text-left bg-gray-50 rounded-xl p-4">
              {restaurant?.contactPhone && (
                <a href={`tel:${restaurant.contactPhone}`} className="flex items-center gap-3 text-sm text-gray-700 hover:text-gray-900">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primaryColor}15` }}>
                    <Phone className="w-4 h-4" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Call us</p>
                    <p className="font-semibold">{restaurant.contactPhone}</p>
                  </div>
                </a>
              )}
              {restaurant?.contactEmail && (
                <a href={`mailto:${restaurant.contactEmail}`} className="flex items-center gap-3 text-sm text-gray-700 hover:text-gray-900">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${primaryColor}15` }}>
                    <Mail className="w-4 h-4" style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Email us</p>
                    <p className="font-semibold">{restaurant.contactEmail}</p>
                  </div>
                </a>
              )}
            </div>
            <button
              onClick={onClose}
              className="mt-6 w-full py-2.5 rounded-xl border-2 font-semibold text-sm hover:bg-gray-50 transition-colors"
              style={{ borderColor: primaryColor, color: primaryColor }}
            >
              Go Back
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1">Checkout</h2>
            <p className="text-sm text-gray-500 mb-5">Cash on Delivery</p>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
            )}

            {/* Order Summary */}
            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Order Summary</h3>
              <div className="space-y-2">
                {cart.map((c, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">{c.item.name} x{c.qty}</span>
                    <span className="font-semibold text-gray-900">PKR {(c.item.price * c.qty).toLocaleString()}</span>
                  </div>
                ))}
                <div className="pt-2 mt-2 border-t border-gray-200 flex items-center justify-between">
                  <span className="font-bold text-gray-900">Total</span>
                  <span className="text-lg font-black" style={{ color: primaryColor }}>PKR {total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="03XX-XXXXXXX"
                  required
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                  style={{ '--tw-ring-color': primaryColor }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Your Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1 block">Delivery Address</label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Enter your delivery address"
                  rows={2}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:border-transparent resize-none"
                />
              </div>
            </div>

            {/* Payment */}
            <div className="bg-gray-50 rounded-xl p-4 mb-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Payment Method</h3>
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border-2 bg-white" style={{ borderColor: primaryColor }}>
                <div className="w-5 h-5 rounded-full border-4 flex-shrink-0" style={{ borderColor: primaryColor }} />
                <span className="text-sm font-semibold text-gray-900">Cash on Delivery</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
              style={{ backgroundColor: primaryColor }}
            >
              {submitting ? "Placing Order..." : "Place Order"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Order Success Modal
   ───────────────────────────────────────────── */
function OrderSuccessModal({ orderData, onClose, primaryColor }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: `${primaryColor}15` }}>
          <CheckCircle className="w-8 h-8" style={{ color: primaryColor }} />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Order Placed!</h2>
        <p className="text-sm text-gray-500 mb-4">Your order has been submitted successfully.</p>
        <div className="bg-gray-50 rounded-xl p-4 mb-5 text-left space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Order Number</span>
            <span className="font-bold text-gray-900">{orderData.orderNumber}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total</span>
            <span className="font-bold" style={{ color: primaryColor }}>PKR {orderData.total?.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Payment</span>
            <span className="font-semibold text-gray-900">Cash on Delivery</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-xl text-white font-bold hover:opacity-90 transition-opacity"
          style={{ backgroundColor: primaryColor }}
        >
          Continue Browsing
        </button>
      </div>
    </div>
  );
}

/* ═════════════════════════════════════════════
   Main Page Component
   ═════════════════════════════════════════════ */
export default function TenantWebsitePage({ restaurant, menu, categories, branches = [], deals = [], suspended }) {
  const grouped = groupByCategory(menu);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState(() => (branches.length > 0 ? branches[0] : null));

  // Cart & modal state
  const [cart, setCart] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showCart, setShowCart] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showBlockedModal, setShowBlockedModal] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const hasMultipleBranches = branches.length > 1;
  
  const featuredItems = menu.filter(item => item.isFeatured).slice(0, 8);
  const bestSellers = menu.filter(item => item.isBestSeller).slice(0, 6);
  const heroSlides = restaurant?.heroSlides?.filter(slide => slide.isActive) || [];
  const websiteSections = restaurant?.websiteSections || [];
  const allowOrders = restaurant?.allowWebsiteOrders !== false;
  
  const primaryColor = restaurant?.themeColors?.primary || '#EF4444';
  const secondaryColor = restaurant?.themeColors?.secondary || '#FFA500';

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % Math.max(heroSlides.length, 1));
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + Math.max(heroSlides.length, 1)) % Math.max(heroSlides.length, 1));
  };

  // Cart helpers
  const addToCart = (item, qty) => {
    setCart(prev => {
      const existing = prev.findIndex(c => c.item.id === item.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ...updated[existing], qty: updated[existing].qty + qty };
        return updated;
      }
      return [...prev, { item, qty }];
    });
  };

  const updateCartQty = (index, newQty) => {
    setCart(prev => prev.map((c, i) => i === index ? { ...c, qty: newQty } : c));
  };

  const removeFromCart = (index) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  const handleCheckout = async () => {
    setShowCart(false);
    // Re-check latest ordering status from the API before showing checkout
    try {
      const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
      const res = await fetch(`${base}/api/menu?subdomain=${encodeURIComponent(restaurant?.subdomain || "")}`);
      if (res.ok) {
        const data = await res.json();
        if (data.restaurant?.allowWebsiteOrders === false) {
          setShowBlockedModal(true);
          return;
        }
      }
    } catch {
      // If check fails, proceed with checkout and let the submit handle errors
    }
    setShowCheckout(true);
  };

  const handleOrderPlaced = (data) => {
    setShowCheckout(false);
    setCart([]);
    setOrderSuccess(data);
  };

  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

  // Click handler for any item anywhere on the page
  const openItem = (item) => setSelectedItem(item);

  if (suspended) {
    return (
      <>
        <Head>
          <title>Restaurant Suspended &bull; Eats Desk</title>
        </Head>
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-amber-200 px-6 py-8 text-center">
            <h1 className="text-xl font-semibold text-amber-900 mb-2">Restaurant temporarily unavailable</h1>
            <p className="text-sm text-amber-800">
              This restaurant&apos;s account is currently suspended because the subscription is inactive
              or expired. Please check back later or contact the restaurant directly.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{restaurant?.name || "Restaurant"} &bull; Eats Desk</title>
        <meta
          name="description"
          content={restaurant?.description || "Order delicious food online"}
        />
        <style>{`
          :root {
            --primary-color: ${primaryColor};
            --secondary-color: ${secondaryColor};
          }
        `}</style>
      </Head>

      {/* Modals */}
      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onAddToCart={addToCart}
          primaryColor={primaryColor}
        />
      )}
      {showCart && (
        <CartDrawer
          cart={cart}
          onClose={() => setShowCart(false)}
          onUpdateQty={updateCartQty}
          onRemove={removeFromCart}
          onCheckout={handleCheckout}
          primaryColor={primaryColor}
        />
      )}
      {showBlockedModal && (
        <CheckoutModal
          cart={[]}
          restaurant={restaurant}
          allowOrders={false}
          onClose={() => setShowBlockedModal(false)}
          onOrderPlaced={() => {}}
          primaryColor={primaryColor}
          subdomain={restaurant?.subdomain}
          branchId={selectedBranch?.id}
        />
      )}
      {showCheckout && (
        <CheckoutModal
          cart={cart}
          restaurant={restaurant}
          allowOrders={true}
          onClose={() => setShowCheckout(false)}
          onOrderPlaced={handleOrderPlaced}
          onBlocked={() => { setShowCheckout(false); setShowBlockedModal(true); }}
          primaryColor={primaryColor}
          subdomain={restaurant?.subdomain}
          branchId={selectedBranch?.id}
        />
      )}
      {orderSuccess && (
        <OrderSuccessModal
          orderData={orderSuccess}
          onClose={() => setOrderSuccess(null)}
          primaryColor={primaryColor}
        />
      )}

      <div className="min-h-screen bg-white">
        {/* Top Bar */}
        <div className="bg-black text-white py-2">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              {restaurant?.contactPhone && (
                <a href={`tel:${restaurant.contactPhone}`} className="flex items-center gap-1 hover:text-gray-300">
                  <Phone className="w-3 h-3" />
                  {restaurant.contactPhone}
                </a>
              )}
              {restaurant?.contactEmail && (
                <a href={`mailto:${restaurant.contactEmail}`} className="flex items-center gap-1 hover:text-gray-300">
                  <Mail className="w-3 h-3" />
                  {restaurant.contactEmail}
                </a>
              )}
            </div>
            <div className="flex items-center gap-3">
              {restaurant?.socialMedia?.facebook && (
                <a href={restaurant.socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="hover:text-gray-300">
                  <Facebook className="w-4 h-4" />
                </a>
              )}
              {restaurant?.socialMedia?.instagram && (
                <a href={restaurant.socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="hover:text-gray-300">
                  <Instagram className="w-4 h-4" />
                </a>
              )}
              {restaurant?.socialMedia?.twitter && (
                <a href={restaurant.socialMedia.twitter} target="_blank" rel="noopener noreferrer" className="hover:text-gray-300">
                  <Twitter className="w-4 h-4" />
                </a>
              )}
              {restaurant?.socialMedia?.youtube && (
                <a href={restaurant.socialMedia.youtube} target="_blank" rel="noopener noreferrer" className="hover:text-gray-300">
                  <Youtube className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="bg-white shadow-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center justify-between h-20">
              <div className="flex items-center gap-3">
                {restaurant?.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={restaurant.logoUrl} alt={restaurant.name} className="h-14 w-14 rounded-xl object-cover" />
                ) : (
                  <div className="h-14 w-14 rounded-xl flex items-center justify-center text-2xl font-bold text-white" style={{ backgroundColor: primaryColor }}>
                    {(restaurant?.name || "R")[0]}
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{restaurant?.name || "Restaurant"}</h1>
                  <p className="text-xs text-gray-800">{restaurant?.tagline || "Delicious food, delivered fast"}</p>
                </div>
              </div>
              <div className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-700">
                {hasMultipleBranches && (
                  <div className="relative group">
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-left"
                    >
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-700">{selectedBranch?.name ?? "Select branch"}</span>
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    </button>
                    <div className="absolute left-0 top-full mt-1 z-50 min-w-[180px] rounded-xl bg-white border border-gray-200 shadow-lg py-1 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
                      {branches.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedBranch(b)}
                          className={`w-full flex items-center gap-2 px-4 py-2.5 text-left text-sm font-medium transition-colors ${
                            selectedBranch?.id === b.id
                              ? "bg-gray-100 text-gray-900"
                              : "text-gray-700 hover:bg-gray-50"
                          }`}
                        >
                          <MapPin className="w-4 h-4 flex-shrink-0" />
                          {b.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <a href="#menu" className="hover:text-gray-900">Menu</a>
                {deals && deals.length > 0 && <a href="#deals" className="hover:text-gray-900">Deals</a>}
                {websiteSections.length > 0 ? (
                  websiteSections.filter(s => s.items && s.items.length > 0).map((section, sIdx) => (
                    <a key={sIdx} href={`#section-${sIdx}`} className="hover:text-gray-900">{section.title || `Section ${sIdx + 1}`}</a>
                  ))
                ) : (
                  <>
                    {featuredItems.length > 0 && <a href="#featured" className="hover:text-gray-900">Featured</a>}
                    {bestSellers.length > 0 && <a href="#bestsellers" className="hover:text-gray-900">Best Sellers</a>}
                  </>
                )}
                <a href="#contact" className="hover:text-gray-900">Contact</a>
              </div>
              <div className="flex items-center gap-2">
                {hasMultipleBranches && (
                  <div className="md:hidden relative">
                    <select
                      value={selectedBranch?.id ?? ""}
                      onChange={(e) => {
                        const b = branches.find((x) => x.id === e.target.value);
                        if (b) setSelectedBranch(b);
                      }}
                      className="text-xs font-medium rounded-lg border border-gray-200 px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-0"
                      style={{ maxWidth: "120px", ["--tw-ring-color"]: primaryColor }}
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <button
                  onClick={() => setShowCart(true)}
                  className="relative flex items-center justify-center w-11 h-11 rounded-full text-white hover:opacity-90 transition-opacity"
                  style={{ backgroundColor: primaryColor }}
                >
                  <ShoppingCart className="w-5 h-5" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black text-white text-[10px] font-bold flex items-center justify-center">
                      {cartCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Hero Carousel */}
        {heroSlides.length > 0 && (
          <div className="relative h-[400px] md:h-[500px] overflow-hidden">
            {heroSlides.map((slide, index) => (
              <div
                key={index}
                className={`absolute inset-0 transition-opacity duration-700 ${
                  index === currentSlide ? 'opacity-100' : 'opacity-0'
                }`}
              >
                {slide.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slide.imageUrl}
                    alt={slide.title}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-r from-black/70 to-transparent flex items-center">
                  <div className="max-w-7xl mx-auto px-4 w-full">
                    <div className="max-w-2xl">
                      <h2 className="text-4xl md:text-6xl font-bold text-white mb-4">{slide.title}</h2>
                      <p className="text-lg md:text-xl text-gray-200 mb-6">{slide.subtitle}</p>
                      {slide.buttonText && (
                        <button className="px-8 py-3 rounded-full text-white font-bold text-lg hover:opacity-90 transition-opacity" style={{ backgroundColor: primaryColor }}>
                          {slide.buttonText}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {heroSlides.length > 1 && (
              <>
                <button
                  onClick={prevSlide}
                  className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg"
                >
                  <ChevronLeft className="w-6 h-6" />
                </button>
                <button
                  onClick={nextSlide}
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white p-2 rounded-full shadow-lg"
                >
                  <ChevronRight className="w-6 h-6" />
                </button>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {heroSlides.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentSlide(index)}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentSlide ? 'bg-white w-6' : 'bg-white/50'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Dynamic Website Sections – same component as dashboard preview */}
        {websiteSections.length > 0 ? (
          <WebsiteSectionsView
            websiteSections={websiteSections}
            primaryColor={primaryColor}
            secondaryColor={secondaryColor}
            onItemClick={openItem}
          />
        ) : (
          <>
            {featuredItems.length > 0 && (
              <section id="featured" className="py-12 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Featured Items</h2>
                    <p className="text-gray-900">Our chef&apos;s special recommendations</p>
                  </div>
                  <SectionSlider
                    items={featuredItems}
                    visibleDesktop={4}
                    visibleMobile={2}
                    primaryColor={primaryColor}
                    renderItem={(item) => (
                      <div className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-shadow group cursor-pointer" onClick={() => openItem(item)}>
                        <div className="relative h-40 overflow-hidden">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
                          )}
                          <div className="absolute top-2 right-2">
                            <span className="px-2 py-1 rounded-full bg-white/95 text-sm font-bold" style={{ color: primaryColor }}>PKR {item.price}</span>
                          </div>
                        </div>
                        <div className="p-3">
                          <h3 className="font-semibold text-gray-900 text-sm mb-1">{item.name}</h3>
                          <p className="text-xs text-gray-900 line-clamp-2">{item.description}</p>
                        </div>
                      </div>
                    )}
                  />
                </div>
              </section>
            )}

            {bestSellers.length > 0 && (
              <section id="bestsellers" className="py-12">
                <div className="max-w-7xl mx-auto px-4">
                  <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">Best Selling Items</h2>
                    <p className="text-gray-900">Customer favorites you&apos;ll love</p>
                  </div>
                  <SectionSlider
                    items={bestSellers}
                    visibleDesktop={3}
                    visibleMobile={1}
                    primaryColor={primaryColor}
                    renderItem={(item) => (
                      <div className="bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow cursor-pointer" onClick={() => openItem(item)}>
                        <div className="relative h-48">
                          {item.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300" />
                          )}
                          <div className="absolute top-3 left-3">
                            <span className="px-3 py-1 rounded-full bg-yellow-400 text-yellow-900 text-xs font-bold flex items-center gap-1">
                              <Star className="w-3 h-3 fill-current" />
                              Best Seller
                            </span>
                          </div>
                        </div>
                        <div className="p-4">
                          <div className="flex items-start justify-between mb-2">
                            <h3 className="font-bold text-gray-900 text-lg">{item.name}</h3>
                            <span className="text-lg font-bold" style={{ color: primaryColor }}>PKR {item.price}</span>
                          </div>
                          <p className="text-sm text-gray-900 mb-4">{item.description}</p>
                          <button className="w-full py-2 rounded-lg text-white font-semibold hover:opacity-90 transition-opacity" style={{ backgroundColor: primaryColor }} onClick={(e) => { e.stopPropagation(); openItem(item); }}>
                            Add to Cart
                          </button>
                        </div>
                      </div>
                    )}
                  />
                </div>
              </section>
            )}
          </>
        )}

        {/* Active Deals & Promotions Section */}
        {deals && deals.length > 0 && (
          <section id="deals" className="py-16 bg-gradient-to-br from-emerald-50 to-teal-50">
            <div className="max-w-7xl mx-auto px-4">
              <div className="text-center mb-10">
                <p className="text-sm font-bold uppercase tracking-widest mb-2 text-emerald-600">
                  Special Offers
                </p>
                <h2 className="text-3xl md:text-4xl font-black text-gray-900 mb-2">
                  Deals & Promotions
                </h2>
                <p className="text-gray-600">Save more with our exclusive offers</p>
              </div>

              <SectionSlider
                items={deals}
                visibleDesktop={3}
                visibleMobile={1}
                primaryColor={primaryColor}
                autoSlideDelay={4000}
                renderItem={(deal) => {
                  const getDealValue = () => {
                    switch (deal.dealType) {
                      case "PERCENTAGE_DISCOUNT":
                        return `${deal.discountPercentage}% OFF`;
                      case "FIXED_DISCOUNT":
                        return `PKR ${deal.discountAmount} OFF`;
                      case "COMBO":
                        return `PKR ${deal.comboPrice}`;
                      case "BUY_X_GET_Y":
                        return `Buy ${deal.buyQuantity} Get ${deal.getQuantity}`;
                      case "MINIMUM_PURCHASE":
                        return `Spend PKR ${deal.minimumPurchase}`;
                      default:
                        return "Special Deal";
                    }
                  };

                  return (
                    <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all hover:-translate-y-2 border-2 border-transparent hover:border-emerald-500 relative">
                      {/* Badge */}
                      {deal.badgeText && (
                        <div className="absolute top-4 right-4 z-10">
                          <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-yellow-400 to-orange-400 text-gray-900 text-xs font-bold shadow-lg">
                            <Star className="w-3 h-3 fill-current" />
                            {deal.badgeText}
                          </span>
                        </div>
                      )}

                      {/* Deal Value Badge */}
                      <div className="relative h-32 bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white overflow-hidden">
                        <div className="absolute inset-0 opacity-10">
                          <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white transform translate-x-16 -translate-y-16" />
                          <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white transform -translate-x-12 translate-y-12" />
                        </div>
                        <div className="text-center relative z-10">
                          <div className="text-3xl font-black mb-1">{getDealValue()}</div>
                          <div className="text-xs font-semibold uppercase tracking-wider opacity-90">
                            {deal.dealType === "PERCENTAGE_DISCOUNT" && "Discount"}
                            {deal.dealType === "FIXED_DISCOUNT" && "Save Now"}
                            {deal.dealType === "COMBO" && "Combo Deal"}
                            {deal.dealType === "BUY_X_GET_Y" && "Free Items"}
                            {deal.dealType === "MINIMUM_PURCHASE" && "Min Purchase"}
                          </div>
                        </div>
                      </div>

                      <div className="p-5">
                        <h3 className="font-bold text-gray-900 text-lg mb-2 line-clamp-1">
                          {deal.name}
                        </h3>
                        <p className="text-sm text-gray-600 mb-4 line-clamp-2 min-h-[2.5rem]">
                          {deal.description || "Don't miss out on this amazing offer!"}
                        </p>

                        {/* Deal Details */}
                        <div className="space-y-2 mb-4 text-xs text-gray-500">
                          {(deal.startTime || deal.endTime) && (
                            <div className="flex items-center gap-2">
                              <Clock className="w-3.5 h-3.5 text-emerald-600" />
                              <span>
                                {deal.startTime || "00:00"} - {deal.endTime || "23:59"}
                              </span>
                            </div>
                          )}
                          {deal.daysOfWeek && deal.daysOfWeek.length > 0 && deal.daysOfWeek.length < 7 && (
                            <div className="flex items-center gap-2">
                              <Star className="w-3.5 h-3.5 text-emerald-600" />
                              <span>
                                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
                                  .filter((_, i) => deal.daysOfWeek.includes(i))
                                  .join(", ")}
                              </span>
                            </div>
                          )}
                          {deal.maxTotalUsage && (
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                              <span>Limited offer - {deal.maxTotalUsage} uses only!</span>
                            </div>
                          )}
                        </div>

                        <div className="w-full py-2.5 rounded-xl text-center font-bold text-sm bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
                          Available Now
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          </section>
        )}

        {/* Food Menu Section */}
        <section id="menu" className="py-16 bg-orange-50/40">
          <div className="max-w-6xl mx-auto px-4">
            <div className="text-center mb-10">
              <p className="text-sm font-bold uppercase tracking-widest mb-2" style={{ color: secondaryColor }}>
                Food Menu
              </p>
              <h2 className="text-3xl md:text-4xl font-black text-gray-900">
                {restaurant?.name || "Our"} Menu
              </h2>
            </div>

            {categories.length > 0 && (
              <div className="flex items-center gap-3 mb-10 overflow-x-auto pb-2 sl-hide-sb" style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}>
                <button
                  onClick={() => setActiveCategory("all")}
                  className={`flex-shrink-0 whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all border ${
                    activeCategory === "all"
                      ? "text-white shadow-lg scale-105"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-md"
                  }`}
                  style={activeCategory === "all" ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                >
                  All
                </button>
                {categories.map((cat) => {
                  const catItems = menu.filter(item => item.category === cat.name);
                  if (catItems.length < 1) return null;
                  const catItem = catItems.find(item => item.imageUrl);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.name)}
                      className={`flex-shrink-0 whitespace-nowrap flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all border ${
                        activeCategory === cat.name
                          ? "text-white shadow-lg scale-105"
                          : "bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:shadow-md"
                      }`}
                      style={activeCategory === cat.name ? { backgroundColor: primaryColor, borderColor: primaryColor } : {}}
                    >
                      {catItem?.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={catItem.imageUrl} alt="" className="w-6 h-6 rounded-full object-cover" />
                      )}
                      {cat.name}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="w-full h-px bg-gray-200 mb-10" />

            {Object.keys(grouped).length === 0 ? (
              <div className="text-center py-12 bg-white rounded-2xl">
                <p className="text-gray-500">Menu coming soon...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">
                {menu
                  .filter(item => activeCategory === "all" || item.category === activeCategory)
                  .map((item) => (
                    <div key={item.id} className="flex items-center gap-4 group cursor-pointer" onClick={() => openItem(item)}>
                      <div className="w-20 h-20 md:w-24 md:h-24 flex-shrink-0 rounded-full overflow-hidden shadow-md group-hover:shadow-lg transition-shadow border-2 border-white">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center text-gray-400 text-2xl">
                            🍽
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <h3 className="font-bold text-gray-900 text-base md:text-lg">
                              {item.name}
                            </h3>
                            <p className="text-sm text-gray-500 mt-0.5 line-clamp-1">{item.description}</p>
                          </div>
                          <span className="text-lg md:text-xl font-black whitespace-nowrap" style={{ color: primaryColor }}>
                            PKR {item.price}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </section>

        {/* Footer */}
        <footer id="contact" className="bg-gray-900 text-white py-12">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
              <div>
                <h4 className="font-bold text-lg mb-4">{restaurant?.name || "Restaurant"}</h4>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {restaurant?.description || "Delicious food, great service."}
                </p>
              </div>

              <div>
                <h4 className="font-bold text-lg mb-4">Contact Us</h4>
                <div className="space-y-2 text-sm text-gray-400">
                  {restaurant?.contactPhone && (
                    <p className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      {restaurant.contactPhone}
                    </p>
                  )}
                  {restaurant?.contactEmail && (
                    <p className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      {restaurant.contactEmail}
                    </p>
                  )}
                  {restaurant?.address && (
                    <p className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {restaurant.address}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-bold text-lg mb-4">Opening Hours</h4>
                <div className="space-y-1 text-sm text-gray-400">
                  {restaurant?.openingHours && Object.entries(restaurant.openingHours).slice(0, 3).map(([day, hours]) => (
                    <p key={day} className="flex justify-between">
                      <span className="capitalize">{day}:</span>
                      <span>{hours}</span>
                    </p>
                  ))}
                </div>
              </div>

              {(restaurant?.socialMedia?.facebook || restaurant?.socialMedia?.instagram || restaurant?.socialMedia?.twitter || restaurant?.socialMedia?.youtube) && (
              <div>
                <h4 className="font-bold text-lg mb-4">Follow Us</h4>
                <div className="flex gap-3">
                  {restaurant?.socialMedia?.facebook && (
                    <a href={restaurant.socialMedia.facebook} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors">
                      <Facebook className="w-5 h-5" />
                    </a>
                  )}
                  {restaurant?.socialMedia?.instagram && (
                    <a href={restaurant.socialMedia.instagram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors">
                      <Instagram className="w-5 h-5" />
                    </a>
                  )}
                  {restaurant?.socialMedia?.twitter && (
                    <a href={restaurant.socialMedia.twitter} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors">
                      <Twitter className="w-5 h-5" />
                    </a>
                  )}
                  {restaurant?.socialMedia?.youtube && (
                    <a href={restaurant.socialMedia.youtube} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition-colors">
                      <Youtube className="w-5 h-5" />
                    </a>
                  )}
                </div>
              </div>
              )}
            </div>

            <div className="pt-8 border-t border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-gray-800">
              <p>&copy; {new Date().getFullYear()} {restaurant?.name || "Restaurant"}. All rights reserved.</p>
              <p>Powered by <span className="font-semibold" style={{ color: primaryColor }}>Eats Desk</span></p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

export async function getServerSideProps({ params }) {
  const subdomain = params.subdomain;

  try {
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
    const res = await fetch(`${base}/api/menu?subdomain=${encodeURIComponent(subdomain)}`);

    if (!res.ok) {
      if (res.status === 404) {
        return { notFound: true };
      }

      const body = await res.json().catch(() => ({}));
      const message = body.message || "";
      const lower = message.toLowerCase();

      if (lower.includes("subscription inactive") || lower.includes("subscription expired")) {
        return {
          props: {
            restaurant: null,
            menu: [],
            categories: [],
            branches: [],
            deals: [],
            suspended: true
          }
        };
      }

      throw new Error(`Failed to load restaurant menu: ${res.status}`);
    }

    const data = await res.json();

    // Fetch active deals
    let activeDeals = [];
    try {
      const dealsRes = await fetch(`${base}/api/deals/active?subdomain=${encodeURIComponent(subdomain)}`);
      if (dealsRes.ok) {
        const dealsData = await dealsRes.json();
        // Filter only deals that should be shown on website
        activeDeals = (Array.isArray(dealsData) ? dealsData : []).filter(deal => deal.showOnWebsite);
      }
    } catch (err) {
      console.error("Failed to fetch deals:", err);
      // Continue without deals if fetch fails
    }

    return {
      props: {
        restaurant: data.restaurant || null,
        menu: data.menu || [],
        categories: data.categories || [],
        branches: data.branches || [],
        deals: activeDeals,
        suspended: false
      },
    };
  } catch (error) {
    console.error("Failed to load tenant website", error);
    return {
      notFound: true,
    };
  }
}
