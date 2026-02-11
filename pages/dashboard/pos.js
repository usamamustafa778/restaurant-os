import { useState, useEffect, useRef } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getMenu, createPosOrder, SubscriptionInactiveError } from "../../lib/apiClient";
import { ShoppingCart, Plus, Minus, Trash2, Receipt, CreditCard, Banknote, ChevronUp, ChevronDown, User } from "lucide-react";

export default function POSPage() {
  const [menu, setMenu] = useState({ categories: [], items: [] });
  const [cart, setCart] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [orderType, setOrderType] = useState("DINE_IN");
  const [discountAmount, setDiscountAmount] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suspended, setSuspended] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("sidebar_collapsed") !== "true";
    }
    return true;
  });

  useEffect(() => {
    loadMenu();

    // Listen for sidebar toggle events from AdminLayout
    function handleSidebarToggle(e) {
      setSidebarOpen(!e.detail.collapsed);
    }
    window.addEventListener("sidebar-toggle", handleSidebarToggle);
    return () => window.removeEventListener("sidebar-toggle", handleSidebarToggle);
  }, []);

  async function loadMenu() {
    try {
      const data = await getMenu();
      setMenu(data);
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) {
        setSuspended(true);
      } else {
        console.error("Failed to load menu:", err);
        setError(err.message || "Failed to load menu");
      }
    }
  }

  const filteredItems = menu.items.filter(item => {
    const matchesCategory = selectedCategory === "all" || item.categoryId === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && item.available;
  });

  const addToCart = (item) => {
    const existingItem = cart.find(i => i.id === item.id);
    if (existingItem) {
      setCart(cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const updateQuantity = (itemId, change) => {
    setCart(cart.map(item => {
      if (item.id === itemId) {
        const newQty = item.quantity + change;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal;

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setError("Cart is empty!");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const result = await createPosOrder({
        items: cart.map(item => ({
          menuItemId: item.id,
          quantity: item.quantity
        })),
        orderType,
        paymentMethod,
        discountAmount: discountAmount ? Number(discountAmount) : 0,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: customerAddress.trim()
      });

      setSuccess(`Order ${result.orderNumber || ""} placed successfully! Total: PKR ${result.total}`);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDiscountAmount("");
      setShowCustomerDetails(false);
      setShowCheckout(false);
    } catch (err) {
      setError(err.message || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Orders" suspended={suspended}>
      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-xs text-emerald-800">
          {success}
        </div>
      )}
      <div className="grid gap-4 lg:grid-cols-[1fr_350px] h-[calc(100vh-180px)]">
        {/* Menu Items Section */}
        <div className="flex flex-col bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-800 rounded-xl overflow-hidden">
          {/* Search & Category Filter */}
          <div className="p-4 border-b border-gray-300 dark:border-neutral-800 space-y-3">
            <input
              type="text"
              placeholder="Search menu items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/60"
            />
            <div className="flex gap-2 overflow-x-auto pb-2">
              <button
                onClick={() => setSelectedCategory("all")}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  selectedCategory === "all"
                    ? "bg-primary text-white"
                    : "bg-bg-primary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-800"
                }`}
              >
                All Items
              </button>
              {menu.categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === cat.id
                      ? "bg-primary text-white"
                      : "bg-bg-primary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 hover:bg-gray-200 dark:hover:bg-neutral-800"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Grid */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className={`grid gap-3 grid-cols-2 md:grid-cols-3 ${sidebarOpen ? "lg:grid-cols-3" : "lg:grid-cols-4"}`}>
              {filteredItems.map(item => {
                const inCart = cart.find(c => c.id === item.id);
                const outOfStock = item.inventorySufficient === false;
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col rounded-xl border overflow-hidden transition-all ${
                      outOfStock
                        ? "border-red-200 dark:border-red-900/40 bg-gray-100 dark:bg-neutral-900/60 opacity-70"
                        : "border-gray-300 dark:border-neutral-800 bg-bg-primary dark:bg-neutral-900 hover:border-primary hover:shadow-md"
                    }`}
                  >
                    <div className="relative">
                      {item.imageUrl && (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className={`w-full h-28 object-cover ${outOfStock ? "grayscale" : ""}`}
                        />
                      )}
                      {outOfStock && (
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                          <span className="px-2 py-1 rounded-lg bg-red-600 text-white text-[10px] font-bold uppercase tracking-wide">
                            Out of Stock
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex flex-col flex-1">
                      <h3 className={`text-sm font-semibold line-clamp-2 ${outOfStock ? "text-gray-400 dark:text-neutral-500" : "text-gray-900 dark:text-white"}`}>{item.name}</h3>
                      {outOfStock && (
                        <p className="text-[10px] text-red-500 dark:text-red-400 mt-0.5">
                          Insufficient inventory
                        </p>
                      )}
                      <div className="flex items-center justify-between mt-auto pt-2">
                        <p className={`text-sm font-bold ${outOfStock ? "text-gray-400 dark:text-neutral-600" : "text-primary"}`}>PKR {item.price}</p>
                        {outOfStock ? (
                          <span className="px-2 py-1 rounded-lg bg-gray-200 dark:bg-neutral-800 text-gray-400 dark:text-neutral-600 text-[10px] font-medium cursor-not-allowed">
                            Unavailable
                          </span>
                        ) : inCart ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700 transition-colors"
                            >
                              <Minus className="w-3 h-3 text-gray-700 dark:text-neutral-300" />
                            </button>
                            <span className="w-7 text-center text-xs font-bold text-gray-900 dark:text-white">{inCart.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-primary text-white hover:bg-secondary transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(item)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-semibold hover:bg-secondary transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                            Add
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredItems.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <p className="text-sm text-gray-400 dark:text-neutral-500">No items found</p>
              </div>
            )}
          </div>
        </div>

        {/* Cart Section */}
        <div className="flex flex-col bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-300 dark:border-neutral-800 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Current Order</h2>
            <span className="ml-auto text-xs text-gray-800 dark:text-neutral-400">{cart.length} items</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <ShoppingCart className="w-12 h-12 text-gray-300 dark:text-neutral-700 mb-2" />
                <p className="text-sm text-gray-800 dark:text-neutral-400">Cart is empty</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Add items from the menu</p>
              </div>
            ) : (
              cart.map(item => (
                <div
                  key={item.id}
                  className="px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-800"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.name}</h3>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded bg-red-100 dark:bg-red-500/10 hover:bg-red-200 dark:hover:bg-secondary/20"
                    >
                      <Trash2 className="w-3 h-3 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700"
                      >
                        <Minus className="w-3 h-3 text-gray-700 dark:text-neutral-300" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold text-gray-900 dark:text-white">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-6 h-6 flex items-center justify-center rounded bg-gray-200 dark:bg-neutral-800 hover:bg-gray-300 dark:hover:bg-neutral-700"
                      >
                        <Plus className="w-3 h-3 text-gray-700 dark:text-neutral-300" />
                      </button>
                      <span className="text-[11px] text-gray-500 dark:text-neutral-500 ml-1">× PKR {item.price}</span>
                    </div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      PKR {(item.price * item.quantity).toFixed(0)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Cart Summary */}
          {cart.length > 0 && (
            <div className="p-4 border-t border-gray-300 dark:border-neutral-800 space-y-3">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-gray-900 dark:text-neutral-400">
                  <span>Subtotal</span>
                  <span>PKR {subtotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between font-semibold text-base text-gray-900 dark:text-white pt-2 border-t border-gray-300 dark:border-neutral-800">
                  <span>Total</span>
                  <span>PKR {total.toFixed(0)}</span>
                </div>
              </div>

              {!showCheckout ? (
                <button
                  onClick={() => setShowCheckout(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-white font-semibold hover:bg-secondary transition-colors"
                >
                  <Receipt className="w-4 h-4" />
                  Proceed to Checkout
                </button>
              ) : (
                <div className="space-y-3">
                  {/* Customer Details Dropup */}
                  <div className="rounded-lg border border-gray-300 dark:border-neutral-700 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setShowCustomerDetails(!showCustomerDetails)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-bg-primary dark:bg-neutral-900 text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-bg-primary dark:hover:bg-neutral-800 transition-colors"
                    >
                      <span className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Customer Details
                        {(customerName || customerPhone) && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">Added</span>
                        )}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showCustomerDetails ? "rotate-180" : ""}`} />
                    </button>
                    <div
                      className="transition-all duration-300 ease-in-out overflow-hidden"
                      style={{ maxHeight: showCustomerDetails ? "200px" : "0px", opacity: showCustomerDetails ? 1 : 0 }}
                    >
                      <div className="p-3 space-y-2 border-t border-gray-300 dark:border-neutral-700 bg-bg-secondary dark:bg-neutral-950">
                        <input
                          type="text"
                          placeholder="Customer name (optional)"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                        />
                        <input
                          type="tel"
                          placeholder="Customer phone (optional)"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                        />
                        <input
                          type="text"
                          placeholder="Delivery address (optional)"
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                        />
                      </div>
                    </div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder="Discount amount (optional)"
                    value={discountAmount}
                    onChange={(e) => setDiscountAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 text-sm text-gray-900 dark:text-white"
                  />
                  {discountAmount && Number(discountAmount) > 0 && (
                    <div className="flex justify-between text-sm text-gray-700 dark:text-neutral-400">
                      <span>After discount</span>
                      <span className="font-semibold text-gray-900 dark:text-white">
                        PKR {Math.max(0, total - Number(discountAmount)).toFixed(0)}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setPaymentMethod("CASH")}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        paymentMethod === "CASH"
                          ? "bg-primary text-white"
                          : "bg-bg-primary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300"
                      }`}
                    >
                      <Banknote className="w-4 h-4" />
                      Cash
                    </button>
                    <button
                      onClick={() => setPaymentMethod("CARD")}
                      className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        paymentMethod === "CARD"
                          ? "bg-primary text-white"
                          : "bg-bg-primary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300"
                      }`}
                    >
                      <CreditCard className="w-4 h-4" />
                      Card
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setOrderType("DINE_IN")}
                      className={`flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        orderType === "DINE_IN"
                          ? "bg-primary text-white"
                          : "bg-bg-primary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300"
                      }`}
                    >
                      Dine-in
                    </button>
                    <button
                      onClick={() => setOrderType("TAKEAWAY")}
                      className={`flex items-center justify-center px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        orderType === "TAKEAWAY"
                          ? "bg-primary text-white"
                          : "bg-bg-primary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300"
                      }`}
                    >
                      Takeaway
                    </button>
                  </div>
                  <button
                    onClick={handleCheckout}
                    disabled={loading}
                    className="w-full px-4 py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Processing..." : "Complete Order"}
                  </button>
                  <button
                    onClick={() => setShowCheckout(false)}
                    className="w-full px-4 py-2 rounded-lg bg-bg-primary dark:bg-neutral-900 text-gray-700 dark:text-neutral-300 text-sm hover:bg-gray-200 dark:hover:bg-neutral-800"
                  >
                    Back
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
