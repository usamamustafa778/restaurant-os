import { useEffect, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import Card from "../../../components/ui/Card";
import { getRestaurantsForSuperAdmin } from "../../../lib/apiClient";

export default function SuperOverviewPage() {
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    trial: 0,
    suspended: 0
  });

  useEffect(() => {
    getRestaurantsForSuperAdmin().then(restaurants => {
      const total = restaurants.length;
      const active = restaurants.filter(r => r.subscription?.status === "ACTIVE").length;
      const trial = restaurants.filter(r => r.subscription?.status === "TRIAL").length;
      const suspended = restaurants.filter(r => r.subscription?.status === "SUSPENDED").length;
      setStats({ total, active, trial, suspended });
    });
  }, []);

  return (
    <AdminLayout title="Platform Overview">
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card title="Total restaurants">
          <p className="text-2xl font-semibold">{stats.total}</p>
          <p className="text-[11px] text-neutral-400 mt-1">All onboarded tenants</p>
        </Card>
        <Card title="Active">
          <p className="text-2xl font-semibold text-emerald-300">{stats.active}</p>
          <p className="text-[11px] text-neutral-400 mt-1">Billing or live trial</p>
        </Card>
        <Card title="Trial">
          <p className="text-2xl font-semibold text-amber-300">{stats.trial}</p>
          <p className="text-[11px] text-neutral-400 mt-1">Currently on trial</p>
        </Card>
        <Card title="Suspended">
          <p className="text-2xl font-semibold text-red-300">{stats.suspended}</p>
          <p className="text-[11px] text-neutral-400 mt-1">Access blocked</p>
        </Card>
      </div>
      <p className="text-xs text-neutral-400">
        Use the Restaurants screen to drill into individual tenants, tweak subscription status and verify
        website / POS health.
      </p>
    </AdminLayout>
  );
}

