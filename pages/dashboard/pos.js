import { useState, useEffect, useRef } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import { getMenu, getBranchMenu, createPosOrder, SubscriptionInactiveError, getActiveDealsByBranch, findApplicableDeals, getStoredAuth } from "../../lib/apiClient";
import { useBranch } from "../../contexts/BranchContext";
import { ShoppingCart, Plus, Minus, Trash2, Receipt, CreditCard, Banknote, ChevronUp, ChevronDown, User, Loader2, CircleCheckBig, ChevronLeft, ChevronRight, Clock, Utensils, FileText, Flame, Star, Users, Percent, Tag, Sparkles } from "lucide-react";

export default function POSPage() {
  const { currentBranch } = useBranch() || {};
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
  
  // New features from Dream POS
  const [dietaryFilter, setDietaryFilter] = useState("all"); // all, veg, non-veg, egg
  const [orderFilter, setOrderFilter] = useState("all"); // all, dine-in, takeaway, delivery, table
  const [selectedWaiter, setSelectedWaiter] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [itemNotes, setItemNotes] = useState({}); // { itemId: "note text" }
  const [recentOrders, setRecentOrders] = useState([]);
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0);
  
  // Deals integration
  const [availableDeals, setAvailableDeals] = useState([]);
  const [selectedDeals, setSelectedDeals] = useState([]);
  const [showDealsSection, setShowDealsSection] = useState(false);
  const [applicableDeals, setApplicableDeals] = useState([]);
  const [dealDiscount, setDealDiscount] = useState(0);

  useEffect(() => {
    loadMenu();
    loadActiveDeals();

    // Listen for sidebar toggle events from AdminLayout
    function handleSidebarToggle(e) {
      setSidebarOpen(!e.detail.collapsed);
    }
    window.addEventListener("sidebar-toggle", handleSidebarToggle);
    return () => window.removeEventListener("sidebar-toggle", handleSidebarToggle);
  }, [currentBranch]);

  // Check for applicable deals when cart changes
  useEffect(() => {
    if (cart.length > 0) {
      checkApplicableDeals();
    } else {
      setApplicableDeals([]);
      setSelectedDeals([]);
      setDealDiscount(0);
    }
  }, [cart, availableDeals]);

  async function loadMenu() {
    try {
      const auth = getStoredAuth();
      const restaurantId = auth?.user?.restaurantId;
      
      // Use branch-aware menu if branch is selected
      let data;
      if (currentBranch?.id && restaurantId) {
        data = await getBranchMenu(currentBranch.id, restaurantId);
      } else {
        data = await getMenu();
      }
      
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

  async function loadActiveDeals() {
    try {
      const branchId = currentBranch?.id;
      const deals = await getActiveDealsByBranch(branchId);
      setAvailableDeals(Array.isArray(deals) ? deals : []);
    } catch (err) {
      console.error("Failed to load deals:", err);
      setAvailableDeals([]);
    }
  }

  async function checkApplicableDeals() {
    if (cart.length === 0) return;
    
    try {
      const orderItems = cart.map(item => ({
        menuItemId: item.id,
        quantity: item.quantity,
        price: item.price,
      }));
      
      const deals = await findApplicableDeals(
        orderItems,
        subtotal,
        null, // customerId - can be added if tracking customer deals
        currentBranch?.id
      );
      
      setApplicableDeals(Array.isArray(deals) ? deals : []);
      
      // Auto-select best deal if available and none manually selected
      if (deals && deals.length > 0 && selectedDeals.length === 0) {
        const bestDeal = deals[0]; // Assumes backend returns sorted by best discount
        if (bestDeal) {
          setSelectedDeals([bestDeal.id]);
          calculateDealDiscount([bestDeal]);
        }
      }
    } catch (err) {
      console.error("Failed to check applicable deals:", err);
      setApplicableDeals([]);
    }
  }

  function calculateDealDiscount(deals) {
    if (!deals || deals.length === 0) {
      setDealDiscount(0);
      return;
    }
    
    let totalDiscount = 0;
    
    deals.forEach(deal => {
      switch (deal.dealType) {
        case "PERCENTAGE_DISCOUNT":
          totalDiscount += subtotal * (deal.discountPercentage / 100);
          break;
        case "FIXED_DISCOUNT":
          totalDiscount += deal.discountAmount;
          break;
        case "MINIMUM_PURCHASE":
          if (subtotal >= deal.minimumPurchase) {
            if (deal.discountPercentage) {
              totalDiscount += subtotal * (deal.discountPercentage / 100);
            } else if (deal.discountAmount) {
              totalDiscount += deal.discountAmount;
            }
          }
          break;
        // Add other deal type calculations as needed
        default:
          break;
      }
    });
    
    setDealDiscount(Math.min(totalDiscount, subtotal)); // Don't discount more than subtotal
  }

  function toggleDealSelection(dealId) {
    const deal = applicableDeals.find(d => d.id === dealId);
    if (!deal) return;
    
    if (selectedDeals.includes(dealId)) {
      // Deselect
      const newSelected = selectedDeals.filter(id => id !== dealId);
      setSelectedDeals(newSelected);
      const selectedDealObjects = applicableDeals.filter(d => newSelected.includes(d.id));
      calculateDealDiscount(selectedDealObjects);
    } else {
      // Select (if stacking allowed, add to list; otherwise replace)
      const newSelected = deal.allowStacking ? [...selectedDeals, dealId] : [dealId];
      setSelectedDeals(newSelected);
      const selectedDealObjects = applicableDeals.filter(d => newSelected.includes(d.id));
      calculateDealDiscount(selectedDealObjects);
    }
  }

  const filteredItems = menu.items.filter(item => {
    const matchesCategory = selectedCategory === "all" || item.categoryId === selectedCategory;
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Dietary filter (mock - in production, items should have a dietaryType field)
    const matchesDietary = dietaryFilter === "all" || 
      (dietaryFilter === "veg" && item.name.toLowerCase().includes("veg")) ||
      (dietaryFilter === "non-veg" && !item.name.toLowerCase().includes("veg")) ||
      (dietaryFilter === "egg" && item.name.toLowerCase().includes("egg"));
    
    // Use finalAvailable if available (branch-aware), otherwise fall back to available
    const isAvailable = item.finalAvailable ?? item.available;
    return matchesCategory && matchesSearch && matchesDietary && isAvailable;
  });

  const addToCart = (item) => {
    const existingItem = cart.find(i => i.id === item.id);
    if (existingItem) {
      setCart(cart.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i));
    } else {
      // Use finalPrice for branch-aware pricing
      const itemPrice = item.finalPrice ?? item.price;
      setCart([...cart, { ...item, price: itemPrice, quantity: 1 }]);
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

  const clearCart = () => {
    setCart([]);
    setShowCheckout(false);
    setItemNotes({});
    setTableNumber("");
    setSelectedWaiter("");
    setSelectedDeals([]);
    setDealDiscount(0);
    setDiscountAmount("");
  };
  
  const addNoteToItem = (itemId) => {
    const note = prompt("Add special instructions for this item:");
    if (note !== null) {
      setItemNotes(prev => ({ ...prev, [itemId]: note.trim() }));
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const manualDiscount = discountAmount ? Number(discountAmount) : 0;
  const totalDiscount = dealDiscount + manualDiscount;
  const total = Math.max(0, subtotal - totalDiscount);

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
        discountAmount: totalDiscount,
        appliedDeals: selectedDeals.length > 0 ? selectedDeals.map(dealId => {
          const deal = applicableDeals.find(d => d.id === dealId);
          return {
            dealId: dealId,
            dealName: deal?.name || "",
            dealType: deal?.dealType || ""
          };
        }) : undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: customerAddress.trim(),
        branchId: currentBranch?.id ?? undefined
      });

      setSuccess(`Order ${result.orderNumber || ""} placed successfully! Total: PKR ${result.total}`);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDiscountAmount("");
      setSelectedDeals([]);
      setDealDiscount(0);
      setShowCustomerDetails(false);
      setShowCheckout(false);
    } catch (err) {
      setError(err.message || "Failed to place order");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout title="Point of Sale" suspended={suspended}>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50/80 dark:bg-red-500/10 dark:border-red-500/30 px-5 py-3 text-sm font-medium text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50/80 dark:bg-emerald-500/10 dark:border-emerald-500/30 px-5 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
          {success}
        </div>
      )}

      {/* Recent Orders Section */}
      <div className="bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl p-5 mb-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Orders</h3>
          <div className="flex items-center gap-2">
            {/* Order Type Filters */}
            <div className="flex gap-1.5">
              {[
                { value: "all", label: "All Orders" },
                { value: "dine-in", label: "Dine In" },
                { value: "takeaway", label: "Take Away" },
                { value: "delivery", label: "Delivery" },
                { value: "table", label: "Table" }
              ].map(filter => (
                <button
                  key={filter.value}
                  onClick={() => setOrderFilter(filter.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    orderFilter === filter.value
                      ? "bg-gradient-to-r from-primary to-secondary text-white shadow-md"
                      : "bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-800"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            {/* Navigation Arrows */}
            <button 
              onClick={() => setCurrentOrderIndex(Math.max(0, currentOrderIndex - 1))}
              disabled={currentOrderIndex === 0}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700 dark:text-neutral-300" />
            </button>
            <button 
              onClick={() => setCurrentOrderIndex(Math.min(recentOrders.length - 1, currentOrderIndex + 1))}
              disabled={currentOrderIndex >= recentOrders.length - 1}
              className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-gray-700 dark:text-neutral-300" />
            </button>
          </div>
        </div>
        
        {/* Recent Order Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {recentOrders.slice(currentOrderIndex, currentOrderIndex + 3).map(order => (
            <div key={order.id} className="relative p-4 rounded-xl border-2 border-gray-200 dark:border-neutral-800 hover:border-primary/30 hover:shadow-lg transition-all">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-gray-500 dark:text-neutral-500">{order.id}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1 bg-primary/10 text-primary">
                      {order.type === "delivery" ? "Delivery" : order.type === "takeaway" ? "Take Away" : "Dine In"}
                    </span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">{order.customer}</p>
                  <p className="text-xs text-gray-500 dark:text-neutral-500">{order.time}</p>
                </div>
                <div className="text-right">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
                    order.timeAgo.includes("2") || order.timeAgo.includes("1") ? "bg-red-100 dark:bg-red-500/10" :
                    order.timeAgo.includes("3") ? "bg-yellow-100 dark:bg-yellow-500/10" :
                    "bg-emerald-100 dark:bg-emerald-500/10"
                  }`}>
                    <Clock className={`w-3 h-3 ${
                      order.timeAgo.includes("2") || order.timeAgo.includes("1") ? "text-red-600 dark:text-red-400" :
                      order.timeAgo.includes("3") ? "text-yellow-600 dark:text-yellow-400" :
                      "text-emerald-600 dark:text-emerald-400"
                    }`} />
                    <span className={`text-xs font-bold ${
                      order.timeAgo.includes("2") || order.timeAgo.includes("1") ? "text-red-600 dark:text-red-400" :
                      order.timeAgo.includes("3") ? "text-yellow-600 dark:text-yellow-400" :
                      "text-emerald-600 dark:text-emerald-400"
                    }`}>{order.timeAgo}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-neutral-500 mt-1">Rs {order.total}</p>
                </div>
              </div>
              
              {/* Progress Bar */}
              <div className="relative h-2 bg-gray-100 dark:bg-neutral-900 rounded-full overflow-hidden">
                <div 
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary to-secondary rounded-full transition-all duration-500"
                  style={{ width: `${order.progress}%` }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-gray-500 dark:text-neutral-500">Progress</span>
                <span className="text-[10px] font-bold text-primary">{order.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_420px] h-[calc(100vh-420px)]">
        {/* Menu Items Section */}
        <div className="flex flex-col bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-sm">
          {/* Search & Category Filter */}
          <div className="p-6 border-b-2 border-gray-100 dark:border-neutral-800 bg-gradient-to-r from-gray-50/50 dark:from-neutral-900/30 to-transparent">
            {/* All Filters in One Line */}
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {/* Dietary Type Filters */}
              <div className="flex gap-2 shrink-0">
                {[
                  { value: "veg", label: "Veg", icon: "🥗", color: "emerald" },
                  { value: "non-veg", label: "Non Veg", icon: "🍗", color: "red" },
                  { value: "egg", label: "Egg", icon: "🥚", color: "yellow" }
                ].map(filter => (
                  <button
                    key={filter.value}
                    onClick={() => setDietaryFilter(dietaryFilter === filter.value ? "all" : filter.value)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                      dietaryFilter === filter.value
                        ? `bg-${filter.color}-100 dark:bg-${filter.color}-500/10 text-${filter.color}-600 dark:text-${filter.color}-400 border-2 border-${filter.color}-300 dark:border-${filter.color}-500/30`
                        : "bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 border-2 border-gray-200 dark:border-neutral-700"
                    }`}
                  >
                    <span>{filter.icon}</span>
                    {filter.label}
                  </button>
                ))}
              </div>
              
              {/* Search Input */}
              <div className="relative shrink-0" style={{ width: '250px' }}>
                <input
                  type="text"
                  placeholder="Search menu items..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-white dark:bg-neutral-900 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm"
                />
              </div>

              {/* Category Filters */}
              <button
                onClick={() => setSelectedCategory("all")}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all shrink-0 ${
                  selectedCategory === "all"
                    ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/30"
                    : "bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 border-2 border-gray-200 dark:border-neutral-700 hover:border-primary/30"
                }`}
              >
                All Items
              </button>
              {menu.categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all shrink-0 ${
                    selectedCategory === cat.id
                      ? "bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/30"
                      : "bg-white dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 hover:bg-gray-50 dark:hover:bg-neutral-800 border-2 border-gray-200 dark:border-neutral-700 hover:border-primary/30"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* Menu Grid - Premium Dream POS style */}
          <div className="flex-1 overflow-y-auto p-6 bg-gray-50/30 dark:bg-neutral-900/20">
            <div className={`grid gap-5 ${sidebarOpen ? "grid-cols-2 xl:grid-cols-3" : "grid-cols-2 xl:grid-cols-4"}`}>
              {filteredItems.map((item, idx) => {
                const inCart = cart.find(c => c.id === item.id);
                const outOfStock = item.inventorySufficient === false;
                // Mock badges - in production, fetch from item properties
                const isTrending = idx % 3 === 0; // Every 3rd item
                const isMustTry = idx % 5 === 0; // Every 5th item
                
                return (
                  <div
                    key={item.id}
                    className={`group relative flex flex-col rounded-2xl overflow-hidden transition-all cursor-pointer ${
                      outOfStock
                        ? "border-2 border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/60 opacity-60"
                        : "border-2 border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:border-primary hover:shadow-2xl hover:scale-105 shadow-md"
                    }`}
                    onClick={() => !outOfStock && !inCart && addToCart(item)}
                  >
                    {/* Image */}
                    <div className="relative h-44 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-neutral-900 dark:to-neutral-800">
                      {/* Item Badges */}
                      {!outOfStock && (
                        <div className="absolute top-2 left-2 flex flex-col gap-1.5 z-10">
                          {isTrending && (
                            <span className="px-2.5 py-1 rounded-lg bg-red-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-lg">
                              <Flame className="w-3 h-3" />
                              Trending
                            </span>
                          )}
                          {isMustTry && (
                            <span className="px-2.5 py-1 rounded-lg bg-blue-500 text-white text-[10px] font-bold flex items-center gap-1 shadow-lg">
                              <Star className="w-3 h-3" />
                              Must Try
                            </span>
                          )}
                        </div>
                      )}
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className={`w-full h-full object-cover ${outOfStock ? "grayscale" : "group-hover:scale-110 transition-transform duration-300"}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-5xl">
                          🍽️
                        </div>
                      )}
                      {outOfStock && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm">
                          <span className="px-4 py-1.5 rounded-xl bg-red-600 text-white text-xs font-bold uppercase shadow-lg">
                            Out of Stock
                          </span>
                        </div>
                      )}
                      {inCart && !outOfStock && (
                        <div className="absolute top-3 right-3 h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary text-white flex items-center justify-center text-sm font-bold shadow-xl animate-bounce">
                          {inCart.quantity}
                        </div>
                      )}
                      {!outOfStock && !inCart && (
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
                          <span className="text-white text-xs font-bold">Click to add</span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4 flex flex-col flex-1">
                      <h3 className={`text-base font-bold line-clamp-2 mb-3 min-h-[3rem] ${outOfStock ? "text-gray-400 dark:text-neutral-500" : "text-gray-900 dark:text-white"}`}>
                        {item.name}
                      </h3>
                      <div className="mt-auto flex items-center justify-between">
                        <div>
                          <p className="text-xs text-gray-500 dark:text-neutral-500 mb-0.5">Price</p>
                          <span className={`text-xl font-bold ${outOfStock ? "text-gray-400 dark:text-neutral-600" : "text-primary"}`}>
                            Rs {item.finalPrice ?? item.price}
                          </span>
                        </div>
                        {!outOfStock && inCart && (
                          <div className="flex items-center gap-1.5 bg-gray-100 dark:bg-neutral-800 p-1 rounded-xl" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-neutral-950 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors shadow-sm"
                            >
                              <Minus className="w-4 h-4 text-gray-700 dark:text-neutral-300" />
                            </button>
                            <span className="w-10 text-center text-base font-bold text-gray-900 dark:text-white">{inCart.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary text-white hover:shadow-lg transition-all"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {filteredItems.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full py-20">
                <div className="w-24 h-24 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                  <ShoppingCart className="w-12 h-12 text-gray-300 dark:text-neutral-700" />
                </div>
                <p className="text-sm font-medium text-gray-600 dark:text-neutral-400">No items found</p>
                <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">Try a different search or category</p>
              </div>
            )}
          </div>
        </div>

        {/* Cart Section - Premium style */}
        <div className="flex flex-col bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-6 py-5 border-b-2 border-gray-100 dark:border-neutral-800 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shadow-lg">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Current Order</h2>
                  <p className="text-xs text-gray-500 dark:text-neutral-400">{cart.length} item{cart.length !== 1 ? "s" : ""}</p>
                </div>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-xs font-semibold text-red-600 dark:text-red-400 hover:text-red-700 transition-colors"
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-3">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-16">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-gray-100 to-gray-50 dark:from-neutral-900 dark:to-neutral-800 flex items-center justify-center mb-4 shadow-inner">
                  <ShoppingCart className="w-12 h-12 text-gray-300 dark:text-neutral-700" />
                </div>
                <p className="text-base font-bold text-gray-700 dark:text-neutral-300">Cart is empty</p>
                <p className="text-sm text-gray-400 dark:text-neutral-500 mt-1">Select items from the menu to start</p>
              </div>
            ) : (
              cart.map(item => (
                <div
                  key={item.id}
                  className="relative p-4 rounded-2xl bg-gradient-to-br from-gray-50 to-white dark:from-neutral-900 dark:to-neutral-950 border-2 border-gray-200 dark:border-neutral-800 hover:border-primary/30 hover:shadow-lg transition-all"
                >
                  <button
                    onClick={() => removeFromCart(item.id)}
                    className="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-lg bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all shadow-sm"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-600" />
                  </button>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white pr-10 mb-2 line-clamp-1">{item.name}</h3>
                  
                  {/* Item Note */}
                  {itemNotes[item.id] && (
                    <div className="mb-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20">
                      <p className="text-xs text-blue-700 dark:text-blue-400">
                        <FileText className="w-3 h-3 inline mr-1" />
                        Note: {itemNotes[item.id]}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 bg-white dark:bg-neutral-900 p-1.5 rounded-xl border-2 border-gray-200 dark:border-neutral-700">
                      <button
                        onClick={() => updateQuantity(item.id, -1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-50 dark:bg-neutral-950 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        <Minus className="w-4 h-4 text-gray-600 dark:text-neutral-400" />
                      </button>
                      <span className="w-10 text-center text-base font-bold text-gray-900 dark:text-white">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, 1)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary text-white hover:shadow-md transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500 dark:text-neutral-500">Rs {item.price} × {item.quantity}</p>
                      <p className="text-xl font-bold text-primary">
                        Rs {(item.price * item.quantity).toFixed(0)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Add Note Button */}
                  <button
                    onClick={() => addNoteToItem(item.id)}
                    className="w-full py-2 px-3 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 dark:hover:bg-primary/20 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {itemNotes[item.id] ? "Edit Note" : "Add Note"}
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Cart Summary */}
          {cart.length > 0 && (
            <div className="p-6 border-t-2 border-gray-100 dark:border-neutral-800 space-y-5 bg-gradient-to-br from-gray-50/50 dark:from-neutral-900/30 to-transparent">
              {/* Available Deals Section */}
              {applicableDeals.length > 0 && (
                <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-500/30 overflow-hidden bg-white dark:bg-neutral-950">
                  <button
                    type="button"
                    onClick={() => setShowDealsSection(!showDealsSection)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold text-gray-700 dark:text-neutral-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 flex items-center justify-center">
                        <Tag className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="flex items-center gap-2">
                        Available Deals
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                          {applicableDeals.length}
                        </span>
                      </span>
                    </span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showDealsSection ? "rotate-180" : ""}`} />
                  </button>
                  <div
                    className="transition-all duration-300 ease-in-out overflow-hidden"
                    style={{ maxHeight: showDealsSection ? `${applicableDeals.length * 80 + 40}px` : "0px", opacity: showDealsSection ? 1 : 0 }}
                  >
                    <div className="p-4 space-y-2 border-t-2 border-emerald-100 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-500/5 dark:to-neutral-950">
                      {applicableDeals.map(deal => {
                        const isSelected = selectedDeals.includes(deal.id);
                        return (
                          <button
                            key={deal.id}
                            onClick={() => toggleDealSelection(deal.id)}
                            className={`w-full text-left p-3 rounded-lg transition-all ${
                              isSelected
                                ? "bg-emerald-100 dark:bg-emerald-500/10 border-2 border-emerald-500 dark:border-emerald-500/50"
                                : "bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 hover:border-emerald-300 dark:hover:border-emerald-500/30"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="text-sm font-bold text-gray-900 dark:text-white">
                                    {deal.name}
                                  </h4>
                                  {deal.badgeText && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/10 text-secondary text-xs font-bold">
                                      <Sparkles className="w-3 h-3" />
                                      {deal.badgeText}
                                    </span>
                                  )}
                                </div>
                                {deal.description && (
                                  <p className="text-xs text-gray-600 dark:text-neutral-400 line-clamp-1">
                                    {deal.description}
                                  </p>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                {isSelected && (
                                  <CircleCheckBig className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mb-1" />
                                )}
                                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                  {deal.dealType === "PERCENTAGE_DISCOUNT" && `${deal.discountPercentage}% OFF`}
                                  {deal.dealType === "FIXED_DISCOUNT" && `Rs ${deal.discountAmount} OFF`}
                                  {deal.dealType === "MINIMUM_PURCHASE" && `Spend Rs ${deal.minimumPurchase}`}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-3 p-4 rounded-xl bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800">
                <div className="flex justify-between text-base">
                  <span className="text-gray-600 dark:text-neutral-400 font-medium">Subtotal</span>
                  <span className="font-bold text-gray-900 dark:text-white">Rs {subtotal.toFixed(0)}</span>
                </div>
                {dealDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5" />
                      Deal Discount
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">-Rs {dealDiscount.toFixed(0)}</span>
                  </div>
                )}
                {manualDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-neutral-400 font-medium">Manual Discount</span>
                    <span className="font-bold text-gray-600 dark:text-neutral-400">-Rs {manualDiscount.toFixed(0)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t-2 border-gray-100 dark:border-neutral-700">
                  <span className="text-lg font-bold text-gray-900 dark:text-white">Total</span>
                  <span className="text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    Rs {total.toFixed(0)}
                  </span>
                </div>
              </div>

              {!showCheckout ? (
                <button
                  onClick={() => setShowCheckout(true)}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-bold text-base shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:-translate-y-1 transition-all"
                >
                  <Receipt className="w-5 h-5" />
                  Proceed to Checkout
                </button>
              ) : (
                <div className="space-y-4">
                  {/* Waiter Selector */}
                  <div>
                    <label className="text-sm font-bold text-gray-700 dark:text-neutral-300 mb-2 flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Assign Waiter
                    </label>
                    <select
                      value={selectedWaiter}
                      onChange={(e) => setSelectedWaiter(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                    >
                      <option value="">Select Waiter</option>
                      <option value="John Doe">John Doe</option>
                      <option value="Jane Smith">Jane Smith</option>
                      <option value="Mike Johnson">Mike Johnson</option>
                      <option value="Sarah Williams">Sarah Williams</option>
                    </select>
                  </div>
                  
                  {/* Table Number (shown only for dine-in) */}
                  {orderType === "DINE_IN" && (
                    <div>
                      <label className="text-sm font-bold text-gray-700 dark:text-neutral-300 mb-2 flex items-center gap-2">
                        <Utensils className="w-4 h-4" />
                        Table Number
                      </label>
                      <input
                        type="text"
                        value={tableNumber}
                        onChange={(e) => setTableNumber(e.target.value)}
                        placeholder="e.g., Table 5"
                        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                      />
                    </div>
                  )}
                  
                  {/* Customer Details Dropup */}
                  <div className="rounded-2xl border-2 border-gray-200 dark:border-neutral-700 overflow-hidden bg-white dark:bg-neutral-950 shadow-sm">
                    <button
                      type="button"
                      onClick={() => setShowCustomerDetails(!showCustomerDetails)}
                      className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-bold text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors"
                    >
                      <span className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-primary" />
                        </div>
                        Customer Info
                        {(customerName || customerPhone) && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">Added</span>
                        )}
                      </span>
                      <ChevronDown className={`w-4 h-4 transition-transform duration-300 ${showCustomerDetails ? "rotate-180" : ""}`} />
                    </button>
                    <div
                      className="transition-all duration-300 ease-in-out overflow-hidden"
                      style={{ maxHeight: showCustomerDetails ? "300px" : "0px", opacity: showCustomerDetails ? 1 : 0 }}
                    >
                      <div className="p-5 space-y-3 border-t-2 border-gray-100 dark:border-neutral-700 bg-gradient-to-br from-gray-50 to-white dark:from-neutral-900 dark:to-neutral-950">
                        <input
                          type="text"
                          placeholder="Customer name"
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                        />
                        <input
                          type="tel"
                          placeholder="Phone number"
                          value={customerPhone}
                          onChange={(e) => setCustomerPhone(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                        />
                        <input
                          type="text"
                          placeholder="Delivery address"
                          value={customerAddress}
                          onChange={(e) => setCustomerAddress(e.target.value)}
                          className="w-full px-4 py-3 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                  {/* Manual Discount Input */}
                  <div>
                    <label className="text-sm font-bold text-gray-700 dark:text-neutral-300 mb-2 flex items-center gap-2">
                      <Percent className="w-4 h-4" />
                      Additional Discount (Optional)
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="Manual discount amount"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 outline-none transition-all"
                    />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
                      <CreditCard className="w-4 h-4" />
                      Payment Method
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("CASH")}
                        className={`flex flex-col items-center gap-2 px-4 py-4 rounded-xl text-sm font-bold transition-all ${
                          paymentMethod === "CASH"
                            ? "bg-gradient-to-br from-primary to-secondary text-white shadow-lg"
                            : "bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:border-primary"
                        }`}
                      >
                        <Banknote className="w-6 h-6" />
                        Cash
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("CARD")}
                        className={`flex flex-col items-center gap-2 px-4 py-4 rounded-xl text-sm font-bold transition-all ${
                          paymentMethod === "CARD"
                            ? "bg-gradient-to-br from-primary to-secondary text-white shadow-lg"
                            : "bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:border-primary"
                        }`}
                      >
                        <CreditCard className="w-6 h-6" />
                        Card
                      </button>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-700 dark:text-neutral-300 mb-3 flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Order Type
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setOrderType("DINE_IN")}
                        className={`flex items-center justify-center gap-2 px-4 py-4 rounded-xl text-sm font-bold transition-all ${
                          orderType === "DINE_IN"
                            ? "bg-gradient-to-br from-primary to-secondary text-white shadow-lg"
                            : "bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:border-primary/30"
                        }`}
                      >
                        <Utensils className="w-4 h-4" />
                        Dine-in
                      </button>
                      <button
                        type="button"
                        onClick={() => setOrderType("TAKEAWAY")}
                        className={`flex items-center justify-center gap-2 px-4 py-4 rounded-xl text-sm font-bold transition-all ${
                          orderType === "TAKEAWAY"
                            ? "bg-gradient-to-br from-primary to-secondary text-white shadow-lg"
                            : "bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 hover:border-primary/30"
                        }`}
                      >
                        <ShoppingCart className="w-4 h-4" />
                        Takeaway
                      </button>
                    </div>
                  </div>
                  
                  <button
                    onClick={handleCheckout}
                    disabled={loading}
                    className="w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-600 text-white font-bold text-base shadow-2xl shadow-emerald-500/30 hover:shadow-emerald-500/50 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:translate-y-0 disabled:shadow-lg flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Processing Order...
                      </>
                    ) : (
                      <>
                        <CircleCheckBig className="w-6 h-6" />
                        Complete Order · Rs {total.toFixed(0)}
                      </>
                    )}
                  </button>
                  
                  <button
                    onClick={() => setShowCheckout(false)}
                    className="w-full px-5 py-3 rounded-xl bg-white dark:bg-neutral-950 border-2 border-gray-200 dark:border-neutral-700 text-sm font-bold text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900 hover:border-gray-300 transition-all"
                  >
                    ← Back to Cart
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
