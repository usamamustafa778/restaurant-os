"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Download, ExternalLink, QrCode } from "lucide-react";
import toast from "react-hot-toast";

export default function DigitalMenuQrPanel({
  menuUrl = "",
  restaurantName = "",
}) {
  const canvasRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function draw() {
      if (!menuUrl || !canvasRef.current) {
        setReady(false);
        return;
      }

      try {
        const QRCode = (await import("qrcode")).default;
        if (cancelled) return;
        await QRCode.toCanvas(canvasRef.current, menuUrl, {
          width: 220,
          margin: 2,
          color: { dark: "#111827", light: "#ffffff" },
          errorCorrectionLevel: "M",
        });
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) setReady(false);
      }
    }

    draw();
    return () => {
      cancelled = true;
    };
  }, [menuUrl]);

  async function copyLink() {
    if (!menuUrl) return;
    try {
      await navigator.clipboard.writeText(menuUrl);
      toast.success("Menu link copied");
    } catch {
      toast.error("Could not copy link");
    }
  }

  function downloadQr() {
    if (!canvasRef.current || !ready) return;
    const link = document.createElement("a");
    const safeName = (restaurantName || "menu")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    link.download = `${safeName || "digital-menu"}-qr.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
    toast.success("QR code downloaded");
  }

  if (!menuUrl) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5 text-sm text-gray-500 dark:border-neutral-700 dark:bg-neutral-900/40 dark:text-neutral-400">
        Publish your website with a subdomain to get a digital menu link and QR code.
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <div className="flex flex-col items-center gap-3">
        <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-neutral-700 dark:bg-neutral-950">
          <canvas ref={canvasRef} className="block h-[220px] w-[220px]" />
        </div>
        <button
          type="button"
          onClick={downloadQr}
          disabled={!ready}
          className="inline-flex h-9 items-center gap-2 rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          <Download className="h-3.5 w-3.5" />
          Download QR
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-neutral-400">
            Digital menu link
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              readOnly
              value={menuUrl}
              className="h-10 flex-1 rounded-xl border-2 border-gray-200 bg-gray-50 px-3 font-mono text-xs text-gray-800 outline-none dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-200"
            />
            <button
              type="button"
              onClick={copyLink}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border-2 border-gray-200 px-4 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900"
            >
              <Copy className="h-3.5 w-3.5" />
              Copy
            </button>
            <a
              href={menuUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-secondary px-4 text-xs font-semibold text-white"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Open
            </a>
          </div>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-gray-700 dark:text-neutral-300">
          <div className="mb-2 flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
            <QrCode className="h-4 w-4 text-primary" />
            For dine-in &amp; takeaway
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-gray-600 dark:text-neutral-400">
            <li>Print the QR and place it on tables or at the counter.</li>
            <li>Customers scan to browse your menu on their phone — no app needed.</li>
            <li>They can tap <strong>Order online</strong> if website ordering is enabled.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
