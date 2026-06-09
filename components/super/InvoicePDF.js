import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
    fontSize: 10,
    color: "#333",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 28,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: "#FF5400",
  },
  brandName: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#FF5400",
  },
  brandSub: {
    fontSize: 9,
    color: "#666",
    marginTop: 4,
  },
  invoiceTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#1a1a1a",
    textAlign: "right",
  },
  invoiceMeta: {
    fontSize: 9,
    color: "#666",
    textAlign: "right",
    marginTop: 3,
  },
  addressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
    gap: 24,
  },
  addressBlock: {
    width: "48%",
  },
  addressLabel: {
    fontSize: 8,
    fontWeight: "bold",
    color: "#999",
    marginBottom: 6,
    letterSpacing: 1,
  },
  addressName: {
    fontSize: 11,
    fontWeight: "bold",
    marginBottom: 4,
  },
  addressDetail: {
    fontSize: 9,
    color: "#555",
    marginBottom: 2,
  },
  table: {
    marginBottom: 20,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#eee",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#eee",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    backgroundColor: "#fff8f5",
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#eee",
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  colDescription: { width: "50%", fontSize: 9 },
  colPeriod: { width: "25%", fontSize: 9 },
  colAmount: { width: "25%", fontSize: 9, textAlign: "right" },
  headerText: { fontSize: 8, fontWeight: "bold", color: "#666" },
  totalLabel: {
    fontSize: 10,
    fontWeight: "bold",
    marginRight: 16,
  },
  totalAmount: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#FF5400",
    minWidth: 80,
    textAlign: "right",
  },
  paymentBox: {
    backgroundColor: "#f9f9f9",
    padding: 14,
    marginBottom: 16,
    borderRadius: 4,
  },
  paymentTitle: {
    fontSize: 10,
    fontWeight: "bold",
    marginBottom: 8,
  },
  paymentLine: {
    fontSize: 9,
    marginBottom: 3,
    color: "#444",
  },
  paymentIbanLabel: {
    fontSize: 9,
    marginTop: 6,
    marginBottom: 2,
    color: "#444",
  },
  paymentIban: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
    letterSpacing: 0.4,
  },
  notesBox: {
    borderLeftWidth: 3,
    borderLeftColor: "#FF5400",
    paddingLeft: 10,
    marginBottom: 16,
  },
  notesText: {
    fontSize: 9,
    color: "#555",
  },
  footer: {
    marginTop: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
    alignItems: "center",
  },
  footerText: {
    fontSize: 10,
    marginBottom: 4,
  },
  footerSmall: {
    fontSize: 8,
    color: "#999",
  },
  statusBadge: {
    marginTop: 6,
    fontSize: 9,
    color: "#666",
    textAlign: "right",
  },
});

function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatMoney(amount) {
  return `Rs ${Math.round(Number(amount) || 0).toLocaleString("en-PK")}`;
}

const DEFAULT_BANK_DETAILS = {
  accountTitle: "Reddev Software & Solutions",
  bankName: "UBL",
  iban: "PK82UNIL0109000333578142",
};

export function resolveInvoiceBankDetails(bank) {
  const b = bank || {};
  return {
    accountTitle: b.accountTitle || DEFAULT_BANK_DETAILS.accountTitle,
    bankName: b.bankName || DEFAULT_BANK_DETAILS.bankName,
    iban: (b.iban && String(b.iban).trim()) || DEFAULT_BANK_DETAILS.iban,
  };
}

export function InvoiceDocument({ invoice }) {
  const snap = invoice.snapshot || {};
  const bank = resolveInvoiceBankDetails(invoice.bankDetails);
  const period = invoice.billingPeriod?.label || "";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>EatsDesk</Text>
            <Text style={styles.brandSub}>Restaurant OS Platform</Text>
            <Text style={styles.brandSub}>eatsdesk.com</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceMeta}>#{invoice.invoiceNumber}</Text>
            <Text style={styles.invoiceMeta}>
              Date: {formatDate(invoice.createdAt)}
            </Text>
            <Text style={styles.invoiceMeta}>
              Due: {formatDate(invoice.dueDate)}
            </Text>
            <Text style={styles.statusBadge}>Status: {invoice.status}</Text>
          </View>
        </View>

        <View style={styles.addressRow}>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>FROM</Text>
            <Text style={styles.addressName}>Reddev Software & Solutions</Text>
            <Text style={styles.addressDetail}>eatsdesk.com</Text>
            <Text style={styles.addressDetail}>+92 316 622 2269</Text>
          </View>
          <View style={styles.addressBlock}>
            <Text style={styles.addressLabel}>BILL TO</Text>
            <Text style={styles.addressName}>
              {snap.restaurantName || "Restaurant"}
            </Text>
            <Text style={styles.addressDetail}>{snap.ownerName || ""}</Text>
            <Text style={styles.addressDetail}>{snap.ownerEmail || ""}</Text>
            <Text style={styles.addressDetail}>{snap.ownerPhone || ""}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colDescription, styles.headerText]}>
              Description
            </Text>
            <Text style={[styles.colPeriod, styles.headerText]}>Period</Text>
            <Text style={[styles.colAmount, styles.headerText]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.colDescription}>
              EatsDesk {snap.plan || "Subscription"} Plan
            </Text>
            <Text style={styles.colPeriod}>{period}</Text>
            <Text style={styles.colAmount}>{formatMoney(invoice.amount)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Due</Text>
            <Text style={styles.totalAmount}>{formatMoney(invoice.amount)}</Text>
          </View>
        </View>

        <View style={styles.paymentBox}>
          <Text style={styles.paymentTitle}>Payment Details</Text>
          <Text style={styles.paymentLine}>
            Account: {bank.accountTitle}
          </Text>
          <Text style={styles.paymentLine}>Bank: {bank.bankName}</Text>
          <Text style={styles.paymentIbanLabel}>IBAN:</Text>
          <Text style={styles.paymentIban}>{bank.iban}</Text>
        </View>

        {invoice.notes ? (
          <View style={styles.notesBox}>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        ) : null}

        <View style={styles.footer}>
          <Text style={styles.footerText}>Thank you for using EatsDesk!</Text>
          <Text style={styles.footerSmall}>
            This is a computer generated invoice
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function getInvoicePDFBlobUrl(invoice) {
  const blob = await pdf(<InvoiceDocument invoice={invoice} />).toBlob();
  return URL.createObjectURL(blob);
}

/** Open invoice PDF in a new browser tab for viewing. */
export async function viewInvoicePDF(invoice) {
  const url = await getInvoicePDFBlobUrl(invoice);
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    URL.revokeObjectURL(url);
    throw new Error("Pop-up blocked. Allow pop-ups to view the PDF.");
  }
  setTimeout(() => URL.revokeObjectURL(url), 120000);
}

export async function downloadInvoicePDF(invoice) {
  const url = await getInvoicePDFBlobUrl(invoice);
  const link = document.createElement("a");
  link.href = url;
  link.download = `EatsDesk-${invoice.invoiceNumber || "invoice"}.pdf`;
  link.click();
  URL.revokeObjectURL(url);
}
