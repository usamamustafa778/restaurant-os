import { useCallback, useEffect, useRef, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import PermissionGate from "../../components/PermissionGate";
import {
  getWhatsAppDashboardState,
  postWhatsAppSetupRequest,
  patchWhatsAppSettings,
  getWhatsAppConversations,
  getWhatsAppConversation,
  takeOverWhatsAppConversation,
  releaseWhatsAppConversation,
  replyWhatsAppConversation,
  deleteWhatsAppConversation,
  clearAllWhatsAppConversations,
  getStoredAuth,
} from "../../lib/apiClient";
import { useSocket } from "../../contexts/SocketContext";
import { useWhatsAppNotifications } from "../../contexts/WhatsAppNotificationContext";
import { usePermissions } from "../../contexts/PermissionContext";
import {
  Loader2,
  MessageCircle,
  Settings,
  Phone,
  ShoppingBag,
  Zap,
  CheckCircle2,
  Sparkles,
  X,
  User,
  ArrowRight,
  PauseCircle,
  Mail,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";

function formatSubmitted(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatRelativeTime(d) {
  if (!d) return "";
  try {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return new Date(d).toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

const FEATURES = [
  {
    icon: MessageCircle,
    title: "Answer customers",
    desc: "Menu, hours, location — instantly in Urdu or English.",
  },
  {
    icon: ShoppingBag,
    title: "Take orders",
    desc: "Customers order on WhatsApp. Orders go straight to your kitchen.",
  },
  {
    icon: Phone,
    title: "Hand off to staff",
    desc: "AI transfers to your manager when a human is needed.",
  },
];

const SETUP_STEPS = [
  { label: "Request submitted", done: true },
  { label: "EatsDesk connects your number", done: false },
  { label: "AI goes live", done: false },
];

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:placeholder:text-neutral-600";

const DEFAULT_SETTINGS = {
  greetingMessage: "",
  aiLanguagePreference: "auto",
  responseStyle: "friendly",
  defaultOrderType: "ask",
  deliveryTimeMin: 30,
  deliveryTimeMax: 45,
  takeawayTimeMin: 15,
  takeawayTimeMax: 20,
  customInstructions: "",
  humanHandoffNumber: "",
  aiHoursMode: "always",
  aiCustomHoursText: "",
};

function normalizeSettings(raw) {
  if (!raw) return { ...DEFAULT_SETTINGS };
  const lang =
    raw.aiLanguagePreference === "both"
      ? "auto"
      : raw.aiLanguagePreference || "auto";
  return {
    ...DEFAULT_SETTINGS,
    ...raw,
    aiLanguagePreference: lang,
  };
}

const settingsFieldClass =
  "w-full px-3 py-2.5 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm text-gray-800 dark:text-neutral-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30";

const settingsToggleClass = (active) =>
  active
    ? "bg-orange-500 text-white border-orange-500"
    : "bg-white dark:bg-neutral-800 border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400";

export default function WhatsAppDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState("not_connected");
  const [pendingRequest, setPendingRequest] = useState(null);
  const [live, setLive] = useState(null);

  const [requestOpen, setRequestOpen] = useState(false);
  const [reqNumber, setReqNumber] = useState("");
  const [reqLang, setReqLang] = useState("both");
  const [reqHandoff, setReqHandoff] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);

  const [convLoading, setConvLoading] = useState(false);
  const [activePanel, setActivePanel] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [convDetail, setConvDetail] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [takingOver, setTakingOver] = useState(false);
  const [deleteModal, setDeleteModal] = useState({
    open: false,
    type: null,
    target: null,
  });
  const [deleting, setDeleting] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});
  const messagesEndRef = useRef(null);
  const conversationsRef = useRef([]);
  const openConversationRef = useRef(null);
  const activeConvRef = useRef(null);
  const livePanelInitRef = useRef(false);
  const { socket } = useSocket() || {};
  const { hasPermission } = usePermissions();
  const { setConversationClickHandler, setActiveConversationId, consumePendingOpenConversationId, markAlertRead } =
    useWhatsAppNotifications();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWhatsAppDashboardState();
      setState(data.state || "not_connected");
      setPendingRequest(data.pendingRequest || null);
      setLive(data.live || null);
    } catch (e) {
      const msg = String(e?.message || "");
      const isUnavailable =
        msg.includes("Not Found") ||
        msg.includes("404") ||
        msg.includes("/api/whatsapp/dashboard-state");
      if (!isUnavailable) {
        toast.error(msg || "Failed to load WhatsApp status");
      }
      setState("not_connected");
      setPendingRequest(null);
      setLive(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const auth = getStoredAuth();
    if (auth?.user?.role === "order_taker" && typeof window !== "undefined") {
      window.location.href = "/order-taker";
      return;
    }
    load();
  }, [load]);

  useEffect(() => {
    if (live?.settings) {
      setSettings(normalizeSettings(live.settings));
    }
  }, [live]);

  function updateSetting(key, value) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings() {
    setSavingSettings(true);
    try {
      await patchWhatsAppSettings(settings);
      toast.success("Settings saved");
      await load();
    } catch (err) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSavingSettings(false);
    }
  }

  async function handleSetupSubmit(e) {
    e.preventDefault();
    if (!reqNumber.trim()) {
      toast.error("Please enter your business WhatsApp number");
      return;
    }
    setSubmitting(true);
    try {
      await postWhatsAppSetupRequest({
        requestedNumber: reqNumber.trim(),
        language: reqLang,
        handoffNumber: reqHandoff.trim(),
      });
      toast.success(
        "Request submitted. We will contact you within 24–48 hours.",
      );
      setRequestOpen(false);
      setReqNumber("");
      setReqHandoff("");
      setReqLang("both");
      await load();
    } catch (err) {
      toast.error(err.message || "Could not submit request");
    } finally {
      setSubmitting(false);
    }
  }

  async function loadConversations() {
    try {
      const data = await getWhatsAppConversations({ limit: 30, page: 1 });
      setConversations(data.conversations || []);
    } catch (e) {
      toast.error(e.message || "Failed to load conversations");
    }
  }

  function openConversationsPanel() {
    setActivePanel("conversations");
    setConvLoading(true);
    loadConversations().finally(() => setConvLoading(false));
  }

  function openSettingsPanel() {
    setActivePanel("settings");
  }

  const openConversation = useCallback(async (conv) => {
    setActiveConv(conv);
    markAlertRead(String(conv._id));
    setUnreadCounts((prev) => ({
      ...prev,
      [String(conv._id)]: 0,
    }));
    try {
      const data = await getWhatsAppConversation(conv._id);
      setConvDetail(data.conversation);
    } catch {
      toast.error("Could not load conversation");
    }
  }, [markAlertRead]);

  useEffect(() => {
    openConversationRef.current = openConversation;
  }, [openConversation]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    activeConvRef.current = activeConv;
    setActiveConversationId(activeConv?._id ? String(activeConv._id) : null);
  }, [activeConv, setActiveConversationId]);

  useEffect(() => {
    setConversationClickHandler((conversationId) => {
      setActivePanel("conversations");
      const conv = conversationsRef.current.find(
        (c) => String(c._id) === String(conversationId),
      );
      if (conv) {
        openConversationRef.current?.(conv);
        return;
      }
      loadConversations().then(() => {
        const loaded = conversationsRef.current.find(
          (c) => String(c._id) === String(conversationId),
        );
        if (loaded) openConversationRef.current?.(loaded);
      });
    });
  }, [setConversationClickHandler]);

  useEffect(() => {
    const pendingId = consumePendingOpenConversationId();
    if (!pendingId || !conversations.length) return;
    const conv = conversations.find((c) => String(c._id) === pendingId);
    if (conv) openConversationRef.current?.(conv);
  }, [conversations, consumePendingOpenConversationId]);

  const isLive = state === "live" || state === "live_paused";

  useEffect(() => {
    if (!isLive || loading || livePanelInitRef.current) return;
    livePanelInitRef.current = true;
    setActivePanel("conversations");
    setConvLoading(true);
    loadConversations().finally(() => setConvLoading(false));
  }, [isLive, loading]);

  function confirmDeleteConversation(conv) {
    setDeleteModal({
      open: true,
      type: "single",
      target: conv,
    });
  }

  function confirmClearAll() {
    setDeleteModal({
      open: true,
      type: "all",
      target: null,
    });
  }

  async function handleDeleteConfirm() {
    setDeleting(true);
    try {
      if (deleteModal.type === "all") {
        const result = await clearAllWhatsAppConversations();
        setConversations([]);
        setActiveConv(null);
        setConvDetail(null);
        toast.success(`${result.cleared} conversations cleared`);
      } else {
        await deleteWhatsAppConversation(deleteModal.target._id);
        setConversations((prev) =>
          prev.filter((c) => c._id !== deleteModal.target._id),
        );
        if (activeConv?._id === deleteModal.target._id) {
          setActiveConv(null);
          setConvDetail(null);
        }
        toast.success("Conversation deleted");
      }
      setDeleteModal({
        open: false,
        type: null,
        target: null,
      });
    } catch (err) {
      toast.error(err?.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  async function handleTakeOver() {
    if (!activeConv) return;
    setTakingOver(true);
    try {
      const res = await takeOverWhatsAppConversation(activeConv._id);
      setConvDetail((prev) => ({
        ...prev,
        mode: "human",
        assignedToName: res.assignedToName || "You",
      }));
      setConversations((prev) =>
        prev.map((c) =>
          c._id === activeConv._id
            ? {
                ...c,
                mode: "human",
                assignedToName: res.assignedToName || "You",
                needsHuman: false,
              }
            : c,
        ),
      );
      toast.success("You are now handling this chat");
    } catch (err) {
      toast.error(err?.message || "Takeover failed");
    } finally {
      setTakingOver(false);
    }
  }

  async function handleRelease() {
    if (!activeConv) return;
    try {
      await releaseWhatsAppConversation(activeConv._id);
      setConvDetail((prev) => ({
        ...prev,
        mode: "ai",
        assignedToName: "",
      }));
      setConversations((prev) =>
        prev.map((c) =>
          c._id === activeConv._id
            ? { ...c, mode: "ai", assignedToName: "" }
            : c,
        ),
      );
      setReplyText("");
      toast.success("Released back to AI");
    } catch (err) {
      toast.error(err?.message || "Release failed");
    }
  }

  async function handleSendReply() {
    if (!replyText.trim() || sending || !activeConv) return;
    setSending(true);
    try {
      await replyWhatsAppConversation(activeConv._id, replyText.trim());
      const newMsg = {
        role: "human",
        content: replyText.trim(),
        timestamp: new Date(),
        sentByName: "You",
      };
      setConvDetail((prev) => ({
        ...prev,
        messages: [...(prev.messages || []), newMsg],
      }));
      setReplyText("");
    } catch (err) {
      toast.error(err?.message || "Failed to send");
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [convDetail?.messages?.length]);

  useEffect(() => {
    if (!socket) return;

    const onMessage = (data) => {
      const {
        conversationId,
        role,
        content,
        timestamp,
        customerPhone,
        sentByName,
      } = data;
      const cid = String(conversationId);
      const msgTimestamp = timestamp || new Date().toISOString();

      setConversations((prev) => {
        const existing = prev.find((c) => String(c._id) === cid);
        if (existing) {
          const updated = {
            ...existing,
            lastMessageAt: msgTimestamp,
            messages: [
              ...(existing.messages || []),
              { role, content, timestamp: msgTimestamp, sentByName },
            ],
          };
          return [updated, ...prev.filter((c) => String(c._id) !== cid)];
        }
        loadConversations();
        return prev;
      });

      if (String(activeConvRef.current?._id) === cid) {
        setConvDetail((prev) =>
          prev
            ? {
                ...prev,
                messages: [
                  ...(prev.messages || []),
                  {
                    role,
                    content,
                    timestamp: msgTimestamp,
                    sentByName,
                  },
                ],
              }
            : prev,
        );
      }

      if (role === "user") {
        if (String(activeConvRef.current?._id) !== cid) {
          setUnreadCounts((prev) => ({
            ...prev,
            [cid]: (prev[cid] || 0) + 1,
          }));
        }
      }
    };

    const onNeedsHuman = (data) => {
      const { conversationId } = data;
      const cid = String(conversationId);

      setConversations((prev) =>
        prev.map((c) =>
          String(c._id) === cid ? { ...c, needsHuman: true } : c,
        ),
      );

      if (String(activeConvRef.current?._id) === cid) {
        setConvDetail((prev) => (prev ? { ...prev, needsHuman: true } : prev));
      }
    };

    const onTakeover = (data) => {
      const { conversationId, assignedToName } = data;
      const cid = String(conversationId);

      setConversations((prev) =>
        prev.map((c) =>
          String(c._id) === cid
            ? { ...c, mode: "human", assignedToName, needsHuman: false }
            : c,
        ),
      );

      if (String(activeConvRef.current?._id) === cid) {
        setConvDetail((prev) =>
          prev
            ? {
                ...prev,
                mode: "human",
                assignedToName,
                needsHuman: false,
              }
            : prev,
        );
      }
    };

    const onReleased = (data) => {
      const { conversationId } = data;
      const cid = String(conversationId);

      setConversations((prev) =>
        prev.map((c) =>
          String(c._id) === cid ? { ...c, mode: "ai", assignedToName: "" } : c,
        ),
      );

      if (String(activeConvRef.current?._id) === cid) {
        setConvDetail((prev) =>
          prev ? { ...prev, mode: "ai", assignedToName: "" } : prev,
        );
      }
    };

    socket.on("whatsapp:message", onMessage);
    socket.on("whatsapp:needs_human", onNeedsHuman);
    socket.on("whatsapp:takeover", onTakeover);
    socket.on("whatsapp:released", onReleased);

    return () => {
      socket.off("whatsapp:message", onMessage);
      socket.off("whatsapp:needs_human", onNeedsHuman);
      socket.off("whatsapp:takeover", onTakeover);
      socket.off("whatsapp:released", onReleased);
    };
  }, [socket]);

  const statusConfig = {
    not_connected: {
      label: "Not connected",
      dot: "bg-gray-400",
      badge:
        "bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-neutral-400",
    },
    pending: {
      label: "Setup in progress",
      dot: "bg-amber-500 animate-pulse",
      badge:
        "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    },
    live: {
      label: "Live",
      dot: "bg-emerald-500",
      badge:
        "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    },
    live_paused: {
      label: "Paused",
      dot: "bg-amber-500",
      badge:
        "bg-amber-100 text-amber-900 dark:bg-amber-950/70 dark:text-amber-200",
    },
  };

  const isPaused = state === "live_paused" || (live && live.isActive === false);
  const status = isLive ? (isPaused ? "live_paused" : "live") : state;
  const sc = statusConfig[status] || statusConfig.not_connected;
  const restaurantName =
    getStoredAuth()?.restaurant?.website?.name ||
    getStoredAuth()?.restaurant?.name ||
    "your restaurant";

  const isNotConnected = !loading && state === "not_connected";

  return (
    <AdminLayout
      title="WhatsApp AI Receptionist"
      subtitle={
        isNotConnected
          ? "Automate your WhatsApp"
          : "Conversations, orders & settings"
      }
    >
      <PermissionGate permission="whatsapp.view">
      {loading ? (
        <div className="mx-auto flex max-w-lg flex-col items-center justify-center gap-3 rounded-2xl border border-gray-200 bg-white py-20 dark:border-neutral-800 dark:bg-neutral-950">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
          <p className="text-sm text-gray-500 dark:text-neutral-500">
            Loading status…
          </p>
        </div>
      ) : state === "not_connected" ? (
        <div className="mx-auto w-full max-w-md px-1 py-4 sm:max-w-lg md:max-w-xl md:py-8">
          <div className="relative overflow-hidden rounded-2xl border border-emerald-200/70 bg-gradient-to-b from-emerald-50/90 via-white to-white p-6 shadow-sm dark:border-emerald-500/20 dark:from-emerald-950/40 dark:via-neutral-950 dark:to-neutral-950 md:p-8">
            <div className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-emerald-400/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-8 -left-8 h-28 w-28 rounded-full bg-teal-400/10 blur-2xl" />

            <div className="relative text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/25">
                <MessageCircle className="h-7 w-7" strokeWidth={1.75} />
              </div>

              <span
                className={`mb-4 inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${sc.badge}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                {sc.label}
              </span>

              <h2 className="text-xl font-bold leading-snug tracking-tight text-gray-900 dark:text-white md:text-2xl">
                Automate your WhatsApp.
              </h2>
              <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-gray-600 dark:text-neutral-400">
                Get your hands on AI based customer support system. Your AI
                answers WhatsApp messages, takes orders, and books tables —
                24/7.
              </p>

              <button
                type="button"
                onClick={() => setRequestOpen(true)}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-[0.98] sm:w-auto"
              >
                <Sparkles className="h-4 w-4" />
                Get started
              </button>
            </div>

            <div className="relative mt-8 space-y-3 border-t border-emerald-100 pt-8 dark:border-emerald-500/15">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div
                  key={title}
                  className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white/80 p-3.5 dark:border-neutral-800 dark:bg-neutral-900/50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 text-left">
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-gray-500 dark:text-neutral-500">
                      {desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="relative mt-8 rounded-xl border border-emerald-100 bg-emerald-50/60 p-5 text-center dark:border-emerald-500/20 dark:bg-emerald-950/30">
              <p className="text-sm font-bold text-gray-900 dark:text-white">
                Ready to connect?
              </p>
              <p className="mt-1.5 text-xs leading-relaxed text-gray-600 dark:text-neutral-400">
                Rs 4,500/month add-on · Setup in 24–48 hours · No Meta account
                needed
              </p>
              <button
                type="button"
                onClick={() => setRequestOpen(true)}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 active:scale-[0.98]"
              >
                Request setup
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Hero — live / pending / paused only */}
          <div
            className={`relative mb-6 overflow-hidden rounded-2xl border p-5 md:p-6 ${
              isPaused
                ? "border-amber-200/70 bg-gradient-to-br from-amber-50 via-white to-orange-50 dark:border-amber-500/25 dark:from-amber-950/40 dark:via-neutral-950 dark:to-orange-950/20"
                : "border-emerald-200/60 bg-gradient-to-br from-emerald-50 via-white to-teal-50 dark:border-emerald-500/20 dark:from-emerald-950/30 dark:via-neutral-950 dark:to-teal-950/20"
            }`}
          >
            <div
              className={`pointer-events-none absolute -right-8 -top-8 h-40 w-40 rounded-full blur-3xl ${
                isPaused ? "bg-amber-400/10" : "bg-emerald-400/10"
              }`}
            />
            <div
              className={`pointer-events-none absolute -bottom-6 -left-6 h-32 w-32 rounded-full blur-2xl ${
                isPaused ? "bg-orange-400/10" : "bg-teal-400/10"
              }`}
            />

            <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg ${
                    isPaused
                      ? "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/25"
                      : "bg-gradient-to-br from-emerald-500 to-teal-600 shadow-emerald-500/25"
                  }`}
                >
                  {isPaused ? (
                    <PauseCircle className="h-7 w-7" strokeWidth={1.75} />
                  ) : (
                    <MessageCircle className="h-7 w-7" strokeWidth={1.75} />
                  )}
                </div>
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${sc.badge}`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                      {sc.label}
                    </span>
                  </div>
                  <p className="max-w-md text-sm leading-relaxed text-gray-600 dark:text-neutral-400">
                    {isPaused
                      ? "Your WhatsApp line is connected but the AI is turned off. Customers won't get automated replies until service is resumed."
                      : "Your AI answers WhatsApp, takes orders, and books tables — 24/7. We host everything on EatsDesk."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {state === "pending" ? (
            <div className="rounded-2xl border border-amber-200/60 bg-white p-6 dark:border-amber-500/20 dark:bg-neutral-950">
              <p className="mb-1 text-lg font-bold text-gray-900 dark:text-white">
                We&apos;re connecting your WhatsApp
              </p>
              <p className="mb-6 text-sm text-gray-500 dark:text-neutral-500">
                Our team usually completes this within 24–48 hours. This page
                will show &quot;Live&quot; when ready.
              </p>

              <div className="mb-6 space-y-0">
                {SETUP_STEPS.map((step, i) => (
                  <div key={step.label} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                          i === 0
                            ? "bg-emerald-600 text-white"
                            : "border-2 border-gray-200 bg-white text-gray-400 dark:border-neutral-700 dark:bg-neutral-900"
                        }`}
                      >
                        {i === 0 ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                      </div>
                      {i < SETUP_STEPS.length - 1 && (
                        <div
                          className={`my-1 h-8 w-0.5 ${i === 0 ? "bg-emerald-300 dark:bg-emerald-700" : "bg-gray-200 dark:bg-neutral-700"}`}
                        />
                      )}
                    </div>
                    <div
                      className={`pb-5 ${i === SETUP_STEPS.length - 1 ? "pb-0" : ""}`}
                    >
                      <p
                        className={`text-sm font-semibold ${i === 0 ? "text-gray-900 dark:text-white" : "text-gray-400 dark:text-neutral-600"}`}
                      >
                        {step.label}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {pendingRequest && (
                <dl className="grid gap-3 rounded-xl bg-gray-50 p-4 sm:grid-cols-3 dark:bg-neutral-900">
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                      Submitted
                    </dt>
                    <dd className="mt-0.5 text-sm font-medium text-gray-900 dark:text-white">
                      {formatSubmitted(pendingRequest.submittedAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                      Number
                    </dt>
                    <dd className="mt-0.5 font-mono text-sm font-medium text-gray-900 dark:text-white">
                      {pendingRequest.maskedNumber}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-neutral-500">
                      Language
                    </dt>
                    <dd className="mt-0.5 capitalize text-sm font-medium text-gray-900 dark:text-white">
                      {pendingRequest.language}
                    </dd>
                  </div>
                </dl>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {isPaused && (
                <div className="overflow-hidden rounded-2xl border border-amber-200/80 bg-amber-50/90 dark:border-amber-500/30 dark:bg-amber-950/30">
                  <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400">
                      <AlertTriangle className="h-5 w-5" strokeWidth={2} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base font-bold text-amber-950 dark:text-amber-100">
                        Service paused — AI is not responding
                      </h2>
                      <p className="mt-1.5 text-sm leading-relaxed text-amber-900/80 dark:text-amber-200/80">
                        Incoming WhatsApp messages on{" "}
                        <span className="font-mono font-semibold">
                          {live?.maskedNumber}
                        </span>{" "}
                        will not be answered by your AI receptionist. New orders
                        and bookings are not being taken until EatsDesk
                        reactivates your line.
                      </p>
                      <ul className="mt-3 space-y-1.5 text-sm text-amber-900/70 dark:text-amber-200/70">
                        <li className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          Your number stays connected — only the AI auto-replies
                          are off
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                          Past conversations and settings are saved and will
                          apply when resumed
                        </li>
                      </ul>
                      <a
                        href="mailto:support@eatsdesk.com?subject=Resume%20WhatsApp%20AI"
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-amber-700 active:scale-[0.98] dark:bg-amber-600 dark:hover:bg-amber-500"
                      >
                        <Mail className="h-4 w-4" />
                        Contact support to resume
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Live / paused stats */}
              <div
                className={`rounded-2xl border bg-white p-5 dark:bg-neutral-950 ${
                  isPaused
                    ? "border-amber-200/60 dark:border-amber-500/20"
                    : "border-gray-200 dark:border-neutral-800"
                }`}
              >
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-gray-500 dark:text-neutral-500">
                    Connected line{" "}
                    <span className="font-mono font-semibold text-gray-900 dark:text-white">
                      {live?.maskedNumber}
                    </span>
                  </p>
                  {isPaused && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                      <PauseCircle className="h-3 w-3" />
                      Not accepting messages
                    </span>
                  )}
                </div>

                <div
                  className={`grid grid-cols-3 gap-3 ${isPaused ? "opacity-60" : ""}`}
                >
                  {[
                    {
                      icon: MessageCircle,
                      value: live?.stats?.conversationsToday ?? 0,
                      label: "Chats today",
                    },
                    {
                      icon: ShoppingBag,
                      value: live?.stats?.ordersToday ?? 0,
                      label: "Orders placed",
                    },
                    {
                      icon: Zap,
                      value: isPaused
                        ? "—"
                        : live?.stats?.avgResponseSec != null
                          ? `${live.stats.avgResponseSec}s`
                          : "—",
                      label: "Avg response",
                    },
                  ].map(({ icon: Icon, value, label }) => (
                    <div
                      key={label}
                      className={`rounded-xl border px-3 py-4 text-center ${
                        isPaused
                          ? "border-amber-100/80 bg-amber-50/50 dark:border-amber-500/10 dark:bg-amber-950/20"
                          : "border-gray-100 bg-gray-50/80 dark:border-neutral-800 dark:bg-neutral-900/80"
                      }`}
                    >
                      <Icon
                        className={`mx-auto mb-2 h-4 w-4 ${
                          isPaused
                            ? "text-amber-600 dark:text-amber-500"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      />
                      <p className="text-2xl font-black tabular-nums text-gray-900 dark:text-white">
                        {value}
                      </p>
                      <p className="mt-0.5 text-[11px] font-medium text-gray-500 dark:text-neutral-500">
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
                {isPaused && (
                  <p className="mt-3 text-center text-xs text-amber-800/70 dark:text-amber-300/60">
                    Stats shown are from today — no new AI activity while paused
                  </p>
                )}

                <div className="mb-1 flex rounded-xl bg-gray-100 p-1 dark:bg-neutral-900">
                  <button
                    type="button"
                    onClick={openConversationsPanel}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                      activePanel === "conversations"
                        ? isPaused
                          ? "bg-white text-amber-900 shadow-sm dark:bg-neutral-800 dark:text-amber-200"
                          : "bg-white text-emerald-800 shadow-sm dark:bg-neutral-800 dark:text-emerald-300"
                        : "text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white"
                    }`}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Conversations
                    {Object.values(unreadCounts).some((n) => n > 0) && (
                      <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                        {Object.values(unreadCounts).reduce((a, b) => a + b, 0)}
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={openSettingsPanel}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
                      activePanel === "settings"
                        ? isPaused
                          ? "bg-white text-amber-900 shadow-sm dark:bg-neutral-800 dark:text-amber-200"
                          : "bg-white text-emerald-800 shadow-sm dark:bg-neutral-800 dark:text-emerald-300"
                        : "text-gray-600 hover:text-gray-900 dark:text-neutral-400 dark:hover:text-white"
                    }`}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                </div>
              </div>

              {activePanel === "conversations" && (
                <div className="flex max-h-[calc(100dvh-10rem)] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950 md:max-h-[calc(100dvh-11rem)]">
                  <div className="shrink-0 border-b border-gray-100 px-5 py-3.5 dark:border-neutral-800">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-gray-700 dark:text-neutral-300">
                        Conversations
                        {conversations.length > 0 && (
                          <span className="ml-2 text-xs font-normal text-gray-400">
                            ({conversations.length})
                          </span>
                        )}
                      </h3>
                      {conversations.length > 0 && hasPermission("whatsapp.conversations.delete") && (
                        <button
                          type="button"
                          onClick={confirmClearAll}
                          className="flex items-center gap-1 text-xs text-gray-400 transition-colors hover:text-red-500 dark:hover:text-red-400"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3 w-3"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                  {convLoading ? (
                    <div className="flex justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
                    </div>
                  ) : conversations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <MessageCircle className="mb-2 h-8 w-8 text-gray-300 dark:text-neutral-700" />
                      <p className="text-sm text-gray-500 dark:text-neutral-500">
                        No conversations yet
                      </p>
                    </div>
                  ) : (
                    <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,38%)_minmax(0,62%)] overflow-hidden md:grid-cols-[minmax(0,300px)_1fr] md:grid-rows-1">
                      <div className="min-h-0 overflow-y-auto border-b border-gray-100 bg-gray-50/50 p-2 dark:border-neutral-800 dark:bg-neutral-900/30 md:border-b-0 md:border-r">
                        {conversations.map((conv) => (
                          <div
                            key={conv._id}
                            role="button"
                            tabIndex={0}
                            onClick={() => openConversation(conv)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ")
                                openConversation(conv);
                            }}
                            className={`group relative mb-1.5 cursor-pointer rounded-xl border p-3 transition-all ${
                              activeConv?._id === conv._id
                                ? "border-emerald-400 bg-white shadow-sm ring-1 ring-emerald-400/30 dark:bg-neutral-900"
                                : "border-transparent bg-white/80 hover:border-gray-200 hover:bg-white dark:bg-neutral-900/50 dark:hover:border-neutral-700 dark:hover:bg-neutral-900"
                            }`}
                          >
                            {hasPermission("whatsapp.conversations.delete") && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                confirmDeleteConversation(conv);
                              }}
                              className="absolute right-2 top-2 z-10 rounded-lg p-1.5 text-gray-400 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                            >
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-3.5 w-3.5"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                />
                              </svg>
                            </button>
                            )}
                            <div className="mb-2 flex items-start gap-2.5 pr-6">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-xs font-bold text-white">
                                {(
                                  conv.customerName ||
                                  conv.customerPhone ||
                                  "?"
                                )
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="truncate text-sm font-semibold text-gray-800 dark:text-neutral-200">
                                    {conv.customerName || conv.customerPhone}
                                  </span>
                                  <span className="shrink-0 text-[10px] text-gray-400">
                                    {formatRelativeTime(conv.lastMessageAt)}
                                  </span>
                                </div>
                                <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-neutral-500">
                                  {conv.messages?.[conv.messages.length - 1]
                                    ?.content ||
                                    conv.lastMessagePreview ||
                                    "No messages"}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 pl-11">
                              {(unreadCounts[String(conv._id)] || 0) > 0 && (
                                <span className="ml-auto flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white">
                                  {unreadCounts[String(conv._id)] > 9
                                    ? "9+"
                                    : unreadCounts[String(conv._id)]}
                                </span>
                              )}
                              {conv.needsHuman && (
                                <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-900/30 dark:text-red-400">
                                  ⚠️ Needs Help
                                </span>
                              )}
                              {conv.mode === "human" ? (
                                <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-600">
                                  👤 {conv.assignedToName || "Staff"}
                                </span>
                              ) : (
                                <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-600">
                                  🤖 AI
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {convDetail ? (
                        <div className="flex min-h-0 flex-col overflow-hidden bg-[#e5ddd5]/30 dark:bg-neutral-900/50">
                          <div className="flex shrink-0 items-center justify-between border-b border-gray-200/80 bg-white/90 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
                            <div>
                              <p className="text-sm font-bold text-gray-800 dark:text-neutral-200">
                                {convDetail.customerName ||
                                  convDetail.customerPhone}
                              </p>
                              <p className="text-xs text-gray-500">
                                {convDetail.customerPhone}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              {hasPermission("whatsapp.conversations.manage") && (
                              convDetail.mode === "ai" ? (
                                <button
                                  type="button"
                                  onClick={handleTakeOver}
                                  disabled={takingOver}
                                  className="rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
                                >
                                  {takingOver
                                    ? "Taking over..."
                                    : "👤 Take Over"}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={handleRelease}
                                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold text-gray-600 transition-colors hover:border-orange-400 hover:text-orange-500 dark:border-neutral-700 dark:text-neutral-400"
                                >
                                  🤖 Release to AI
                                </button>
                              )
                              )}
                            </div>
                          </div>

                          {convDetail.mode === "human" && (
                            <div className="shrink-0 border-b border-blue-100 bg-blue-50 px-4 py-2 dark:border-blue-800/30 dark:bg-blue-900/20">
                              <p className="text-xs font-medium text-blue-600 dark:text-blue-400">
                                👤 You are handling this conversation — AI is
                                paused
                              </p>
                            </div>
                          )}

                          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
                            {(convDetail.messages || []).map((msg, i) => (
                              <div
                                key={`${msg.timestamp}-${i}`}
                                className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}
                              >
                                <div
                                  className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm ${
                                    msg.role === "user"
                                      ? "rounded-tl-md bg-white text-gray-800 dark:bg-neutral-800 dark:text-neutral-100"
                                      : msg.role === "human"
                                        ? "rounded-tr-md bg-blue-600 text-white"
                                        : "rounded-tr-md bg-[#dcf8c6] text-gray-900 dark:bg-emerald-900/60 dark:text-emerald-50"
                                  }`}
                                >
                                  {msg.role !== "user" && (
                                    <p
                                      className={`mb-0.5 text-[10px] font-medium ${
                                        msg.role === "human"
                                          ? "text-blue-100"
                                          : "text-emerald-800/70 dark:text-emerald-200/70"
                                      }`}
                                    >
                                      {msg.role === "human"
                                        ? `👤 ${msg.sentByName || "Staff"}`
                                        : "🤖 AI Receptionist"}
                                    </p>
                                  )}
                                  <p className="whitespace-pre-wrap leading-relaxed">
                                    {msg.content}
                                  </p>
                                  <p className="mt-1 text-right text-[10px] opacity-60">
                                    {msg.timestamp
                                      ? new Date(
                                          msg.timestamp,
                                        ).toLocaleTimeString([], {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                        })
                                      : ""}
                                  </p>
                                </div>
                              </div>
                            ))}
                            <div ref={messagesEndRef} />
                          </div>

                          {convDetail.mode === "human" && hasPermission("whatsapp.conversations.manage") ? (
                            <div className="shrink-0 border-t border-gray-100 p-4 dark:border-neutral-800">
                              <div className="flex gap-2">
                                <textarea
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSendReply();
                                    }
                                  }}
                                  placeholder="Type your message... (Enter to send)"
                                  rows={2}
                                  className="flex-1 resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/30 dark:border-neutral-700 dark:bg-neutral-800"
                                />
                                <button
                                  type="button"
                                  onClick={handleSendReply}
                                  disabled={sending || !replyText.trim()}
                                  className="self-end rounded-xl bg-orange-500 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
                                >
                                  {sending ? "..." : "Send"}
                                </button>
                              </div>
                            </div>
                          ) : convDetail.mode === "human" ? (
                            <div className="shrink-0 border-t border-gray-100 p-4 dark:border-neutral-800">
                              <p className="text-center text-xs text-gray-400 dark:text-neutral-600">
                                You don&apos;t have permission to reply to conversations.
                              </p>
                            </div>
                          ) : (
                            <div className="shrink-0 border-t border-gray-100 p-4 dark:border-neutral-800">
                              <p className="text-center text-xs text-gray-400 dark:text-neutral-600">
                                🤖 AI is handling this conversation. Click
                                &quot;Take Over&quot; to reply manually.
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex min-h-0 items-center justify-center p-8 text-sm text-gray-400 dark:text-neutral-600">
                          Select a conversation to view messages
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activePanel === "settings" && (
                <div className="rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
                  {isPaused && (
                    <div className="mx-5 mt-5 flex items-start gap-2.5 rounded-xl border border-amber-200/60 bg-amber-50/80 px-3.5 py-3 text-xs leading-relaxed text-amber-900 dark:border-amber-500/25 dark:bg-amber-950/30 dark:text-amber-200">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      Settings can be updated now but won&apos;t take effect
                      until your WhatsApp AI is resumed.
                    </div>
                  )}

                  <div className="mt-4 space-y-5 p-4 rounded-2xl border border-gray-100 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-900/50 mx-1 mb-1">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white -mt-1">
                      AI settings
                    </h3>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-1.5">
                        Greeting Message
                      </label>
                      <textarea
                        value={settings.greetingMessage}
                        onChange={(e) =>
                          updateSetting("greetingMessage", e.target.value)
                        }
                        rows={2}
                        placeholder={`Assalam o Alaikum! Welcome to ${restaurantName} 🍗`}
                        className={`${settingsFieldClass} resize-none`}
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Sent when customer first messages. Leave blank for
                        default.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-2">
                        Language
                      </label>
                      <div className="flex gap-2">
                        {[
                          { val: "auto", label: "🌐 Auto-detect" },
                          { val: "english", label: "🇬🇧 English" },
                          { val: "urdu", label: "🇵🇰 Roman Urdu" },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() =>
                              updateSetting("aiLanguagePreference", opt.val)
                            }
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${settingsToggleClass(
                              settings.aiLanguagePreference === opt.val,
                            )}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-2">
                        Response Style
                      </label>
                      <div className="flex gap-2">
                        {[
                          { val: "formal", label: "👔 Formal" },
                          { val: "friendly", label: "😊 Friendly" },
                          { val: "casual", label: "😎 Casual" },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() =>
                              updateSetting("responseStyle", opt.val)
                            }
                            className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${settingsToggleClass(
                              settings.responseStyle === opt.val,
                            )}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-2">
                        Default Order Type
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { val: "ask", label: "❓ Always ask customer" },
                          { val: "delivery", label: "🛵 Assume delivery" },
                          { val: "takeaway", label: "🥡 Assume takeaway" },
                          { val: "dine_in", label: "🍽 Assume dine-in" },
                        ].map((opt) => (
                          <button
                            key={opt.val}
                            type="button"
                            onClick={() =>
                              updateSetting("defaultOrderType", opt.val)
                            }
                            className={`py-2 px-3 rounded-xl text-xs font-semibold border text-left transition-colors ${settingsToggleClass(
                              settings.defaultOrderType === opt.val,
                            )}`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-2">
                        Estimated Times
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
                          <p className="text-xs text-gray-500 mb-2">
                            🛵 Delivery
                          </p>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={settings.deliveryTimeMin}
                              onChange={(e) =>
                                updateSetting(
                                  "deliveryTimeMin",
                                  Number(e.target.value),
                                )
                              }
                              className="w-14 px-2 py-1 rounded-lg border border-gray-200 dark:border-neutral-600 bg-gray-50 dark:bg-neutral-900 text-xs text-center"
                            />
                            <span className="text-xs text-gray-400">to</span>
                            <input
                              type="number"
                              min={0}
                              value={settings.deliveryTimeMax}
                              onChange={(e) =>
                                updateSetting(
                                  "deliveryTimeMax",
                                  Number(e.target.value),
                                )
                              }
                              className="w-14 px-2 py-1 rounded-lg border border-gray-200 dark:border-neutral-600 bg-gray-50 dark:bg-neutral-900 text-xs text-center"
                            />
                            <span className="text-xs text-gray-400">min</span>
                          </div>
                        </div>
                        <div className="p-3 rounded-xl border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-800">
                          <p className="text-xs text-gray-500 mb-2">
                            🥡 Takeaway
                          </p>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min={0}
                              value={settings.takeawayTimeMin}
                              onChange={(e) =>
                                updateSetting(
                                  "takeawayTimeMin",
                                  Number(e.target.value),
                                )
                              }
                              className="w-14 px-2 py-1 rounded-lg border border-gray-200 dark:border-neutral-600 bg-gray-50 dark:bg-neutral-900 text-xs text-center"
                            />
                            <span className="text-xs text-gray-400">to</span>
                            <input
                              type="number"
                              min={0}
                              value={settings.takeawayTimeMax}
                              onChange={(e) =>
                                updateSetting(
                                  "takeawayTimeMax",
                                  Number(e.target.value),
                                )
                              }
                              className="w-14 px-2 py-1 rounded-lg border border-gray-200 dark:border-neutral-600 bg-gray-50 dark:bg-neutral-900 text-xs text-center"
                            />
                            <span className="text-xs text-gray-400">min</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-1.5">
                        Custom Instructions
                      </label>
                      <textarea
                        value={settings.customInstructions}
                        onChange={(e) =>
                          updateSetting("customInstructions", e.target.value)
                        }
                        rows={4}
                        placeholder={
                          "Examples:\n- We are 100% halal certified\n- Free delivery above Rs 500\n- No MSG used in our food\n- Student discount 10% with ID card"
                        }
                        className={`${settingsFieldClass} resize-none`}
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Tell the AI anything specific about your restaurant.
                        This is injected directly into AI instructions.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-600 dark:text-neutral-400 uppercase tracking-wide mb-1.5">
                        Human Handoff Number
                      </label>
                      <input
                        type="tel"
                        value={settings.humanHandoffNumber}
                        onChange={(e) =>
                          updateSetting("humanHandoffNumber", e.target.value)
                        }
                        placeholder="03001234567"
                        className={settingsFieldClass}
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        If AI can&apos;t handle a request, it gives customers
                        this number.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={saveSettings}
                      disabled={savingSettings}
                      className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold transition-colors disabled:opacity-50"
                    >
                      {savingSettings ? "Saving..." : "Save Settings"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Setup modal */}
      {requestOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="whatsapp-setup-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-2xl dark:bg-neutral-950">
            <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <div>
                  <h2
                    id="whatsapp-setup-title"
                    className="text-base font-bold text-gray-900 dark:text-white"
                  >
                    Request WhatsApp setup
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-neutral-500">
                    We&apos;ll connect your business number
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRequestOpen(false)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSetupSubmit} className="space-y-4 p-5">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                  Business WhatsApp number
                </span>
                <input
                  required
                  value={reqNumber}
                  onChange={(e) => setReqNumber(e.target.value)}
                  className={inputClass}
                  placeholder="+923001234567 or 03001234567"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                  Preferred language
                </span>
                <select
                  value={reqLang}
                  onChange={(e) => setReqLang(e.target.value)}
                  className={inputClass}
                >
                  <option value="urdu">Urdu / Roman Urdu</option>
                  <option value="english">English</option>
                  <option value="both">Both</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-neutral-300">
                  Manager handoff number{" "}
                  <span className="font-normal text-gray-400">(optional)</span>
                </span>
                <input
                  value={reqHandoff}
                  onChange={(e) => setReqHandoff(e.target.value)}
                  className={inputClass}
                  placeholder="Phone for when AI needs a human"
                />
              </label>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setRequestOpen(false)}
                  className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  {submitting ? (
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  ) : (
                    "Submit request"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-neutral-900">
            <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-red-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            </div>

            <h3 className="mb-2 text-center text-base font-bold text-gray-900 dark:text-white">
              {deleteModal.type === "all"
                ? "Clear all conversations?"
                : "Delete this conversation?"}
            </h3>

            <p className="mb-6 text-center text-sm text-gray-500 dark:text-neutral-400">
              {deleteModal.type === "all"
                ? `This will close all ${conversations.length} conversations. The AI will start fresh with each customer next time they message.`
                : `Conversation with ${
                    deleteModal.target?.customerName ||
                    deleteModal.target?.customerPhone
                  } will be closed. Orders placed in this conversation are not affected.`}
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() =>
                  setDeleteModal({
                    open: false,
                    type: null,
                    target: null,
                  })
                }
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-50"
              >
                {deleting
                  ? "Clearing..."
                  : deleteModal.type === "all"
                    ? "Clear all"
                    : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
      </PermissionGate>
    </AdminLayout>
  );
}
