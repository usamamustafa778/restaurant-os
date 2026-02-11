import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import { getDeals } from "../../lib/apiClient";
import { Percent, ToggleLeft, ToggleRight } from "lucide-react";

export default function DealsPage() {
  const [deals, setDeals] = useState([]);

  useEffect(() => {
    getDeals().then(setDeals);
  }, []);

  function toggleDeal(id) {
    setDeals(prev =>
      prev.map(d => (d.id === id ? { ...d, active: !d.active } : d))
    );
  }

  return (
    <AdminLayout title="Deals Management">
      <Card
        title="Active Deals"
        description="Run targeted discounts to drive traffic and move inventory."
      >
        <div className="space-y-3 text-xs">
          {deals.map(deal => (
            <div
              key={deal.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg bg-bg-secondary dark:bg-neutral-950 border border-gray-300 dark:border-neutral-800"
            >
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <Percent className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-medium text-gray-900 dark:text-neutral-100 flex items-center gap-2">
                    {deal.name}
                    <span className="badge badge-info">
                      {deal.discountPercent}% OFF
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-900 dark:text-neutral-400 mt-1">
                    {deal.description}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="subtle"
                onClick={() => toggleDeal(deal.id)}
                className="flex items-center gap-1"
              >
                {deal.active ? (
                  <>
                    <ToggleRight className="w-4 h-4 text-green-400" />
                    Active
                  </>
                ) : (
                  <>
                    <ToggleLeft className="w-4 h-4 text-neutral-500" />
                    Inactive
                  </>
                )}
              </Button>
            </div>
          ))}

          {deals.length === 0 && (
            <p className="text-neutral-500 text-xs">
              No deals defined yet. Add promotions to shape demand.
            </p>
          )}
        </div>
      </Card>
    </AdminLayout>
  );
}

