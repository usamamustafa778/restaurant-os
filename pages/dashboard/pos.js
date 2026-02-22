import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { useRouter } from "next/router";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  getMenu,
  getBranchMenu,
  getOrders,
  createPosOrder,
  getOrder,
  updateOrder,
  SubscriptionInactiveError,
  getActiveDealsByBranch,
  findApplicableDeals,
  getStoredAuth,
  getPosDrafts,
  createPosDraft,
  updatePosDraft,
  deletePosDraft,
  getPosDraft,
  getPosTransactions,
  getPosTransaction,
  deletePosTransaction,
  getTables,
  getCustomers,
  createCustomer,
  getBranch,
  updateBranch,
} from "../../lib/apiClient";
import { useBranch } from "../../contexts/BranchContext";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Receipt,
  CreditCard,
  Banknote,
  ChevronUp,
  ChevronDown,
  User,
  Loader2,
  CircleCheckBig,
  ChevronLeft,
  ChevronRight,
  Clock,
  Utensils,
  FileText,
  Printer,
  Flame,
  Star,
  Users,
  Percent,
  Tag,
  Sparkles,
  Settings,
  HelpCircle,
} from "lucide-react";
import toast from "react-hot-toast";

export default function POSPage() {
  const router = useRouter();
  const { currentBranch } = useBranch() || {};
  const [menu, setMenu] = useState({ categories: [], items: [] });
  const [cart, setCart] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editingOrder, setEditingOrder] = useState(null);
  const [loadingEditOrder, setLoadingEditOrder] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [menuSearchQuery, setMenuSearchQuery] = useState("");
  const [searchStep, setSearchStep] = useState("quantity"); // 'quantity' | 'itemName'
  const [searchQuantityInput, setSearchQuantityInput] = useState("");
  const [pendingAddQuantity, setPendingAddQuantity] = useState(1);
  const [focusedItemIndex, setFocusedItemIndex] = useState(0);
  const focusedCardRef = useRef(null);
  const orderStripRef = useRef(null);
  const orderStripOffsetRef = useRef(0);
  const orderStripRafRef = useRef(null);
  const orderStripLastTimeRef = useRef(null);
  const orderStripPausedRef = useRef(false);
  const menuSearchInputRef = useRef(null);
  const orderSearchInputRef = useRef(null);
  const amountReceivedInputRef = useRef(null);
  const [gridCols, setGridCols] = useState(4);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [showCustomerDetails, setShowCustomerDetails] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [orderType, setOrderType] = useState("DINE_IN");
  const [discountAmount, setDiscountAmount] = useState("");
  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [suspended, setSuspended] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarHydrated, setSidebarHydrated] = useState(false);

  // New features from Dream POS
  const [dietaryFilter, setDietaryFilter] = useState("all"); // all, veg, non-veg, egg
  const [orderFilter, setOrderFilter] = useState("all"); // all, dine-in, takeaway, delivery
  const [recentOrderSearch, setRecentOrderSearch] = useState(""); // search by order ID
  const [selectedWaiter, setSelectedWaiter] = useState("");
  const [tableNumber, setTableNumber] = useState("");
  const [tableName, setTableName] = useState("");
  const [tables, setTables] = useState([]);
  const [itemNotes, setItemNotes] = useState({}); // { itemId: "note text" }
  const [recentOrders, setRecentOrders] = useState([]);
  const [currentOrderIndex, setCurrentOrderIndex] = useState(0);
  const [focusedOrderIndex, setFocusedOrderIndex] = useState(0);
  const [orderGridHovered, setOrderGridHovered] = useState(false);

  // Deals integration
  const [availableDeals, setAvailableDeals] = useState([]);
  const [selectedDeals, setSelectedDeals] = useState([]);
  const [showDealsSection, setShowDealsSection] = useState(false);
  const [applicableDeals, setApplicableDeals] = useState([]);
  const [dealDiscount, setDealDiscount] = useState(0);

  // Expanded cart items (for showing price details)
  const [expandedCartItems, setExpandedCartItems] = useState([]);
  
  // Print receipt modal
  const [showPrintModal, setShowPrintModal] = useState(false);

  // POS optional fields visibility (per branch); not shown until loaded to avoid flash on reload
  const [showTablePos, setShowTablePos] = useState(true);
  const [showWaiterPos, setShowWaiterPos] = useState(true);
  const [showCustomerPos, setShowCustomerPos] = useState(true);
  const [posOptionsLoaded, setPosOptionsLoaded] = useState(false);
  const [showPosTableSettingsModal, setShowPosTableSettingsModal] = useState(false);
  const [posTableSettingsDraft, setPosTableSettingsDraft] = useState(true);
  const [posWaiterSettingsDraft, setPosWaiterSettingsDraft] = useState(true);
  const [posCustomerSettingsDraft, setPosCustomerSettingsDraft] = useState(true);
  const [posTableSettingsSaving, setPosTableSettingsSaving] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  
  // Invoice modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  
  // Draft management
  const [showTransactionsModal, setShowTransactionsModal] = useState(false);
  const [transactionTab, setTransactionTab] = useState("sale"); // 'sale' or 'draft'
  const [drafts, setDrafts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loadingDrafts, setLoadingDrafts] = useState(false);
  const [loadingTransactions, setLoadingTransactions] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");

  // Take payment modal (Cash/Card)
  const [showTakePaymentModal, setShowTakePaymentModal] = useState(false);
  const [amountReceived, setAmountReceived] = useState("");
  const [paymentError, setPaymentError] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Customer modal (select or add)
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalMode, setCustomerModalMode] = useState("select"); // 'select' | 'add'
  const [customersList, setCustomersList] = useState([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerModalLoading, setCustomerModalLoading] = useState(false);
  const [customerModalError, setCustomerModalError] = useState("");
  const [customerAddForm, setCustomerAddForm] = useState({ name: "", phone: "", address: "", notes: "" });
  const [quickCustomerName, setQuickCustomerName] = useState("");
  const [addingQuickCustomer, setAddingQuickCustomer] = useState(false);

  // Check sidebar state from sessionStorage before showing grid (so reload with closed sidebar → 5 cols)
  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    const collapsed = sessionStorage.getItem("sidebar_collapsed") === "true";
    setSidebarOpen(!collapsed);
    setSidebarHydrated(true);
  }, []);

  useEffect(() => {
    loadMenu();
    loadActiveDeals();
    loadDrafts();
    loadTransactions();
    loadTables();
    loadRecentOrders();

    // Listen for sidebar toggle events from AdminLayout
    function handleSidebarToggle(e) {
      setSidebarOpen(!e.detail.collapsed);
    }
    window.addEventListener("sidebar-toggle", handleSidebarToggle);
    return () =>
      window.removeEventListener("sidebar-toggle", handleSidebarToggle);
  }, [currentBranch]);

  // Load POS options (table/waiter/customer visibility) for current branch; don't show until loaded to avoid flash
  useEffect(() => {
    if (!currentBranch?.id) {
      setShowTablePos(true);
      setShowWaiterPos(true);
      setShowCustomerPos(true);
      setPosOptionsLoaded(true);
      return;
    }
    setPosOptionsLoaded(false);
    let cancelled = false;
    getBranch(currentBranch.id)
      .then((b) => {
        if (!cancelled) {
          setShowTablePos(b?.showTablePos !== false);
          setShowWaiterPos(b?.showWaiterPos !== false);
          setShowCustomerPos(b?.showCustomerPos !== false);
          setPosOptionsLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShowTablePos(true);
          setShowWaiterPos(true);
          setShowCustomerPos(true);
          setPosOptionsLoaded(true);
        }
      });
    return () => { cancelled = true; };
  }, [currentBranch?.id]);

  useEffect(() => {
    setCurrentOrderIndex(0);
  }, [orderFilter]);

  useEffect(() => {
    setCurrentOrderIndex(0);
  }, [recentOrderSearch]);

  useEffect(() => {
    focusedCardRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [focusedItemIndex]);

  // Until we've read sessionStorage, assume sidebar closed (5 cols). Then use sidebarOpen.
  const effectiveSidebarOpen = sidebarHydrated ? sidebarOpen : false;

  // Match grid columns to Tailwind: sidebarOpen ? grid-cols-3 xl:grid-cols-4 : grid-cols-4 xl:grid-cols-5
  useEffect(() => {
    const updateCols = () => {
      if (typeof window === "undefined") return;
      const xl = window.innerWidth >= 1280;
      setGridCols(effectiveSidebarOpen ? (xl ? 4 : 3) : (xl ? 5 : 4));
    };
    updateCols();
    window.addEventListener("resize", updateCols);
    return () => window.removeEventListener("resize", updateCols);
  }, [effectiveSidebarOpen]);

  // Load order for edit when ?edit=id is in URL
  useEffect(() => {
    const editId = router.query.edit;
    if (!editId || !menu?.items?.length) return;

    let cancelled = false;
    setLoadingEditOrder(true);
    setEditingOrderId(null);
    setEditingOrder(null);

    getOrder(editId)
      .then((order) => {
        if (cancelled) return;
        const items = order.items || [];
        const menuItems = menu.items || [];
        const cartItems = items.map((it) => {
          const menuItemId = it.menuItemId || null;
          let id = menuItemId;
          let price = it.unitPrice ?? 0;
          let imageUrl = "";
          if (!id) {
            const byName = menuItems.find((m) => (m.name || "").toLowerCase() === (it.name || "").toLowerCase());
            if (byName) {
              id = byName.id;
              price = byName.finalPrice ?? byName.price ?? price;
              imageUrl = byName.imageUrl || "";
            } else {
              id = `edit-${it.name}-${Math.random().toString(36).slice(2)}`;
            }
          } else {
            const mi = menuItems.find((m) => (m.id || m._id) === id);
            if (mi) {
              imageUrl = mi.imageUrl || "";
              price = mi.finalPrice ?? mi.price ?? price;
            }
          }
          return {
            id,
            name: it.name,
            price,
            quantity: it.qty ?? 1,
            imageUrl,
          };
        });
        setCart(cartItems);
        setCustomerName(order.customerName || "");
        setCustomerPhone(order.customerPhone || "");
        setCustomerAddress(order.deliveryAddress || "");
        setOrderType(
          order.type === "takeaway" ? "TAKEAWAY" : order.type === "delivery" ? "DELIVERY" : "DINE_IN"
        );
        setTableName(order.tableName || "");
        setDiscountAmount(order.discountAmount ? String(order.discountAmount) : "");
        setEditingOrderId(order._id || order.id);
        setEditingOrder(order);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err.message || "Failed to load order");
          router.replace("/dashboard/pos");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingEditOrder(false);
      });

    return () => { cancelled = true; };
  }, [router.query.edit, menu?.items?.length]);

  async function loadTables() {
    try {
      const data = await getTables();
      setTables(Array.isArray(data) ? data : []);
    } catch (err) {
      setTables([]);
    }
  }

  async function loadCustomersForModal() {
    setCustomerModalLoading(true);
    setCustomerModalError("");
    try {
      const list = await getCustomers(false);
      setCustomersList(Array.isArray(list) ? list : []);
    } catch (err) {
      setCustomerModalError(err.message || "Failed to load customers");
      setCustomersList([]);
    } finally {
      setCustomerModalLoading(false);
    }
  }

  function openCustomerModal() {
    setShowCustomerModal(true);
    setCustomerModalMode("select");
    setCustomerSearch("");
    setCustomerModalError("");
    setCustomerAddForm({ name: "", phone: "", address: "", notes: "" });
    setQuickCustomerName("");
    setAddingQuickCustomer(false);
    loadCustomersForModal();
  }

  function closeCustomerModal() {
    setShowCustomerModal(false);
    setCustomerModalError("");
  }

  function selectCustomerForOrder(customer) {
    setCustomerName(customer.name || "");
    setCustomerPhone(customer.phone || "");
    setCustomerAddress(customer.address || "");
    closeCustomerModal();
  }

  async function handleAddCustomerSubmit(e) {
    e.preventDefault();
    const { name, phone, address, notes } = customerAddForm;
    if (!name?.trim() || !phone?.trim()) {
      setCustomerModalError("Name and phone are required");
      return;
    }
    setCustomerModalLoading(true);
    setCustomerModalError("");
    try {
      const created = await createCustomer({
        name: name.trim(),
        phone: phone.trim(),
        address: (address || "").trim() || undefined,
        notes: (notes || "").trim() || undefined,
      });
      selectCustomerForOrder(created);
      toast.success("Customer added");
    } catch (err) {
      setCustomerModalError(err.message || "Failed to add customer");
    } finally {
      setCustomerModalLoading(false);
    }
  }

  async function handleQuickAddCustomer() {
    const phone = customerSearch.trim();
    const name = quickCustomerName.trim();
    if (!phone || !name) {
      setCustomerModalError("Enter customer name and phone to add");
      return;
    }
    setAddingQuickCustomer(true);
    setCustomerModalError("");
    try {
      const created = await createCustomer({
        name,
        phone,
      });
      // Optimistically add to list and select
      setCustomersList((prev) => [created, ...prev]);
      selectCustomerForOrder(created);
      toast.success("Customer added");
    } catch (err) {
      setCustomerModalError(err.message || "Failed to add customer");
    } finally {
      setAddingQuickCustomer(false);
    }
  }

  function openTakePaymentModal(method) {
    setPaymentMethod(method);
    setAmountReceived("");
    setPaymentError("");
    setShowTakePaymentModal(true);
  }

  function closeTakePaymentModal() {
    setShowTakePaymentModal(false);
    setPaymentError("");
  }

  // Focus "Amount received" input when Take payment modal opens (e.g. via Ctrl+Shift+C)
  useEffect(() => {
    if (!showTakePaymentModal || paymentMethod !== "CASH") return;
    const t = setTimeout(() => amountReceivedInputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, [showTakePaymentModal, paymentMethod]);

  async function handleTakePaymentSubmit(e) {
    e.preventDefault();
    if (cart.length === 0) {
      setPaymentError("Cart is empty");
      return;
    }
    const billTotal = total;
    if (paymentMethod === "CASH") {
      const received = Number(amountReceived);
      if (isNaN(received) || received < billTotal) {
        setPaymentError(`Amount received must be at least Rs ${billTotal.toFixed(0)}`);
        return;
      }
    }
    setPaymentLoading(true);
    setPaymentError("");
    const toastId = toast.loading("Processing...");
    try {
      const result = await createPosOrder({
        items: cart.map((item) => ({ menuItemId: item.id, quantity: item.quantity })),
        orderType,
        paymentMethod,
        discountAmount: totalDiscount,
        appliedDeals:
          selectedDeals.length > 0
            ? selectedDeals.map((dealId) => {
                const deal = applicableDeals.find((d) => d.id === dealId);
                return { dealId, dealName: deal?.name || "", dealType: deal?.dealType || "" };
              })
            : undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: customerAddress.trim(),
        branchId: currentBranch?.id ?? undefined,
        tableName: orderType === "DINE_IN" && tableName ? tableName : undefined,
        ...(paymentMethod === "CASH" && amountReceived !== "" ? { amountReceived: Number(amountReceived) } : {}),
      });
      toast.success("Order placed and payment recorded", { id: toastId });
      const orderNum = result?.orderNumber ?? result?.id ?? "";
      const received = paymentMethod === "CASH" ? Number(amountReceived) : total;
      const returned = paymentMethod === "CASH" ? Math.max(0, received - total) : 0;
      printPaymentBill({
        orderNumber: orderNum,
        id: orderNum,
        paymentMethod,
        paymentAmountReceived: received,
        paymentAmountReturned: returned,
        createdAt: new Date().toISOString(),
      });
      closeTakePaymentModal();
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDiscountAmount("");
      setSelectedDeals([]);
      setDealDiscount(0);
      setShowCustomerDetails(false);
      setTableName("");
      loadRecentOrders();
    } catch (err) {
      setPaymentError(err.message || "Failed to place order");
      toast.error(err.message || "Failed to place order", { id: toastId });
    } finally {
      setPaymentLoading(false);
    }
  }

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
      setPageLoading(false);
    } catch (err) {
      if (err instanceof SubscriptionInactiveError) {
        setSuspended(true);
      } else {
        console.error("Failed to load menu:", err);
        toast.error(err.message || "Failed to load menu");
      }
      setPageLoading(false);
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
      const orderItems = cart.map((item) => ({
        menuItemId: item.id,
        quantity: item.quantity,
        price: item.price,
      }));

      const deals = await findApplicableDeals(
        orderItems,
        subtotal,
        null, // customerId - can be added if tracking customer deals
        currentBranch?.id,
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

    deals.forEach((deal) => {
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
    const deal = applicableDeals.find((d) => d.id === dealId);
    if (!deal) return;

    if (selectedDeals.includes(dealId)) {
      // Deselect
      const newSelected = selectedDeals.filter((id) => id !== dealId);
      setSelectedDeals(newSelected);
      const selectedDealObjects = applicableDeals.filter((d) =>
        newSelected.includes(d.id),
      );
      calculateDealDiscount(selectedDealObjects);
    } else {
      // Select (if stacking allowed, add to list; otherwise replace)
      const newSelected = deal.allowStacking
        ? [...selectedDeals, dealId]
        : [dealId];
      setSelectedDeals(newSelected);
      const selectedDealObjects = applicableDeals.filter((d) =>
        newSelected.includes(d.id),
      );
      calculateDealDiscount(selectedDealObjects);
    }
  }

  const filteredItems = menu.items.filter((item) => {
    const matchesCategory =
      selectedCategory === "all" || item.categoryId === selectedCategory;
    const matchesSearch =
      searchStep !== "itemName" ||
      item.name.toLowerCase().includes(menuSearchQuery.toLowerCase());

    // Dietary filter (mock - in production, items should have a dietaryType field)
    const matchesDietary =
      dietaryFilter === "all" ||
      (dietaryFilter === "veg" && item.name.toLowerCase().includes("veg")) ||
      (dietaryFilter === "non-veg" &&
        !item.name.toLowerCase().includes("veg")) ||
      (dietaryFilter === "egg" && item.name.toLowerCase().includes("egg"));

    // Use finalAvailable if available (branch-aware), otherwise fall back to available
    const isAvailable = item.finalAvailable ?? item.available;
    return matchesCategory && matchesSearch && matchesDietary && isAvailable;
  });

  const filteredRecentOrders = recentOrders
    .filter((o) => orderFilter === "all" || o.type === orderFilter)
    .filter(
      (o) =>
        !recentOrderSearch.trim() ||
        (o.id && String(o.id).toLowerCase().includes(recentOrderSearch.trim().toLowerCase())),
    );

  // Focus first order when search or filter changes
  useEffect(() => {
    setFocusedOrderIndex(0);
    setCurrentOrderIndex(0);
  }, [recentOrderSearch, orderFilter]);

  // Clamp focused order index when filtered list shrinks
  useEffect(() => {
    if (filteredRecentOrders.length > 0 && focusedOrderIndex >= filteredRecentOrders.length) {
      setFocusedOrderIndex(Math.max(0, filteredRecentOrders.length - 1));
    }
  }, [filteredRecentOrders.length, focusedOrderIndex]);

  // Keep pause state in ref so animation loop doesn't need to re-run when hover/search changes
  orderStripPausedRef.current = orderGridHovered || recentOrderSearch.trim() !== "";

  // Continuous order strip: single list, scroll 0% → 100% then reset to 0% (no duplicate orders)
  const orderColsCount = effectiveSidebarOpen ? 4 : 5;
  useEffect(() => {
    if (filteredRecentOrders.length <= orderColsCount) return;
    orderStripOffsetRef.current = 0;
    orderStripLastTimeRef.current = null;

    const durationMs = 25000; // 25 seconds for one full pass
    const totalTravel = 100; // percent (full list)

    const tick = (timestamp) => {
      orderStripLastTimeRef.current ??= timestamp;
      const delta = timestamp - orderStripLastTimeRef.current;
      orderStripLastTimeRef.current = timestamp;

      if (!orderStripPausedRef.current) {
        orderStripOffsetRef.current += (delta / durationMs) * totalTravel;
        if (orderStripOffsetRef.current >= totalTravel) {
          orderStripOffsetRef.current = 0; // loop back to start
        }
      }
      if (orderStripRef.current) {
        orderStripRef.current.style.transform = `translateX(-${orderStripOffsetRef.current}%)`;
      }
      orderStripRafRef.current = requestAnimationFrame(tick);
    };
    orderStripRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (orderStripRafRef.current) cancelAnimationFrame(orderStripRafRef.current);
    };
  }, [filteredRecentOrders.length, orderColsCount]);

  // When search is active, scroll the strip so the focused order card is fully in view (not half hidden)
  useEffect(() => {
    const hasSearch = recentOrderSearch.trim() !== "";
    if (!hasSearch || filteredRecentOrders.length === 0) return;
    const totalCards = filteredRecentOrders.length;
    const idx = Math.max(0, Math.min(focusedOrderIndex, totalCards - 1));
    const offset = totalCards > 0 ? (idx / totalCards) * 100 : 0;
    orderStripOffsetRef.current = offset;
    if (orderStripRef.current) {
      orderStripRef.current.style.transform = `translateX(-${offset}%)`;
    }
  }, [recentOrderSearch, focusedOrderIndex, filteredRecentOrders.length]);

  // Clamp focused item index when filtered list shrinks
  useEffect(() => {
    if (filteredItems.length > 0 && focusedItemIndex >= filteredItems.length) {
      setFocusedItemIndex(Math.max(0, filteredItems.length - 1));
    }
  }, [filteredItems.length, focusedItemIndex]);

  const addToCart = (item, qty = 1) => {
    const quantity = Math.max(1, Math.floor(Number(qty)) || 1);
    const existingItem = cart.find((i) => i.id === item.id);
    if (existingItem) {
      setCart(
        cart.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + quantity } : i,
        ),
      );
    } else {
      const itemPrice = item.finalPrice ?? item.price;
      setCart([...cart, { ...item, price: itemPrice, quantity }]);
    }
  };

  const updateQuantity = (itemId, change) => {
    setCart(
      cart
        .map((item) => {
          if (item.id === itemId) {
            const newQty = item.quantity + change;
            return { ...item, quantity: Math.max(0, newQty) };
          }
          return item;
        })
        .filter((item) => item.quantity > 0),
    );
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter((item) => item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setShowCheckout(false);
    setItemNotes({});
    setTableNumber("");
    setTableName("");
    setSelectedWaiter("");
    setSelectedDeals([]);
    setDealDiscount(0);
    setDiscountAmount("");
  };

  const addNoteToItem = (itemId) => {
    const note = prompt("Add special instructions for this item:");
    if (note !== null) {
      setItemNotes((prev) => ({ ...prev, [itemId]: note.trim() }));
    }
  };

  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const manualDiscount = discountAmount ? Number(discountAmount) : 0;
  const totalDiscount = dealDiscount + manualDiscount;
  const total = Math.max(0, subtotal - totalDiscount);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty!");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Processing order...");

    try {
      const result = await createPosOrder({
        items: cart.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
        })),
        orderType,
        paymentMethod: "PENDING",
        discountAmount: totalDiscount,
        appliedDeals:
          selectedDeals.length > 0
            ? selectedDeals.map((dealId) => {
                const deal = applicableDeals.find((d) => d.id === dealId);
                return {
                  dealId: dealId,
                  dealName: deal?.name || "",
                  dealType: deal?.dealType || "",
                };
              })
            : undefined,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: customerAddress.trim(),
        branchId: currentBranch?.id ?? undefined,
        tableName: orderType === "DINE_IN" && tableName ? tableName : undefined,
      });

      toast.success(
        `Order ${result.orderNumber || ""} placed successfully! Total: PKR ${result.total}`,
        { id: toastId }
      );
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDiscountAmount("");
      setSelectedDeals([]);
      setDealDiscount(0);
      setShowCustomerDetails(false);
      setShowCheckout(false);
      setTableName("");
      loadRecentOrders();
    } catch (err) {
      toast.error(err.message || "Failed to place order", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateOrder = async () => {
    if (!editingOrderId || cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    setLoading(true);
    const toastId = toast.loading("Updating order...");
    try {
      await updateOrder(editingOrderId, {
        items: cart.map((item) => ({
          menuItemId: String(item.id).startsWith("edit-") ? null : item.id,
          quantity: item.quantity,
          unitPrice: item.price,
          name: item.name,
        })),
        discountAmount: totalDiscount,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: customerAddress.trim(),
        orderType,
        tableName: orderType === "DINE_IN" && tableName ? tableName : undefined,
      });
      toast.success("Order updated successfully!", { id: toastId });
      setEditingOrderId(null);
      setEditingOrder(null);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setCustomerAddress("");
      setDiscountAmount("");
      setTableName("");
      setShowCheckout(false);
      loadRecentOrders();
      router.replace("/dashboard/pos");
    } catch (err) {
      toast.error(err.message || "Failed to update order", { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  // Build order-like object from current cart for printing (optionally with payment details)
  function buildOrderLikeFromCart(overrides = {}) {
    const typeLabel =
      orderType === "DINE_IN"
        ? tableName
          ? `Dine In (${tableName})`
          : "dine-in"
        : orderType === "TAKEAWAY"
          ? "takeaway"
          : "delivery";
    return {
      id: overrides.orderNumber ?? overrides.id ?? `POS-${Date.now()}`,
      orderNumber: overrides.orderNumber ?? `POS-${Date.now()}`,
      createdAt: overrides.createdAt ?? new Date().toISOString(),
      customerName: customerName.trim() || "Walk-in",
      type: typeLabel,
      paymentMethod: overrides.paymentMethod ?? "To be paid",
      paymentAmountReceived: overrides.paymentAmountReceived ?? null,
      paymentAmountReturned: overrides.paymentAmountReturned ?? null,
      discountAmount: totalDiscount,
      subtotal,
      total,
      items: cart.map((it) => ({
        name: it.name,
        qty: it.quantity,
        unitPrice: it.price,
      })),
      ...overrides,
    };
  }

  // Open print window for Customer Bill (menu bill) or Order Receipt (payment bill)
  function posPrintBill(orderLike, mode) {
    const win = window.open("", "_blank", "width=360,height=600");
    if (!win) {
      toast.error("Allow popups to print");
      return;
    }
    const itemsHtml = (orderLike.items || [])
      .map(
        (it) =>
          `<tr>
          <td style="padding:4px 0;border-bottom:1px dashed #ddd">${(it.name || "").replace(/</g, "&lt;")}</td>
          <td style="padding:4px 8px;text-align:center;border-bottom:1px dashed #ddd">${it.qty ?? 1}</td>
          <td style="padding:4px 0;text-align:right;border-bottom:1px dashed #ddd">Rs ${((it.unitPrice || 0) * (it.qty || 1)).toFixed(0)}</td>
        </tr>`
      )
      .join("");
    const discount = orderLike.discountAmount || 0;
    const hasPaymentDetails =
      orderLike.paymentAmountReceived != null && orderLike.paymentAmountReceived > 0;
    const isReceipt = mode === "receipt" || hasPaymentDetails;
    const headerLabel = isReceipt ? "Order Receipt" : "Customer Bill";
    const paymentLabel =
      orderLike.paymentMethod ||
      (isReceipt ? "Cash" : "To be paid");
    const orderId = orderLike.orderNumber || orderLike.id || "";
    const returnAmount =
      orderLike.paymentAmountReturned != null
        ? Number(orderLike.paymentAmountReturned)
        : hasPaymentDetails && orderLike.paymentAmountReceived != null
          ? Math.max(0, Number(orderLike.paymentAmountReceived) - (orderLike.total || 0))
          : 0;
    const paymentExtra =
      isReceipt && hasPaymentDetails
        ? `<div><strong>Amount received:</strong> Rs ${Number(orderLike.paymentAmountReceived).toFixed(0)}</div><div><strong>Return:</strong> Rs ${returnAmount.toFixed(0)}</div>`
        : "";
    win.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${isReceipt ? "Receipt" : "Bill"} – ${orderId}</title>
  <style>
    body { font-family: 'Courier New', monospace; margin: 0; padding: 16px; font-size: 13px; color: #222; }
    .center { text-align: center; }
    hr { border: none; border-top: 1px dashed #999; margin: 10px 0; }
    table { width: 100%; border-collapse: collapse; }
    .total-row td { font-weight: bold; padding-top: 6px; }
  </style>
</head>
<body>
  <div class="center" style="font-size:16px;font-weight:bold;margin-bottom:4px;">Eats Desk</div>
  <div class="center" style="font-size:11px;color:#666;margin-bottom:8px;">${headerLabel}</div>
  <hr/>
  <div><strong>Order:</strong> ${String(orderId).replace(/^ORD-/, "")}</div>
  <div><strong>Date:</strong> ${new Date(orderLike.createdAt).toLocaleString()}</div>
  <div><strong>Customer:</strong> ${(orderLike.customerName || "Walk-in").replace(/</g, "&lt;")}</div>
  <div><strong>Type:</strong> ${(orderLike.type || "dine-in").replace(/</g, "&lt;")}</div>
  <div><strong>Payment:</strong> ${paymentLabel}</div>
  ${paymentExtra}
  <hr/>
  <table>
    <thead>
      <tr style="font-weight:bold;border-bottom:1px solid #999">
        <td style="padding:4px 0">Item</td>
        <td style="padding:4px 8px;text-align:center">Qty</td>
        <td style="padding:4px 0;text-align:right">Amount</td>
      </tr>
    </thead>
    <tbody>${itemsHtml}</tbody>
  </table>
  <hr/>
  <table>
    <tr><td>Subtotal</td><td style="text-align:right">Rs ${(orderLike.subtotal || orderLike.total || 0).toFixed(0)}</td></tr>
    ${discount > 0 ? `<tr><td>Discount</td><td style="text-align:right">- Rs ${Number(discount).toFixed(0)}</td></tr>` : ""}
    <tr class="total-row" style="font-size:15px"><td>Grand Total</td><td style="text-align:right">Rs ${(orderLike.total || 0).toFixed(0)}</td></tr>
  </table>
  <hr/>
  <div class="center" style="font-size:11px;color:#888;margin-top:12px;">Thank you for your order!</div>
  <script>window.onload = function() { window.print(); };<\/script>
</body>
</html>`);
    win.document.close();
  }

  function printMenuBill() {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    posPrintBill(buildOrderLikeFromCart(), "bill");
  }

  function printPaymentBill(overrides = {}) {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    posPrintBill(buildOrderLikeFromCart(overrides), "receipt");
  }

  // Keyboard shortcuts: Esc (close payment modal or clear cart), Ctrl/Cmd + Shift + ...
  useEffect(() => {
    const mod = (e) => e.ctrlKey || e.metaKey;
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        if (showShortcutsModal) setShowShortcutsModal(false);
        else if (showTakePaymentModal) closeTakePaymentModal();
        else clearCart();
        return;
      }
      if (!mod(e)) return;
      if (e.shiftKey && (e.key === "M" || e.key === "m")) {
        e.preventDefault();
        menuSearchInputRef.current?.focus();
        return;
      }
      if (e.shiftKey && (e.key === "O" || e.key === "o")) {
        e.preventDefault();
        orderSearchInputRef.current?.focus();
        return;
      }
      if (e.shiftKey && (e.key === "C" || e.key === "c")) {
        e.preventDefault();
        if (cart.length > 0) openTakePaymentModal("CASH");
        else toast.error("Cart is empty");
        return;
      }
      if (e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        if (cart.length > 0) openTakePaymentModal("CARD");
        else toast.error("Cart is empty");
        return;
      }
      if (e.shiftKey && (e.key === "B" || e.key === "b")) {
        e.preventDefault();
        printMenuBill();
        return;
      }
      if (e.shiftKey && (e.key === "R" || e.key === "r")) {
        e.preventDefault();
        printPaymentBill();
        return;
      }
      if (e.shiftKey && (e.key === "E" || e.key === "e")) {
        e.preventDefault();
        setOrderType("DINE_IN");
        return;
      }
      if (e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        setOrderType("TAKEAWAY");
        setTableName("");
        return;
      }
      if (e.shiftKey && (e.key === "L" || e.key === "l")) {
        e.preventDefault();
        setOrderType("DELIVERY");
        setTableName("");
        return;
      }
      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        if (editingOrderId) handleUpdateOrder();
        else handleCheckout();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingOrderId, cart, showTakePaymentModal, showShortcutsModal]);

  async function loadDrafts() {
    setLoadingDrafts(true);
    try {
      const data = await getPosDrafts();
      setDrafts(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load drafts:", err);
      setDrafts([]);
    } finally {
      setLoadingDrafts(false);
    }
  }

  async function loadTransactions() {
    setLoadingTransactions(true);
    try {
      const data = await getPosTransactions();
      setTransactions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load transactions:", err);
      setTransactions([]);
    } finally {
      setLoadingTransactions(false);
    }
  }

  // Recent orders in POS header: unpaid only (paid orders are hidden)
  function formatTimeAgo(createdAt) {
    const date = createdAt ? new Date(createdAt) : new Date();
    const now = new Date();
    const diffMs = now - date;
    const diffM = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMs / 3600000);
    const diffD = Math.floor(diffMs / 86400000);
    if (diffM < 1) return "now";
    if (diffM < 60) return `${diffM}m ago`;
    if (diffH < 24) return `${diffH}h ago`;
    if (diffD < 7) return `${diffD}d ago`;
    return date.toLocaleDateString();
  }

  function formatOrderTime(createdAt) {
    const date = createdAt ? new Date(createdAt) : new Date();
    return date.toLocaleString("en-PK", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  }

  const statusProgress = { UNPROCESSED: 25, PENDING: 50, READY: 75, COMPLETED: 100, CANCELLED: 0 };

  async function loadRecentOrders() {
    try {
      const data = await getOrders();
      const list = Array.isArray(data) ? data : [];
      const unpaid = list
        .filter((o) => o.isPaid !== true && o.status !== "CANCELLED")
        .map((o) => ({
          id: o.id,
          type: o.type || "dine-in",
          customer: o.customerName || "Walk-in",
          time: formatOrderTime(o.createdAt),
          timeAgo: formatTimeAgo(o.createdAt),
          progress: statusProgress[o.status] ?? 25,
        }));
      setRecentOrders(unpaid);
      if (currentOrderIndex >= Math.max(0, unpaid.length - 1)) {
        setCurrentOrderIndex(0);
      }
    } catch (err) {
      console.error("Failed to load recent orders:", err);
      setRecentOrders([]);
    }
  }

  async function saveDraft() {
    if (cart.length === 0) {
      toast.error("Cannot save empty cart as draft!");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Saving draft...");

    try {
      await createPosDraft({
        items: cart.map((item) => ({
          menuItemId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          imageUrl: item.imageUrl,
        })),
        orderType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: customerAddress.trim(),
        discountAmount: totalDiscount,
        subtotal,
        total,
        itemNotes,
        tableNumber,
        tableName: orderType === "DINE_IN" && tableName ? tableName : undefined,
        selectedWaiter,
        branchId: currentBranch?.id ?? undefined,
      });

      toast.success("Order saved as draft successfully!", { id: toastId });
      await loadDrafts();

      // Clear cart after saving draft
      clearCart();
    } catch (err) {
      toast.error(err.message || "Failed to save draft", { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  async function loadDraft(draft) {
    const toastId = toast.loading("Loading draft...");
    try {
      // Load draft items into cart
      const loadedItems = draft.items.map((item) => ({
        id: item.menuItemId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        imageUrl: item.imageUrl,
      }));

      setCart(loadedItems);
      setOrderType(draft.orderType || "DINE_IN");
      setCustomerName(draft.customerName || "");
      setCustomerPhone(draft.customerPhone || "");
      setCustomerAddress(draft.deliveryAddress || "");
      setTableNumber(draft.tableNumber || "");
      setTableName(draft.tableName || "");
      setSelectedWaiter(draft.selectedWaiter || "");

      if (draft.itemNotes) {
        setItemNotes(draft.itemNotes);
      }

      setShowTransactionsModal(false);
      toast.success("Draft loaded successfully!", { id: toastId });
    } catch (err) {
      toast.error(err.message || "Failed to load draft", { id: toastId });
    }
  }

  async function removeDraft(id) {
    if (!confirm("Are you sure you want to delete this draft?")) return;

    const toastId = toast.loading("Deleting draft...");
    try {
      await deletePosDraft(id);
      toast.success("Draft deleted successfully!", { id: toastId });
      await loadDrafts();
    } catch (err) {
      toast.error(err.message || "Failed to delete draft", { id: toastId });
    }
  }

  async function removeTransaction(id) {
    if (!confirm("Are you sure you want to delete this transaction?")) return;

    const toastId = toast.loading("Deleting transaction...");
    try {
      await deletePosTransaction(id);
      toast.success("Transaction deleted successfully!", { id: toastId });
      await loadTransactions();
    } catch (err) {
      toast.error(err.message || "Failed to delete transaction", { id: toastId });
    }
  }

  // Filter and sort drafts
  const filteredDrafts = drafts
    .filter((draft) => {
      const searchLower = searchQuery.toLowerCase();
  return (
        draft.customerName?.toLowerCase().includes(searchLower) ||
        draft.orderNumber?.toLowerCase().includes(searchLower) ||
        draft.ref?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else if (sortBy === "oldest") {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      return 0;
    });

  // Filter and sort transactions
  const filteredTransactions = transactions
    .filter((transaction) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        transaction.customerName?.toLowerCase().includes(searchLower) ||
        transaction.orderNumber?.toLowerCase().includes(searchLower) ||
        transaction.ref?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      if (sortBy === "newest") {
        return new Date(b.createdAt) - new Date(a.createdAt);
      } else if (sortBy === "oldest") {
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      return 0;
    });

  return (
    <AdminLayout title="Point of Sale" suspended={suspended}>
      <div className="grid gap-4 lg:grid-cols-[1fr_400px] h-[calc(100vh-110px)]">
        {/* Left Column - Recent Orders + Menu */}
        <div className="flex flex-col gap-5 min-w-0 overflow-x-hidden">
          {/* Recent Orders Section - Compact */}
          <div className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl p-2 overflow-hidden min-w-0">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Recent Orders
              </h3>
              <div className="flex items-center gap-1.5">
                {/* Order Type Filters - Compact */}
                <div className="flex gap-1">
                  {[
                    { value: "all", label: "All" },
                    { value: "dine-in", label: "Dine" },
                    { value: "takeaway", label: "Take" },
                    { value: "delivery", label: "Del." },
                  ].map((filter) => (
                    <button
                      key={filter.value}
                      onClick={() => setOrderFilter(filter.value)}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${
                        orderFilter === filter.value
                          ? "bg-primary text-white"
                          : "bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400"
                      }`}
                    >
                      {filter.label}
                    </button>
                  ))}
        </div>
                {/* Navigation Arrows - Compact */}
                <button
                  onClick={() =>
                    setCurrentOrderIndex(Math.max(0, currentOrderIndex - 1))
                  }
                  disabled={currentOrderIndex === 0}
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-3 h-3 text-gray-700 dark:text-neutral-300" />
                </button>
                <button
                  onClick={() =>
                    setCurrentOrderIndex(
                      Math.min(
                        Math.max(0, filteredRecentOrders.length - (effectiveSidebarOpen ? 4 : 5)),
                        currentOrderIndex + 1,
                      ),
                    )
                  }
                  disabled={
                    currentOrderIndex >=
                    Math.max(0, filteredRecentOrders.length - (effectiveSidebarOpen ? 4 : 5))
                  }
                  className="p-1 rounded hover:bg-gray-100 dark:hover:bg-neutral-900 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-3 h-3 text-gray-700 dark:text-neutral-300" />
                </button>
              </div>
            </div>

            {/* Search by Order ID - same style as menu search */}
            <div className="relative mb-2">
              <input
                ref={orderSearchInputRef}
                type="text"
                placeholder="Search by order ID..."
                value={recentOrderSearch}
                onChange={(e) => setRecentOrderSearch(e.target.value)}
                onKeyDown={(e) => {
                  const hasSearch = recentOrderSearch.trim() !== "";
                  if (!hasSearch || filteredRecentOrders.length === 0) return;
                  if (e.key === "ArrowLeft") {
                    e.preventDefault();
                    const newFocus = Math.max(0, focusedOrderIndex - 1);
                    setFocusedOrderIndex(newFocus);
                    setCurrentOrderIndex((c) => (newFocus < c ? newFocus : c));
                  } else if (e.key === "ArrowRight") {
                    e.preventDefault();
                    const newFocus = Math.min(
                      filteredRecentOrders.length - 1,
                      focusedOrderIndex + 1,
                    );
                    setFocusedOrderIndex(newFocus);
                    setCurrentOrderIndex((c) =>
                      newFocus > c + (effectiveSidebarOpen ? 3 : 4)
                        ? newFocus - (effectiveSidebarOpen ? 3 : 4)
                        : c,
                    );
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    const order = filteredRecentOrders[focusedOrderIndex];
                    if (order?.id) {
                      router.push({ pathname: "/dashboard/pos", query: { edit: order.id } });
                    }
                  }
                }}
                className="w-full px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                🔍
              </div>
            </div>

            {/* Recent Order Cards - Continuous sliding strip (right to left); single list, no duplicate orders */}
            <div
              className="overflow-hidden w-full min-w-0 p-1.5"
              onMouseEnter={() => setOrderGridHovered(true)}
              onMouseLeave={() => setOrderGridHovered(false)}
            >
              <div
                ref={orderStripRef}
                className="flex gap-2 shrink-0"
                style={{
                  width:
                    filteredRecentOrders.length > 0
                      ? `${(filteredRecentOrders.length / (effectiveSidebarOpen ? 4 : 5)) * 100}%`
                      : "100%",
                }}
              >
                {filteredRecentOrders.map((order, idx) => {
                  const globalIdx = idx;
                  const isFocused =
                    recentOrderSearch.trim() !== "" && globalIdx === focusedOrderIndex;
                  const orderCols = effectiveSidebarOpen ? 4 : 5;
                  const totalCards = filteredRecentOrders.length;
                  return (
                  <div
                    key={order.id}
                    role="button"
                    tabIndex={-1}
                    style={{
                      flex: `0 0 ${totalCards ? 100 / totalCards : 100}%`,
                      minWidth: 0,
                    }}
                    onClick={() => {
                      setFocusedOrderIndex(globalIdx);
                      setCurrentOrderIndex(
                        Math.max(0, Math.min(globalIdx, filteredRecentOrders.length - orderCols)),
                      );
                    }}
                    className={`relative p-2 rounded border transition-all cursor-pointer ${
                      isFocused
                        ? "ring-2 ring-primary ring-offset-2 shadow-lg border-gray-200 dark:border-neutral-800"
                        : "border-gray-200 dark:border-neutral-800 hover:border-primary/30"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5 ">
                          <span className="text-[8px] font-bold text-gray-500 dark:text-neutral-500">
                            {order.id}
                          </span>
                          
                        </div>
                        <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                          {order.customer}
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-neutral-500">
                          {order.time}
                        </p>
                      </div>
                      <div>

                      <div
                        className={`px-1 py-0 rounded ${
                          order.timeAgo.includes("2") ||
                          order.timeAgo.includes("1")
                            ? "bg-red-100 dark:bg-red-500/10"
                            : order.timeAgo.includes("3")
                              ? "bg-yellow-100 dark:bg-yellow-500/10"
                              : "bg-emerald-100 dark:bg-emerald-500/10"
                        }`}
                      >
                        <span
                          className={`text-[8px] font-bold ${
                            order.timeAgo.includes("2") ||
                            order.timeAgo.includes("1")
                              ? "text-red-600 dark:text-red-400"
                              : order.timeAgo.includes("3")
                                ? "text-yellow-600 dark:text-yellow-400"
                                : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {order.timeAgo}
                        </span>
                      </div>
                      <span
                            className={`px-1 py-0.5 rounded text-[8px] font-bold ${
                              order.type === "delivery"
                                ? "bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                                : order.type === "takeaway"
                                  ? "bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                  : "bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400"
                            }`}
                          >
                            ✓{" "}
                            {order.type === "delivery"
                              ? "Del"
                              : order.type === "takeaway"
                                ? "Take"
                                : "Dine"}
                          </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="relative h-1 bg-gray-100 dark:bg-neutral-900 rounded-full overflow-hidden">
                      <div
                        className="absolute left-0 top-0 h-full bg-primary rounded-full transition-all duration-500"
                        style={{ width: `${order.progress}%` }}
                      />
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          </div>

        {/* Menu Items Section */}
          <div className="flex flex-col bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden flex-1">
            {/* Header with Filters - Compact */}
            <div className="p-2 border-b border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-bold text-gray-900 dark:text-white">
                  Menu
                </h2>

                {/* Dietary Filters - Compact */}
                <div className="flex items-center gap-2">
                  {[
                    { value: "veg", label: "Veg", icon: "☑️" },
                    { value: "non-veg", label: "Non Veg", icon: "☑️" },
                    { value: "egg", label: "Egg", icon: "☑️" },
                  ].map((filter) => (
                    <label
                      key={filter.value}
                      className="flex items-center gap-1 cursor-pointer"
                    >
            <input
                        type="checkbox"
                        checked={dietaryFilter === filter.value}
                        onChange={() =>
                          setDietaryFilter(
                            dietaryFilter === filter.value
                              ? "all"
                              : filter.value,
                          )
                        }
                        className="w-3 h-3 rounded border-gray-300 text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                        {filter.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Category Cards - Compact */}
              <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2 mb-2">
              <button
                onClick={() => setSelectedCategory("all")}
                  className={`relative p-2 rounded-lg border transition-all ${
                  selectedCategory === "all"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-gray-200 dark:border-neutral-700 hover:border-primary/50 bg-white dark:bg-neutral-900"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-lg flex-shrink-0">
                      🍽️
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <div className="font-bold text-gray-900 dark:text-white text-xs truncate">
                        All
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-neutral-400">
                        {menu.items.length}
                      </div>
                    </div>
                  </div>
              </button>

                {menu.categories.slice(0, 4).map((cat) => {
                  const catItemCount = menu.items.filter(
                    (item) => item.categoryId === cat.id,
                  ).length;
                  return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                      className={`relative p-2 rounded-lg border transition-all ${
                    selectedCategory === cat.id
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-gray-200 dark:border-neutral-700 hover:border-primary/50 bg-white dark:bg-neutral-900"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center text-lg flex-shrink-0">
                          {cat.name.includes("Pizza")
                            ? "🍕"
                            : cat.name.includes("Burger")
                              ? "🍔"
                              : cat.name.includes("Drink") ||
                                  cat.name.includes("Beverage")
                                ? "🥤"
                                : cat.name.includes("Salad")
                                  ? "🥗"
                                  : cat.name.includes("Dessert")
                                    ? "🍰"
                                    : "🍴"}
                        </div>
                        <div className="text-left flex-1 min-w-0">
                          <div className="font-bold text-gray-900 dark:text-white text-xs truncate">
                  {cat.name}
                          </div>
                          <div className="text-[10px] text-gray-500 dark:text-neutral-400">
                            {catItemCount}
                          </div>
                        </div>
                      </div>
                </button>
                  );
                })}
              </div>

              {/* Search Bar - Two-step: quantity then item name, Enter adds first match to cart */}
              <div className="relative">
                <input
                  ref={menuSearchInputRef}
                  type={searchStep === "quantity" ? "number" : "text"}
                  inputMode={searchStep === "quantity" ? "numeric" : "text"}
                  placeholder={
                    searchStep === "quantity"
                      ? "Enter quantity (then press Enter)"
                      : pendingAddQuantity < 0
                        ? `Enter menu item name (then Enter) — removing ${Math.abs(pendingAddQuantity)}`
                        : `Enter menu item name (then Enter) — adding ${pendingAddQuantity}`
                  }
                  value={searchStep === "quantity" ? searchQuantityInput : menuSearchQuery}
                  onChange={(e) =>
                    searchStep === "quantity"
                      ? (() => {
                          const raw = e.target.value.replace(/[^\d-]/g, "");
                          const hasLeadingMinus = raw.startsWith("-");
                          const digits = raw.replace(/-/g, "").slice(0, 4);
                          setSearchQuantityInput(hasLeadingMinus ? "-" + digits : digits);
                        })()
                      : (setMenuSearchQuery(e.target.value), setFocusedItemIndex(0))
                  }
                  onKeyDown={(e) => {
                    if (searchStep === "itemName" && filteredItems.length > 0) {
                      if (e.key === "ArrowRight") {
                        e.preventDefault();
                        setFocusedItemIndex((i) => Math.min(filteredItems.length - 1, i + 1));
                        return;
                      }
                      if (e.key === "ArrowLeft") {
                        e.preventDefault();
                        setFocusedItemIndex((i) => Math.max(0, i - 1));
                        return;
                      }
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        setFocusedItemIndex((i) => Math.min(filteredItems.length - 1, i + gridCols));
                        return;
                      }
                      if (e.key === "ArrowUp") {
                        e.preventDefault();
                        setFocusedItemIndex((i) => Math.max(0, i - gridCols));
                        return;
                      }
                    }
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (searchStep === "quantity") {
                      const raw = searchQuantityInput.trim();
                      const num = parseInt(raw, 10);
                      if (raw === "-" || Number.isNaN(num) || num === 0) return;
                      setPendingAddQuantity(num);
                      setSearchStep("itemName");
                      setSearchQuantityInput("");
                      setMenuSearchQuery("");
                      setFocusedItemIndex(0);
                    } else {
                      // Add the focused item (orange border), not the first search result
                      if (filteredItems.length === 0) {
                        toast.error("No items to add");
                        return;
                      }
                      const idx = Math.min(Math.max(0, focusedItemIndex), filteredItems.length - 1);
                      const selectedItem = filteredItems[idx];
                      if (selectedItem) {
                        if (pendingAddQuantity < 0) {
                          const inCart = cart.find((c) => c.id === selectedItem.id);
                          if (inCart) {
                            updateQuantity(selectedItem.id, pendingAddQuantity);
                          }
                        } else {
                          if (selectedItem.inventorySufficient === false) {
                            toast.error(`${selectedItem.name} is out of stock`);
                            return;
                          }
                          addToCart(selectedItem, pendingAddQuantity);
                          toast.success(`${pendingAddQuantity} × ${selectedItem.name} added to cart`);
                        }
                      } else {
                        toast.error("No matching item found");
                      }
                      setSearchStep("quantity");
                      setSearchQuantityInput("");
                      setMenuSearchQuery("");
                      setPendingAddQuantity(1);
                      setFocusedItemIndex(0);
                    }
                  }}
                  className="w-full px-3 py-1.5 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                  {searchStep === "quantity" ? "#" : "🔍"}
                </div>
            </div>
          </div>

            {/* Menu Grid - Compact */}
            <div className="flex-1 overflow-y-auto p-2 bg-gray-50 dark:bg-neutral-900/50">
              {pageLoading ? (
                <div className="flex flex-col items-center justify-center min-h-[280px] py-12">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-3">
                    <ShoppingCart className="w-8 h-8 text-primary animate-pulse" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    <p className="text-sm font-semibold text-gray-700 dark:text-neutral-300">
                      Loading POS...
                    </p>
                  </div>
                </div>
              ) : (
              <>
              <div
                className={`grid gap-2 ${effectiveSidebarOpen ? "grid-cols-3 xl:grid-cols-4" : "grid-cols-4 xl:grid-cols-5"}`}
              >
                {filteredItems.map((item, idx) => {
                  const inCart = cart.find((c) => c.id === item.id);
                  const outOfStock = item.inventorySufficient === false;
                  const category = menu.categories.find(
                    (c) => c.id === item.categoryId,
                  );
                  const isTrending = item.isTrending === true;
                  const isMustTry = item.isMustTry === true;

                return (
                  <div
                    key={item.id}
                    ref={idx === focusedItemIndex ? focusedCardRef : null}
                    onClick={() => setFocusedItemIndex(idx)}
                      className={`group relative flex flex-col rounded-lg overflow-hidden transition-all ${
                        outOfStock
                          ? "border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 opacity-60"
                          : "border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 hover:shadow-md cursor-pointer"
                      } ${searchStep === "itemName" && idx === focusedItemIndex ? "ring-2 ring-primary ring-offset-2 shadow-lg" : ""}`}
                    >
                      {/* Image - Compact */}
                      <div
                        className="relative h-32 bg-gradient-to-br from-gray-100 to-gray-50 dark:from-neutral-900 dark:to-neutral-800"
                        onClick={() =>
                          !outOfStock && !inCart && addToCart(item)
                        }
                      >
                        {/* Badges */}
                        {!outOfStock && (
                          <div className="absolute top-1 left-1 flex flex-col gap-0.5 z-10">
                            {isTrending && (
                              <span className="px-1.5 py-0.5 rounded bg-red-500 text-white text-[9px] font-bold flex items-center gap-0.5">
                                <Flame className="w-2.5 h-2.5" />
                                Trending
                              </span>
                            )}
                            {isMustTry && (
                              <span className="px-1.5 py-0.5 rounded bg-blue-500 text-white text-[9px] font-bold flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5" />
                                Must Try
                              </span>
                            )}
                          </div>
                        )}

                        {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                            className={`w-full h-full object-cover ${outOfStock ? "grayscale" : ""}`}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-3xl">
                            🍽️
                          </div>
                        )}

                        {outOfStock && (
                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                            <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                              Out of Stock
                            </span>
                          </div>
                        )}

                        {inCart && !outOfStock && (
                          <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold">
                            {inCart.quantity}
                          </div>
                        )}
                      </div>

                      {/* Content - Compact */}
                      <div className="p-2 flex flex-col">
                        {/* Category and Dietary Info */}
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] text-gray-500 dark:text-neutral-500 truncate">
                            {category?.name || "Uncategorized"}
                          </span>
                          <span className="text-[10px]">
                            {item.name.toLowerCase().includes("veg")
                              ? "🥗"
                              : "🍗"}
                          </span>
                        </div>

                        {/* Item Name */}
                        <h3
                          className={`text-xs font-bold mb-1 line-clamp-1 ${outOfStock ? "text-gray-400 dark:text-neutral-500" : "text-gray-900 dark:text-white"}`}
                        >
                          {item.name}
                        </h3>

                        {/* Price and Add to Cart */}
                        <div className="flex items-center justify-between">
                          <div>
                            <span
                              className={`text-sm font-bold ${outOfStock ? "text-gray-400" : "text-primary"}`}
                            >
                              Rs {item.finalPrice ?? item.price}
                            </span>
                          </div>

                          {!outOfStock &&
                            (inCart ? (
                              <div
                                className="flex items-center gap-0.5 bg-gray-100 dark:bg-neutral-800 rounded p-0.5"
                                onClick={(e) => e.stopPropagation()}
                              >
                            <button
                              onClick={() => updateQuantity(item.id, -1)}
                                  className="w-5 h-5 flex items-center justify-center rounded hover:bg-white dark:hover:bg-neutral-700 transition-colors"
                            >
                              <Minus className="w-3 h-3 text-gray-700 dark:text-neutral-300" />
                            </button>
                                <span className="w-6 text-center text-xs font-bold text-gray-900 dark:text-white">
                                  {inCart.quantity}
                                </span>
                            <button
                              onClick={() => updateQuantity(item.id, 1)}
                                  className="w-5 h-5 flex items-center justify-center rounded bg-primary text-white hover:bg-primary/90 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => addToCart(item)}
                                className="w-5 h-5 flex items-center justify-center rounded bg-primary text-white hover:bg-primary/90 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                            ))}
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
                  <p className="text-sm font-medium text-gray-600 dark:text-neutral-400">
                    No items found
                  </p>
                  <p className="text-xs text-gray-400 dark:text-neutral-500 mt-1">
                    Try a different search or category
                  </p>
              </div>
            )}
              </>
              )}
            </div>
          </div>
        </div>

        {/* Cart Section - Compact Style */}
        <div className="flex flex-col bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden">
          {editingOrderId && (
            <div className="px-3 py-2 bg-amber-500/15 dark:bg-amber-500/20 border-b border-amber-500/30 flex items-center justify-between">
              <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Editing order #{editingOrder?.id || editingOrderId}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEditingOrderId(null);
                  setEditingOrder(null);
                  setCart([]);
                  router.replace("/dashboard/pos");
                }}
                className="text-xs font-medium text-amber-700 dark:text-amber-300 hover:underline"
              >
                Cancel edit
              </button>
            </div>
          )}
          {loadingEditOrder && (
            <div className="px-3 py-4 flex items-center justify-center gap-2 text-sm text-gray-600 dark:text-neutral-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading order...
            </div>
          )}
          {/* Order Header */}
          <div className="px-3 py-2.5 border-b border-gray-200 dark:border-neutral-800">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                {editingOrderId ? `Order #${editingOrder?.id || editingOrderId}` : "Order #56998"}
              </h3>
              <span className="text-xs text-gray-500 dark:text-neutral-400">
                {new Date().toLocaleDateString("en-US", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
          </div>

            {/* Order Type Buttons + Settings (beside Delivery) */}
            <div className="flex gap-2 mb-2">
              {[
                { type: "DINE_IN", icon: "🍽️", label: "Dine In" },
                { type: "TAKEAWAY", icon: "📦", label: "Take" },
                { type: "DELIVERY", icon: "🚚", label: "Delivery" },
              ].map((option) => (
                <button
                  key={option.type}
                  onClick={() => {
                    setOrderType(option.type);
                    if (option.type !== "DINE_IN") setTableName("");
                  }}
                  className={`flex-1 px-2 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    orderType === option.type
                      ? "bg-primary text-white"
                      : "bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400"
                  }`}
                >
                  <span className="text-sm">{option.icon}</span>
                  {option.label}
                </button>
              ))}
              {currentBranch?.id && (
                <button
                  type="button"
                  onClick={() => {
                    setPosTableSettingsDraft(showTablePos);
                    setPosWaiterSettingsDraft(showWaiterPos);
                    setPosCustomerSettingsDraft(showCustomerPos);
                    setShowPosTableSettingsModal(true);
                  }}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-neutral-900 text-gray-500 dark:text-neutral-400 hover:text-gray-700 hover:bg-gray-200 dark:hover:text-neutral-300 dark:hover:bg-neutral-800 transition-colors flex-shrink-0"
                  title="POS options (table, waiter, customer)"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Table selection (optional, only for DINE_IN; hidden until options loaded to avoid flash) */}
            {orderType === "DINE_IN" && posOptionsLoaded && showTablePos && (
              <div className="mb-2">
                <label className="block text-xs font-semibold text-gray-600 dark:text-neutral-400 mb-1">Table (optional)</label>
                <select
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-gray-900 dark:text-white"
                >
                  <option value="">No table</option>
                  {tables.filter((t) => t.isAvailable).map((t) => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                  {tables.filter((t) => !t.isAvailable).map((t) => (
                    <option key={t.id} value={t.name}>{t.name} (occupied)</option>
                  ))}
                </select>
              </div>
            )}

            {/* Waiter & Customer Selection (hidden until options loaded to avoid flash) */}
            {posOptionsLoaded && (showWaiterPos || showCustomerPos) && (
              <div className={`grid gap-2 ${showWaiterPos && showCustomerPos ? "grid-cols-2" : "grid-cols-1"} mb-2`}>
                {showWaiterPos && (
                  <select className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-gray-900 dark:text-white">
                    <option>Waiter</option>
                  </select>
                )}
                {showCustomerPos && (
                  <button
                    type="button"
                    onClick={openCustomerModal}
                    className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-xs text-gray-900 dark:text-white flex items-center justify-between hover:border-gray-300 dark:hover:border-neutral-600"
                  >
                    <span>{customerName ? `${customerName}${customerPhone ? ` • ${customerPhone}` : ""}` : "Select Customer"}</span>
                    <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Ordered Items Header */}
          <div className="px-3 py-2.5 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/50">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                Ordered Menus
              </h3>
              <span className="text-xs text-gray-500 dark:text-neutral-400">
                Total:{" "}
                <span className="font-bold text-gray-900 dark:text-white">
                  {cart.length}
                </span>
              </span>
            </div>
          </div>

          {/* Cart Items */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-2">
                  <ShoppingCart className="w-8 h-8 text-gray-300 dark:text-neutral-700" />
                </div>
                <p className="text-xs font-semibold text-gray-700 dark:text-neutral-300">
                  Cart is empty
                </p>
              </div>
            ) : (
              cart.map((item) => {
                const isExpanded = expandedCartItems.includes(item.id);
                return (
                <div
                  key={item.id}
                    onClick={() => {
                      setExpandedCartItems((prev) =>
                        prev.includes(item.id)
                          ? prev.filter((id) => id !== item.id)
                          : [...prev, item.id],
                      );
                    }}
                    className="p-2 rounded-lg border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 cursor-pointer hover:border-gray-300 dark:hover:border-neutral-700 hover:shadow-md transition-all"
                  >
                    {/* Item Row */}
                    <div className="flex items-start gap-3">
                      {/* Item Image */}
                      <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-neutral-900 flex-shrink-0 overflow-hidden">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            🍽️
                          </div>
                        )}
                      </div>

                      {/* Item Details */}
                      <div className="flex-1 min-w-0">
                        {/* Title Row with Remove Button */}
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-base font-bold text-gray-900 dark:text-white line-clamp-1">
                              {item.name}{" "}
                              <span className="text-xs font-normal text-gray-500 dark:text-neutral-500">
                                ({item.size || "Regular"})
                              </span>
                            </h4>
                          </div>
                    <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeFromCart(item.id);
                            }}
                            className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
                          >
                            <span className="text-lg">✕</span>
                    </button>
                  </div>

                        {/* Quantity and Add Note Row */}
                        <div className="flex items-center justify-between gap-2">
                          <div
                            className="flex items-center gap-1 bg-gray-100 dark:bg-neutral-900 rounded-md p-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                      <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(item.id, -1);
                              }}
                              className="w-4 h-4 flex items-center justify-center hover:bg-neutral-700 text-white dark:hover:bg-neutral-800 rounded transition-colors"
                            >
                              <Minus className="w-3 h-3 text-gray-700 dark:text-neutral-400" />
                      </button>
                            <span className="w-8 scale-105 text-center text-xs font-semibold text-gray-900 dark:text-white">
                              {item.quantity}
                            </span>
                      <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateQuantity(item.id, 1);
                              }}
                              className="w-4 h-4 flex items-center justify-center bg-primary hover:bg-neutral-700 text-white dark:hover:bg-neutral-800 rounded transition-colors"
                            >
                              <Plus className="w-3 h-3 dark:text-neutral-400" />
                      </button>
                    </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              addNoteToItem(item.id);
                            }}
                            className="text-sm text-primary hover:underline font-medium"
                          >
                            Add Note
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Note Display */}
                    {itemNotes[item.id] && (
                      <div className="mt-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20">
                        <p className="text-xs text-blue-700 dark:text-blue-400">
                          📝 {itemNotes[item.id]}
                    </p>
                  </div>
                    )}

                    {/* Price Grid - Only shown when expanded */}
                    {isExpanded && (
                      <div className="pt-3 mt-3 border-t border-gray-200 dark:border-neutral-800">
                        <div className="grid grid-cols-3 gap-3 text-sm">
                          <div>
                            <div className="text-gray-500 dark:text-neutral-500 mb-1.5">
                              Item Rate
                </div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              Rs {item.price}
                            </div>
                          </div>
                          <div>
                            <div className="text-gray-500 dark:text-neutral-500 mb-1.5">
                              Amount
                            </div>
                            <div className="font-semibold text-gray-900 dark:text-white">
                              Rs {(item.price * item.quantity).toFixed(0)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-gray-500 dark:text-neutral-500 mb-1.5">
                              Total
                            </div>
                            <div className="font-bold text-primary text-base">
                              Rs {(item.price * item.quantity).toFixed(0)}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Cart Summary */}
          {cart.length > 0 && (
            <div className="p-3 border-t border-gray-200 dark:border-neutral-800 space-y-3 bg-white dark:bg-neutral-950">
              {/* Available Deals Section */}
              {applicableDeals.length > 0 && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-500/30 overflow-hidden bg-white dark:bg-neutral-950">
                  <button
                    type="button"
                    onClick={() => setShowDealsSection(!showDealsSection)}
                    className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-bold text-gray-700 dark:text-neutral-300 hover:bg-emerald-50 dark:hover:bg-emerald-500/5 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 flex items-center justify-center">
                        <Tag className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                      <span className="flex items-center gap-2">
                        Deals
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                          {applicableDeals.length}
                        </span>
                      </span>
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 transition-transform duration-300 ${showDealsSection ? "rotate-180" : ""}`}
                    />
                  </button>
                  <div
                    className="transition-all duration-300 ease-in-out overflow-hidden"
                    style={{
                      maxHeight: showDealsSection
                        ? `${applicableDeals.length * 75 + 30}px`
                        : "0px",
                      opacity: showDealsSection ? 1 : 0,
                    }}
                  >
                    <div className="p-3 space-y-2 border-t border-emerald-100 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-500/5 dark:to-neutral-950">
                      {applicableDeals.map((deal) => {
                        const isSelected = selectedDeals.includes(deal.id);
                        return (
                          <button
                            key={deal.id}
                            onClick={() => toggleDealSelection(deal.id)}
                            className={`w-full text-left p-2.5 rounded-lg transition-all ${
                              isSelected
                                ? "bg-emerald-100 dark:bg-emerald-500/10 border-2 border-emerald-500 dark:border-emerald-500/50"
                                : "bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h4 className="text-xs font-bold text-gray-900 dark:text-white">
                                    {deal.name}
                                  </h4>
                                  {deal.badgeText && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary/10 text-secondary text-[10px] font-bold">
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
                                  {deal.dealType === "PERCENTAGE_DISCOUNT" &&
                                    `${deal.discountPercentage}% OFF`}
                                  {deal.dealType === "FIXED_DISCOUNT" &&
                                    `Rs ${deal.discountAmount} OFF`}
                                  {deal.dealType === "MINIMUM_PURCHASE" &&
                                    `Spend Rs ${deal.minimumPurchase}`}
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

              {/* Payment Summary */}
              <div className="space-y-2">
                <h4 className="text-sm font-bold text-gray-900 dark:text-white mb-2">
                  Payment Summary
                </h4>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-neutral-400">
                    Sub Total
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    Rs {subtotal.toFixed(0)}
                  </span>
                </div>
                {dealDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      Deal Discount
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      -Rs {dealDiscount.toFixed(0)}
                    </span>
                  </div>
                )}
                {manualDiscount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600 dark:text-neutral-400">
                      Discount
                    </span>
                    <span className="font-semibold text-gray-600 dark:text-neutral-400">
                      -Rs {manualDiscount.toFixed(0)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 dark:text-neutral-400">
                    Tax (0%)
                  </span>
                  <span className="font-semibold text-gray-900 dark:text-white">
                    Rs 0
                  </span>
                </div>
              </div>

              {/* Amount to be Paid */}
              <div className="pt-3 border-t border-gray-200 dark:border-neutral-800">
                <div className="flex justify-between items-center">
                  <span className="text-base font-bold text-gray-900 dark:text-white">
                    Amount to be Paid
                  </span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    Rs {total.toFixed(0)}
                  </span>
                </div>
              </div>

              {/* Place Order / Update Order Button */}
              {editingOrderId ? (
                <button
                  onClick={handleUpdateOrder}
                  disabled={loading || cart.length === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-white font-semibold text-sm hover:bg-amber-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      Update order
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleCheckout}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      Place an Order
                    </>
                  )}
                </button>
              )}

              {/* Print, Cash, Card buttons */}
              <div className="grid grid-cols-3 gap-2 mt-2">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(true)}
                  className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors"
                >
                  <Printer className="w-5 h-5 text-gray-600 dark:text-neutral-400" />
                  <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                    Print
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openTakePaymentModal("CASH")}
                  disabled={cart.length === 0}
                  className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Banknote className="w-5 h-5 text-gray-600 dark:text-neutral-400" />
                  <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                    Cash
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => openTakePaymentModal("CARD")}
                  disabled={cart.length === 0}
                  className="flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CreditCard className="w-5 h-5 text-gray-600 dark:text-neutral-400" />
                  <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                    Card
                  </span>
                </button>
              </div>

              {/* Save as Draft Button (only when not editing) */}
              {/* {!editingOrderId && (
                <button
                onClick={saveDraft}
                disabled={loading || cart.length === 0}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border-2 border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-4 h-4" />
                Save as Draft
              </button>
              )} */}

              {/* Action Buttons Grid */}
              {/* <div className="grid grid-cols-3 gap-2">
                <button 
                  onClick={() => setShowPrintModal(true)}
                  className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="text-lg">🖨️</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                    Print
                      </span>
                    </button>
                <button 
                  onClick={() => setShowInvoiceModal(true)}
                  className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="text-lg">📄</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                    Invoice
                  </span>
                </button>
                <button 
                  onClick={() => {
                    setTransactionTab("draft");
                    setShowTransactionsModal(true);
                  }}
                  className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="text-lg">📝</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                    Draft
                  </span>
                </button>
                <button
                  onClick={clearCart}
                  className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="text-lg">❌</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                    Cancel
                  </span>
                </button>
                <button className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors flex items-center justify-center gap-1.5">
                  <span className="text-lg">💵</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                    Void
                  </span>
                </button>
                <button 
                  onClick={() => {
                    setTransactionTab("sale");
                    setShowTransactionsModal(true);
                  }}
                  className="px-2 py-1.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors flex items-center justify-center gap-1.5"
                >
                  <span className="text-lg">📊</span>
                  <span className="text-xs font-medium text-gray-700 dark:text-neutral-300">
                    Trans.
                  </span>
                </button>
              </div> */}
            </div>
          )}
        </div>
      </div>

      {/* Transactions Modal with Tabs */}
      {showTransactionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Transactions
              </h2>
              <button
                onClick={() => setShowTransactionsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
              >
                <span className="text-3xl">×</span>
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-4 border-b border-gray-200 dark:border-neutral-800">
              <div className="flex gap-2">
                <button
                  onClick={() => setTransactionTab("sale")}
                  className={`px-6 py-2.5 rounded-t-lg font-semibold text-sm transition-all ${
                    transactionTab === "sale"
                      ? "bg-primary text-white"
                      : "bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-800"
                  }`}
                >
                  <Receipt className="w-4 h-4 inline mr-2" />
                  Sale
                </button>
                <button
                  onClick={() => setTransactionTab("draft")}
                  className={`px-6 py-2.5 rounded-t-lg font-semibold text-sm transition-all ${
                    transactionTab === "draft"
                      ? "bg-primary text-white"
                      : "bg-gray-100 dark:bg-neutral-900 text-gray-600 dark:text-neutral-400 hover:bg-gray-200 dark:hover:bg-neutral-800"
                  }`}
                >
                  <FileText className="w-4 h-4 inline mr-2" />
                  Draft
                </button>
              </div>
            </div>

            {/* Search and Sort Bar */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/50">
              <div className="flex items-center gap-4">
                <div className="flex-1 relative">
                        <input
                          type="text"
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 pl-10 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  />
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                    🔍
                      </div>
                    </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 dark:text-neutral-400">
                    Sort by :
                  </span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                  >
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                  </select>
                  </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto max-h-[calc(90vh-260px)]">
              {/* Sale Tab Content */}
              {transactionTab === "sale" && (
                <>
                  {loadingTransactions ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                  ) : filteredTransactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                        <Receipt className="w-10 h-10 text-gray-300 dark:text-neutral-700" />
                      </div>
                      <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
                        {searchQuery ? "No transactions found" : "No transactions yet"}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">
                        {searchQuery
                          ? "Try a different search"
                          : "Complete your first sale to see it here"}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800">
                          <tr>
                            <th className="px-6 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">
                              Date
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">
                              Ref
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">
                              Customer
                            </th>
                            <th className="px-6 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                              Grand Total
                            </th>
                            <th className="px-6 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                          {filteredTransactions.map((transaction) => (
                            <tr
                              key={transaction.id || transaction._id}
                              className="hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors"
                            >
                              <td className="px-6 py-4 text-sm text-gray-600 dark:text-neutral-400">
                                {new Date(transaction.createdAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                #{transaction.ref || transaction.orderNumber || transaction.id?.slice(-6) || transaction._id?.slice(-6)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                {transaction.customerName || "Walk-in Customer"}
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-right text-gray-900 dark:text-white">
                                ${(transaction.total || transaction.subtotal || 0).toFixed(2)}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => setShowPrintModal(true)}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                                    title="Print"
                                  >
                                    <Receipt className="w-4 h-4 text-gray-600 dark:text-neutral-400" />
                                  </button>
                                  <button
                                    onClick={() => removeTransaction(transaction.id || transaction._id)}
                                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                    title="Delete Transaction"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}

              {/* Draft Tab Content */}
              {transactionTab === "draft" && (
                <>
                  {loadingDrafts ? (
                    <div className="flex items-center justify-center py-20">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                  ) : filteredDrafts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                      <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-neutral-900 flex items-center justify-center mb-4">
                        <FileText className="w-10 h-10 text-gray-300 dark:text-neutral-700" />
                      </div>
                      <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
                        {searchQuery ? "No drafts found" : "No drafts yet"}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-neutral-500 mt-1">
                        {searchQuery
                          ? "Try a different search"
                          : "Save your current order as draft to see it here"}
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800">
                          <tr>
                            <th className="px-6 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">
                              Date
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">
                              Ref
                            </th>
                            <th className="px-6 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">
                              Customer
                            </th>
                            <th className="px-6 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                              Grand Total
                            </th>
                            <th className="px-6 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">
                              Action
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                          {filteredDrafts.map((draft) => (
                            <tr
                              key={draft.id || draft._id}
                              className="hover:bg-gray-50 dark:hover:bg-neutral-900/50 transition-colors"
                            >
                              <td className="px-6 py-4 text-sm text-gray-600 dark:text-neutral-400">
                                {new Date(draft.createdAt).toLocaleDateString(
                                  "en-US",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  },
                                )}
                              </td>
                              <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white">
                                #{draft.ref || draft.orderNumber || draft.id?.slice(-6) || draft._id?.slice(-6)}
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                {draft.customerName || "Walk-in Customer"}
                              </td>
                              <td className="px-6 py-4 text-sm font-semibold text-right text-gray-900 dark:text-white">
                                ${(draft.total || draft.subtotal || 0).toFixed(2)}
                              </td>
                              <td className="px-6 py-4">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => {
                                      loadDraft(draft);
                                      setShowTransactionsModal(false);
                                    }}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                                    title="Load Draft"
                                  >
                                    <FileText className="w-4 h-4 text-gray-600 dark:text-neutral-400" />
                                  </button>
                                  <button
                                    onClick={() => setShowPrintModal(true)}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors"
                                    title="Print"
                                  >
                                    <Receipt className="w-4 h-4 text-gray-600 dark:text-neutral-400" />
                                  </button>
                                  <button
                                    onClick={() => removeDraft(draft.id || draft._id)}
                                    className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                    title="Delete Draft"
                                  >
                                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Invoice
              </h2>
              <button
                onClick={() => setShowInvoiceModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
              >
                <span className="text-3xl">×</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-8 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Invoice Header */}
              <div className="flex items-start justify-between mb-8">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    #INV5465
                  </h3>
                  <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
                    DreamsPOS
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {/* PAID Stamp */}
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-green-500 flex items-center justify-center bg-green-50 dark:bg-green-500/10">
                      <span className="text-green-600 dark:text-green-400 font-bold text-lg">
                        PAID
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Invoice From & Bill To */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                {/* Invoice From */}
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white mb-3">
                    Invoice From
                  </h4>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-neutral-400">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      DreamsPOS
                    </p>
                    <p>15 Hodges Mews, High Wycombe</p>
                    <p>HP12 3JL, United Kingdom</p>
                    <p>Phone: +1 45659 96566</p>
                  </div>
                </div>

                {/* Bill To */}
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white mb-3">
                    Bill To
                  </h4>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-neutral-400">
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {customerName || "Andrew Fletcher"}
                    </p>
                    <p>1147 Rohan Drive Suite, Burlington,</p>
                    <p>VT / 8202115 United Kingdom</p>
                    <p>Phone: {customerPhone || "+1 45659 96566"}</p>
                  </div>
                </div>
              </div>

              {/* Items Details Table */}
              <div className="mb-8">
                <h4 className="text-base font-bold text-gray-900 dark:text-white mb-4">
                  Items Details
                </h4>
                <div className="border border-gray-200 dark:border-neutral-800 rounded-lg overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-neutral-900">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">
                          #
                        </th>
                        <th className="px-4 py-3 text-left text-sm font-bold text-gray-900 dark:text-white">
                          Item Details
                        </th>
                        <th className="px-4 py-3 text-center text-sm font-bold text-gray-900 dark:text-white">
                          Quantity
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                          Rate
                        </th>
                        <th className="px-4 py-3 text-right text-sm font-bold text-gray-900 dark:text-white">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-neutral-800">
                      {cart.map((item, index) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 text-sm text-gray-600 dark:text-neutral-400">
                            {index + 1}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                            {item.name}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-white">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white">
                            ${item.price.toFixed(2)}
                          </td>
                          <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-white font-semibold">
                            ${(item.price * item.quantity).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Terms and Summary */}
              <div className="grid grid-cols-2 gap-8">
                {/* Terms and Conditions */}
                <div>
                  <h4 className="text-base font-bold text-gray-900 dark:text-white mb-3">
                    Terms and Conditions
                  </h4>
                  <div className="space-y-2 text-sm text-gray-600 dark:text-neutral-400">
                    <p>1. Goods once sold cannot be taken back or exchanged.</p>
                    <p>
                      2. We are not the manufacturers the company provides
                      warranty
                    </p>
                  </div>
                  <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-lg">
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      <span className="font-semibold">Note:</span> Please ensure
                      payment is made within 7 days of invoice date.
                    </p>
                  </div>
                </div>

                {/* Summary */}
                <div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        Amount
                      </span>
                      <span className="text-sm font-bold text-gray-900 dark:text-white">
                        ${subtotal.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-neutral-400">
                        Tax (0%)
                      </span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        $0
                      </span>
                    </div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600 dark:text-neutral-400">
                          Discount (
                          {Math.round((totalDiscount / subtotal) * 100)}%)
                        </span>
                        <span className="text-sm font-semibold text-red-600 dark:text-red-400">
                          -${totalDiscount.toFixed(2)}
                      </span>
                    </div>
                  )}
                    <div className="pt-3 border-t border-gray-200 dark:border-neutral-800">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-bold text-gray-900 dark:text-white">
                          Total ($)
                        </span>
                        <span className="text-2xl font-bold text-gray-900 dark:text-white">
                          ${(subtotal - totalDiscount).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800 flex gap-3 bg-gray-50 dark:bg-neutral-900/50">
                    <button
                onClick={() => {
                  // Download PDF logic here
                  alert("Download PDF functionality to be implemented");
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 font-semibold text-sm hover:bg-white dark:hover:bg-neutral-900 transition-colors"
              >
                <FileText className="w-4 h-4" />
                Download PDF
                    </button>
                    <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                <Receipt className="w-4 h-4" />
                Print Invoice
                    </button>
                  </div>
          </div>
        </div>
      )}

      {/* Print Receipt Modal */}
      {showPrintModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-neutral-950 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Print Reciept
              </h2>
                    <button
                onClick={() => setShowPrintModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300 transition-colors"
              >
                <span className="text-2xl">×</span>
                    </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              {/* Order Info Section */}
              <div className="mb-6">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">
                  Order Info
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-neutral-400">
                      Date & Time
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {new Date().toLocaleDateString("en-US", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}{" "}
                      -{" "}
                      {new Date().toLocaleTimeString("en-US", {
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: true,
                      })}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-neutral-400">
                      Order No
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      #54654
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-neutral-400">
                      Token No
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      20
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-neutral-400">
                      No of Items
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {cart.length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 dark:text-neutral-400">
                      Order Type
                    </span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {orderType === "DINE_IN"
                        ? (tableName ? `Dine In (${tableName})` : "Dine In")
                        : orderType === "TAKEAWAY"
                          ? "Take Away"
                          : "Delivery"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Ordered Menus Section */}
              <div className="mb-6">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-4">
                  Ordered Menus
                </h3>
                <div className="space-y-3">
                  {cart.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-start"
                    >
                      <div className="flex-1">
                        <span className="text-sm text-gray-900 dark:text-white">
                          {item.name} ×{item.quantity}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">
                        ${(item.price * item.quantity).toFixed(0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Payment Summary */}
              <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-neutral-800">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-neutral-400">
                    Sub Total
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    ${subtotal.toFixed(0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-neutral-400">
                    Tax (0%)
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    $0
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-neutral-400">
                    Service Charge
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    $15
                  </span>
                </div>
              </div>

              {/* Total */}
              <div className="flex justify-between items-center pt-4 mt-4 border-t border-gray-200 dark:border-neutral-800">
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  Total
                </span>
                <span className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${(subtotal + 15).toFixed(0)}
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-neutral-800 flex gap-3">
                    <button
                onClick={() => setShowPrintModal(false)}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300 font-semibold text-sm hover:bg-gray-50 dark:hover:bg-neutral-900 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 px-4 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                Print
                    </button>
                  </div>
          </div>
        </div>
      )}

      {/* Take payment modal (Cash / Card) */}
      {showTakePaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Take payment</h2>
              <button
                type="button"
                onClick={closeTakePaymentModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            <form onSubmit={handleTakePaymentSubmit} className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-neutral-400">
                Order total · Rs {total.toFixed(0)}
              </p>
              {paymentError && (
                <p className="text-sm text-red-600 dark:text-red-400">{paymentError}</p>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-2">Payment method</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CASH")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${paymentMethod === "CASH" ? "border-primary bg-primary/10 text-primary" : "border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300"}`}
                  >
                    <Banknote className="w-4 h-4" /> Cash
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("CARD")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-medium transition-colors ${paymentMethod === "CARD" ? "border-primary bg-primary/10 text-primary" : "border-gray-200 dark:border-neutral-700 text-gray-700 dark:text-neutral-300"}`}
                  >
                    <CreditCard className="w-4 h-4" /> Card
                  </button>
                </div>
              </div>
              {paymentMethod === "CASH" && (
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">Bill total (Rs)</label>
                    <div className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-sm font-semibold text-gray-900 dark:text-white">
                      Rs {total.toFixed(0)}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">Amount received (Rs) *</label>
                    <input
                      ref={amountReceivedInputRef}
                      type="number"
                      min="0"
                      step="1"
                      required={paymentMethod === "CASH"}
                      value={amountReceived}
                      onChange={(e) => setAmountReceived(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white"
                    />
                  </div>
                  {amountReceived !== "" && !isNaN(Number(amountReceived)) && Number(amountReceived) >= total && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">Return to customer (Rs)</label>
                      <div className="px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                        Rs {(Number(amountReceived) - total).toFixed(0)}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeTakePaymentModal}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-neutral-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentLoading || (paymentMethod === "CASH" && (amountReceived === "" || Number(amountReceived) < total))}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                >
                  {paymentLoading ? "Processing…" : "Record payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POS options modal (table, waiter, customer visibility per branch) */}
      {showPosTableSettingsModal && currentBranch?.id && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">POS options</h2>
              <button
                type="button"
                onClick={() => setShowPosTableSettingsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-gray-600 dark:text-neutral-400">
                Show or hide these fields for this branch in POS.
              </p>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={posTableSettingsDraft}
                  onChange={(e) => setPosTableSettingsDraft(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Show table (optional) section
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={posWaiterSettingsDraft}
                  onChange={(e) => setPosWaiterSettingsDraft(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Show Waiter field
                </span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={posCustomerSettingsDraft}
                  onChange={(e) => setPosCustomerSettingsDraft(e.target.checked)}
                  className="rounded border-gray-300 text-primary focus:ring-primary"
                />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  Show Select Customer field
                </span>
              </label>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-neutral-800 flex gap-2">
              <button
                type="button"
                onClick={() => setShowPosTableSettingsModal(false)}
                className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 text-sm font-medium text-gray-700 dark:text-neutral-300 hover:bg-gray-50 dark:hover:bg-neutral-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={posTableSettingsSaving}
                onClick={() => {
                  setPosTableSettingsSaving(true);
                  updateBranch(currentBranch.id, {
                    showTablePos: posTableSettingsDraft,
                    showWaiterPos: posWaiterSettingsDraft,
                    showCustomerPos: posCustomerSettingsDraft,
                  })
                    .then(() => {
                      setShowTablePos(posTableSettingsDraft);
                      setShowWaiterPos(posWaiterSettingsDraft);
                      setShowCustomerPos(posCustomerSettingsDraft);
                      toast.success("POS options saved");
                      setShowPosTableSettingsModal(false);
                    })
                    .catch((err) => toast.error(err?.message || "Failed to update"))
                    .finally(() => setPosTableSettingsSaving(false));
                }}
                className="flex-1 px-3 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
              >
                {posTableSettingsSaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Select / Add Customer Modal (search by phone, quick add if not found) */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Customer
              </h2>
                  <button
                type="button"
                onClick={closeCustomerModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
              >
                <span className="text-2xl">×</span>
                  </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {customerModalError && (
                <p className="mb-3 text-sm text-red-600 dark:text-red-400">{customerModalError}</p>
              )}

              <>
                <input
                  type="text"
                  placeholder="Search customer by phone..."
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setCustomerModalError("");
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white mb-3"
                />
                {customerModalLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {(() => {
                      const term = customerSearch.trim();
                      const filtered = customersList.filter((c) =>
                        !term ? true : (c.phone || "").includes(term)
                      );
                      if (filtered.length > 0) {
                        return (
                          <ul className="space-y-1">
                            {filtered.map((c) => (
                              <li key={c.id}>
                                <button
                                  type="button"
                                  onClick={() => selectCustomerForOrder(c)}
                                  className="w-full text-left px-3 py-2.5 rounded-lg border border-gray-200 dark:border-neutral-700 hover:bg-gray-50 dark:hover:bg-neutral-800/50 text-sm"
                                >
                                  <span className="font-medium text-gray-900 dark:text-white">
                                    {c.name}
                                  </span>
                                  {c.phone && (
                                    <span className="text-gray-500 dark:text-neutral-400 ml-2">
                                      {c.phone}
                                    </span>
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                        );
                      }

                      if (!term) {
                        return customersList.length === 0 ? (
                          <p className="text-sm text-gray-500 dark:text-neutral-400 py-4">
                            No customers yet. Start by adding a new customer.
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-neutral-400 py-4">
                            Type a phone number to search or add.
                          </p>
                        );
                      }

                      // No match for this phone – quick add
                      return (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-500 dark:text-neutral-400">
                            No customer found for this phone. Add a new customer.
                          </p>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">
                              Phone
                            </label>
                            <div className="px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-sm text-gray-900 dark:text-white">
                              {term}
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-neutral-300 mb-1">
                              Name *
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={quickCustomerName}
                                onChange={(e) => setQuickCustomerName(e.target.value)}
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-gray-900 dark:text-white"
                                placeholder="Customer name"
                              />
                              <button
                                type="button"
                                onClick={handleQuickAddCustomer}
                                disabled={addingQuickCustomer}
                                className="px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-50"
                              >
                                {addingQuickCustomer ? "Adding…" : "Add"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </>
                )}
              </>
            </div>
          </div>
        </div>
      )}

      {/* Floating help button - bottom right */}
      <button
        type="button"
        onClick={() => setShowShortcutsModal(true)}
        className="fixed bottom-3 right-3 z-40 p-0.5 rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 hover:shadow-xl transition-all flex items-center justify-center"
        title="Keyboard shortcuts"
      >
        <HelpCircle className="w-5 h-5" />
      </button>

      {/* Keyboard shortcuts info modal */}
      {showShortcutsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-neutral-950 rounded-xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-neutral-800">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Keyboard shortcuts</h2>
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-neutral-300"
              >
                <span className="text-2xl">×</span>
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-3 text-sm">
              <p className="text-xs text-gray-500 dark:text-neutral-400 mb-3">
                Use Ctrl (Windows/Linux) or Cmd (Mac) + Shift + key.
              </p>
              <div className="space-y-2">
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">Focus menu search</span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">Ctrl+Shift+M</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">Focus order search</span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">Ctrl+Shift+O</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">Save / Place order</span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">Ctrl+S</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">Payment by Cash</span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">Ctrl+Shift+C</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">Payment by Card</span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">Ctrl+Shift+D</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">Print menu bill</span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">Ctrl+Shift+B</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">Print payment bill</span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">Ctrl+Shift+R</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">Order type: Dine In</span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">Ctrl+Shift+E</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">Order type: Take</span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">Ctrl+Shift+A</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">Order type: Delivery</span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">Ctrl+Shift+L</kbd>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-neutral-800">
                  <span className="text-gray-700 dark:text-neutral-300">Close modal or clear cart</span>
                  <kbd className="px-2 py-0.5 rounded bg-gray-100 dark:bg-neutral-800 font-mono text-xs">Esc</kbd>
                </div>
              </div>
            </div>
            <div className="px-4 py-3 border-t border-gray-200 dark:border-neutral-800">
              <button
                type="button"
                onClick={() => setShowShortcutsModal(false)}
                className="w-full px-3 py-2.5 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary/90"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
