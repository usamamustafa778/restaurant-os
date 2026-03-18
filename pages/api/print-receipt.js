import net from "net";

const ESC = "\x1B";
const GS = "\x1D";
const LF = "\x0A";

const CMD = {
  INIT: ESC + "@",
  BOLD_ON: ESC + "E\x01",
  BOLD_OFF: ESC + "E\x00",
  CENTER: ESC + "a\x01",
  LEFT: ESC + "a\x00",
  DOUBLE_H: ESC + "!\x10",
  NORMAL: ESC + "!\x00",
  CUT: GS + "V" + "B" + "\x03",
};

const LINE_WIDTH = 42;
const DASH_LINE = "-".repeat(LINE_WIDTH);

function pad(left, right) {
  const gap = LINE_WIDTH - left.length - right.length;
  return left + " ".repeat(Math.max(1, gap)) + right;
}

function buildEscPos(o) {
  const b = [];
  const ln = (t = "") => b.push(t + LF);

  b.push(CMD.INIT);

  b.push(CMD.CENTER, CMD.BOLD_ON, CMD.DOUBLE_H);
  ln(o.restaurantName || "Eats Desk");
  b.push(CMD.NORMAL, CMD.BOLD_ON);
  ln("TEMPORARY RECEIPT");
  b.push(CMD.BOLD_OFF);
  if (o.branchAddress) ln(o.branchAddress);

  b.push(CMD.LEFT);
  ln(DASH_LINE);

  if (o.branchName) ln(pad("Branch Name:", o.branchName));
  ln(pad("Invoice #:", String(o.orderId || "")));
  ln(pad("Order Time:", o.createdAt || ""));
  ln(pad("Order Type:", o.type || "dine-in"));
  ln(pad("Payment:", o.paymentMethod || "To be paid"));
  if (o.customerName) ln(pad("Customer:", o.customerName));
  if (o.deliveryAddress && o.deliveryAddress !== "-")
    ln(pad("Address:", o.deliveryAddress));
  if (
    (o.type || "").toLowerCase() === "dine-in" &&
    o.tableName &&
    o.tableName !== "-"
  ) {
    ln(pad("Table No:", o.tableName));
  }
  if (o.waiter && o.waiter !== "N/A") ln(pad("Order Taker:", o.waiter));

  if (o.amountReceived) {
    ln(pad("Received:", "Rs " + Number(o.amountReceived).toFixed(2)));
    ln(pad("Return:", "Rs " + Number(o.returnAmount || 0).toFixed(2)));
  }

  ln(DASH_LINE);
  b.push(CMD.BOLD_ON);
  ln(pad("Item", "Unit  Qty  Total"));
  b.push(CMD.BOLD_OFF);
  ln(DASH_LINE);

  let totalItems = 0;
  let totalQty = 0;
  for (const it of o.items || []) {
    const qty = it.qty ?? it.quantity ?? 1;
    const unit = it.unitPrice ?? it.price ?? 0;
    const lineTotal = it.lineTotal ?? unit * qty;
    totalItems++;
    totalQty += qty;
    ln(it.name || "");
    const detail = `${unit.toFixed(2)}  ${String(qty).padStart(3)}  ${lineTotal.toFixed(2)}`;
    ln(pad("", detail));
  }

  ln(DASH_LINE);
  ln(pad("Total Items:", String(totalItems)));
  ln(pad("Total Qty:", String(totalQty)));
  ln(pad("Subtotal:", Number(o.subtotal || o.total || 0).toFixed(2)));
  if (o.discount > 0)
    ln(pad("Discount:", "- " + Number(o.discount).toFixed(2)));

  b.push(CMD.BOLD_ON, CMD.DOUBLE_H);
  ln(pad("GRAND TOTAL:", Number(o.total || 0).toFixed(2)));
  b.push(CMD.NORMAL, CMD.BOLD_OFF);

  ln(DASH_LINE);
  b.push(CMD.CENTER);
  ln(o.footerMessage || "Thank you for your order!");
  ln("");
  ln("");
  b.push(CMD.CUT);

  return b.join("");
}

function printViaTcp(host, port, data) {
  return new Promise((resolve, reject) => {
    const client = new net.Socket();
    const timer = setTimeout(() => {
      client.destroy();
      reject(new Error("Printer connection timeout"));
    }, 5000);

    client.connect(port, host, () => {
      client.write(Buffer.from(data, "binary"), () => {
        clearTimeout(timer);
        client.end();
        resolve();
      });
    });

    client.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const host = process.env.THERMAL_PRINTER_HOST;
  const port = parseInt(process.env.THERMAL_PRINTER_PORT || "9100", 10);

  if (!host) {
    return res.status(501).json({ error: "THERMAL_PRINTER_HOST not configured" });
  }

  try {
    const escpos = buildEscPos(req.body);
    await printViaTcp(host, port, escpos);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(502).json({ error: err.message || "Print failed" });
  }
}
