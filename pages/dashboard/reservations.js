import { useState, useEffect } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import {
  Calendar,
  Clock,
  Users,
  Phone,
  Mail,
  Check,
  X,
  Plus,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

export default function ReservationsPage() {
  const [reservations] = useState([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    // Simulate loading (when backend integration is added, fetch data here)
    const timer = setTimeout(() => {
      setPageLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case "CONFIRMED":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400";
      case "PENDING":
        return "bg-orange-100 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400";
      case "CANCELLED":
        return "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400";
      case "COMPLETED":
        return "bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400";
    }
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <AdminLayout title="Reservations">
      {pageLoading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
            <Calendar className="w-10 h-10 text-primary animate-pulse" />
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
              Loading reservations...
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            {/* Filter Tabs */}
            <div className="flex gap-2 overflow-x-auto">
        {["All", "Pending", "Confirmed", "Completed", "Cancelled"].map((tab) => (
          <button
            key={tab}
            className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
              tab === "All"
                ? "bg-primary text-white shadow-md"
                : "bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-700 text-gray-600 dark:text-neutral-400 hover:border-primary"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>
        <button className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all">
          <Plus className="w-4 h-4" />
          New Reservation
        </button>
      </div>

      {/* Reservations Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {reservations.map((reservation) => (
          <div
            key={reservation.id}
            className="bg-white dark:bg-neutral-950 border border-gray-200 dark:border-neutral-800 rounded-xl overflow-hidden hover:shadow-lg transition-shadow"
          >
            {/* Date Badge */}
            <div className="bg-gradient-to-r from-primary/10 to-transparent px-5 py-3 border-b border-gray-200 dark:border-neutral-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-12 h-12 rounded-lg bg-primary flex flex-col items-center justify-center text-white">
                    <span className="text-xs font-semibold">
                      {new Date(reservation.date)
                        .toLocaleDateString("en-US", { month: "short" })
                        .toUpperCase()}
                    </span>
                    <span className="text-xl font-bold">
                      {new Date(reservation.date).getDate()}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-white">
                      {reservation.customerName}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-neutral-400">
                      <Clock className="w-3 h-3" />
                      <span>{reservation.time}</span>
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${getStatusColor(reservation.status)}`}
                >
                  {reservation.status}
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-neutral-300">
                <Users className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
                <span>{reservation.guests} Guests</span>
                {reservation.tableNumber && (
                  <>
                    <span className="text-gray-300 dark:text-neutral-700">
                      •
                    </span>
                    <span>Table {reservation.tableNumber}</span>
                  </>
                )}
              </div>

              {reservation.customerPhone && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-neutral-400">
                  <Phone className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
                  <span>{reservation.customerPhone}</span>
                </div>
              )}

              {reservation.customerEmail && (
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-neutral-400">
                  <Mail className="w-4 h-4 text-gray-400 dark:text-neutral-500" />
                  <span className="truncate">{reservation.customerEmail}</span>
                </div>
              )}

              {reservation.notes && (
                <div className="pt-3 border-t border-gray-100 dark:border-neutral-800">
                  <p className="text-xs text-gray-500 dark:text-neutral-500 italic">
                    "{reservation.notes}"
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              {reservation.status === "PENDING" && (
                <div className="pt-3 border-t border-gray-100 dark:border-neutral-800 grid grid-cols-2 gap-2">
                  <button className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs font-semibold hover:bg-emerald-600 transition-colors">
                    <Check className="w-3.5 h-3.5" />
                    Confirm
                  </button>
                  <button className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 text-red-600 dark:text-red-400 text-xs font-semibold hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors">
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

          {reservations.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20">
              <Calendar className="w-16 h-16 text-gray-300 dark:text-neutral-700 mb-4" />
              <p className="text-gray-500 dark:text-neutral-400 text-sm">
                No reservations yet
              </p>
              <p className="text-gray-400 dark:text-neutral-500 text-xs mt-1">
                Create a new reservation to get started
              </p>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  );
}
