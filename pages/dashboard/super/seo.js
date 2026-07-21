import { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../../components/layout/AdminLayout";
import SuperPageGate from "../../../components/super/SuperPageGate";
import {
  createSeoKeywordForSuperAdmin,
  createSeoLocationForSuperAdmin,
  deleteSeoKeywordForSuperAdmin,
  deleteSeoLocationForSuperAdmin,
  getSeoKeywordsForSuperAdmin,
  getSeoLocationsForSuperAdmin,
  updateSeoKeywordForSuperAdmin,
  updateSeoLocationForSuperAdmin,
} from "../../../lib/apiClient";
import {
  AlertTriangle,
  Building2,
  ChevronDown,
  ChevronRight,
  Globe2,
  KeyRound,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

const INPUT_CLASS =
  "w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-neutral-700 dark:bg-neutral-950 dark:text-white dark:disabled:bg-neutral-800";

const EMPTY_KEYWORD = {
  slug: "",
  label: "",
  titleTemplate: "",
  descriptionTemplate: "",
  category: "",
  active: true,
};

const EMPTY_LOCATION = {
  type: "country",
  name: "",
  slug: "",
  hasStates: false,
  language: "en",
  currency: "EUR",
  vatRate: "",
  localPayments: "",
  qsrGrowth: "",
  population: "",
  region: "",
  context: "",
  active: true,
  countrySlug: "",
  stateSlug: "",
};

function recordId(record) {
  return record?.id || record?._id;
}

function isForbidden(error) {
  return error?.code === 403 || error?.status === 403;
}

function formatPopulation(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : "0";
}

function Field({
  label,
  hint,
  as = "input",
  className = "",
  children,
  ...props
}) {
  const Component = as;
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-neutral-300">
        {label}
      </span>
      {as === "input" ? (
        <input className={INPUT_CLASS} {...props} />
      ) : (
        <Component className={INPUT_CLASS} {...props}>
          {children}
        </Component>
      )}
      {hint ? (
        <span className="mt-1 block text-xs text-gray-500 dark:text-neutral-400">
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function Toggle({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? "bg-emerald-500" : "bg-gray-300 dark:bg-neutral-700"
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function Modal({ title, saving, onClose, onSubmit, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <div className="max-h-[92vh] w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-neutral-700 dark:bg-neutral-900">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-neutral-800">
          <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-neutral-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={onSubmit} className="max-h-[calc(92vh-65px)] overflow-y-auto">
          <div className="space-y-4 p-5">{children}</div>
          <div className="sticky bottom-0 flex justify-end gap-2 border-t border-gray-100 bg-white px-5 py-4 dark:border-neutral-800 dark:bg-neutral-900">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex min-w-[92px] items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, body }) {
  return (
    <div className="flex min-h-[260px] flex-col items-center justify-center px-6 text-center">
      <Icon className="mb-3 h-10 w-10 text-gray-300 dark:text-neutral-700" />
      <p className="font-semibold text-gray-800 dark:text-neutral-200">{title}</p>
      <p className="mt-1 max-w-md text-sm text-gray-500">{body}</p>
    </div>
  );
}

export default function SuperSeoPage() {
  const [tab, setTab] = useState("keywords");
  const [keywords, setKeywords] = useState([]);
  const [locations, setLocations] = useState({});
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [busyKey, setBusyKey] = useState("");
  const [keywordModal, setKeywordModal] = useState(null);
  const [keywordForm, setKeywordForm] = useState(EMPTY_KEYWORD);
  const [locationModal, setLocationModal] = useState(null);
  const [locationForm, setLocationForm] = useState(EMPTY_LOCATION);
  const [saving, setSaving] = useState(false);
  const [expandedCountries, setExpandedCountries] = useState({});
  const [expandedStates, setExpandedStates] = useState({});

  const countries = useMemo(
    () =>
      Object.values(locations || {}).sort((a, b) =>
        (a.name || "").localeCompare(b.name || ""),
      ),
    [locations],
  );

  const loadAll = useCallback(async ({ quiet = false } = {}) => {
    try {
      if (!quiet) setLoading(true);
      const [keywordData, locationData] = await Promise.all([
        getSeoKeywordsForSuperAdmin(),
        getSeoLocationsForSuperAdmin(),
      ]);
      setKeywords(
        Array.isArray(keywordData?.keywords) ? keywordData.keywords : [],
      );
      setLocations(locationData?.locations || {});
      setForbidden(false);
    } catch (error) {
      if (isForbidden(error)) {
        setForbidden(true);
      } else {
        toast.error(error.message || "Failed to load SEO data");
      }
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  function mutationError(error, fallback) {
    if (isForbidden(error)) {
      setForbidden(true);
      toast.error("Owner access is required for SEO management");
      return;
    }
    toast.error(error.message || fallback);
  }

  function openKeyword(keyword = null) {
    setKeywordModal(keyword || { creating: true });
    setKeywordForm(
      keyword
        ? {
            slug: keyword.slug || "",
            label: keyword.label || "",
            titleTemplate: keyword.titleTemplate || "",
            descriptionTemplate: keyword.descriptionTemplate || "",
            category: keyword.category || "",
            active: keyword.active !== false,
          }
        : { ...EMPTY_KEYWORD },
    );
  }

  async function saveKeyword(event) {
    event.preventDefault();
    if (
      !keywordForm.titleTemplate.includes("{city}") ||
      !keywordForm.titleTemplate.includes("{country}") ||
      !keywordForm.descriptionTemplate.includes("{city}") ||
      !keywordForm.descriptionTemplate.includes("{country}")
    ) {
      toast.error("Both templates must include {city} and {country}");
      return;
    }

    setSaving(true);
    try {
      if (keywordModal?.creating) {
        await createSeoKeywordForSuperAdmin(keywordForm);
        toast.success("SEO keyword created");
      } else {
        const payload = { ...keywordForm };
        delete payload.slug;
        await updateSeoKeywordForSuperAdmin(
          recordId(keywordModal),
          payload,
        );
        toast.success("SEO keyword updated");
      }
      setKeywordModal(null);
      await loadAll({ quiet: true });
    } catch (error) {
      mutationError(error, "Could not save keyword");
    } finally {
      setSaving(false);
    }
  }

  async function toggleKeyword(keyword) {
    const id = recordId(keyword);
    try {
      setBusyKey(`keyword-${id}`);
      await updateSeoKeywordForSuperAdmin(id, {
        active: keyword.active === false,
      });
      toast.success(keyword.active === false ? "Keyword activated" : "Keyword paused");
      await loadAll({ quiet: true });
    } catch (error) {
      mutationError(error, "Could not update keyword");
    } finally {
      setBusyKey("");
    }
  }

  async function removeKeyword(keyword) {
    if (
      !window.confirm(
        `Delete “${keyword.label}”? Its generated SEO pages will no longer be available.`,
      )
    ) {
      return;
    }
    const id = recordId(keyword);
    try {
      setBusyKey(`keyword-${id}`);
      await deleteSeoKeywordForSuperAdmin(id);
      toast.success("SEO keyword deleted");
      await loadAll({ quiet: true });
    } catch (error) {
      mutationError(error, "Could not delete keyword");
    } finally {
      setBusyKey("");
    }
  }

  function openLocation(type, { record = null, country = null, state = null } = {}) {
    const editing = Boolean(record);
    setLocationModal({ type, record, country, state, editing });
    setLocationForm({
      ...EMPTY_LOCATION,
      type,
      name: record?.name || "",
      slug: record?.slug || "",
      active: record ? record.active !== false : true,
      countrySlug:
        type === "country"
          ? ""
          : country?.slug || record?.country || record?.countrySlug || "",
      stateSlug:
        type === "city"
          ? state?.slug || record?.state || record?.stateSlug || ""
          : "",
      hasStates: record?.hasStates || false,
      language: record?.language || "en",
      currency: record?.currency || "EUR",
      vatRate: record?.vatRate ?? "",
      localPayments: record?.localPayments || "",
      qsrGrowth: record?.qsrGrowth || "",
      population: record?.population ?? "",
      region: record?.region || "",
      context: record?.context || "",
    });
  }

  async function saveLocation(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const form = { ...locationForm };
      if (form.type === "country") {
        form.vatRate = Number(form.vatRate) || 0;
      }
      if (form.type === "city") {
        form.population = Number(form.population) || 0;
      }

      if (locationModal?.editing) {
        const payload = { ...form };
        delete payload.slug;
        delete payload.type;
        delete payload.countrySlug;
        delete payload.stateSlug;
        await updateSeoLocationForSuperAdmin(
          recordId(locationModal.record),
          payload,
        );
        toast.success(`${form.type[0].toUpperCase()}${form.type.slice(1)} updated`);
      } else {
        await createSeoLocationForSuperAdmin(form);
        toast.success(`${form.type[0].toUpperCase()}${form.type.slice(1)} created`);
      }
      setLocationModal(null);
      await loadAll({ quiet: true });
    } catch (error) {
      mutationError(error, "Could not save location");
    } finally {
      setSaving(false);
    }
  }

  async function toggleCity(city) {
    try {
      setBusyKey(`location-${city.id}`);
      await updateSeoLocationForSuperAdmin(city.id, {
        active: city.active === false,
      });
      toast.success(city.active === false ? "City activated" : "City paused");
      await loadAll({ quiet: true });
    } catch (error) {
      mutationError(error, "Could not update city");
    } finally {
      setBusyKey("");
    }
  }

  async function removeLocation(record, type) {
    const hasDescendants =
      type === "country"
        ? record.hasStates
          ? Object.keys(record.states || {}).length > 0
          : (record.cities || []).length > 0
        : type === "state"
          ? (record.cities || []).length > 0
          : false;
    const warning = hasDescendants
      ? ` This also permanently deletes every ${type === "country" ? "state and city" : "city"} beneath it.`
      : "";
    if (
      !window.confirm(
        `Delete ${type} “${record.name}”?${warning} This cannot be undone.`,
      )
    ) {
      return;
    }
    const id = recordId(record);
    try {
      setBusyKey(`location-${id}`);
      await deleteSeoLocationForSuperAdmin(id);
      toast.success(`${type[0].toUpperCase()}${type.slice(1)} deleted`);
      await loadAll({ quiet: true });
    } catch (error) {
      mutationError(error, `Could not delete ${type}`);
    } finally {
      setBusyKey("");
    }
  }

  function toggleCountry(slug) {
    setExpandedCountries((current) => ({
      ...current,
      [slug]: !(current[slug] !== false),
    }));
  }

  function toggleState(countrySlug, stateSlug) {
    const key = `${countrySlug}/${stateSlug}`;
    setExpandedStates((current) => ({
      ...current,
      [key]: !(current[key] !== false),
    }));
  }

  const locationCount = countries.reduce(
    (total, country) =>
      total +
      1 +
      Object.values(country.states || {}).length +
      (country.cities || []).length +
      Object.values(country.states || {}).reduce(
        (sum, state) => sum + (state.cities || []).length,
        0,
      ),
    0,
  );

  return (
    <AdminLayout
      title="SEO Locations"
      subtitle="Manage programmatic SEO keywords, markets, and city landing pages."
    >
      <SuperPageGate permission="platform.seo.manage">
        {forbidden ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 px-6 text-center dark:border-amber-500/20 dark:bg-amber-500/5">
            <AlertTriangle className="mb-3 h-10 w-10 text-amber-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Platform owner access required
            </h2>
            <p className="mt-1 max-w-md text-sm text-gray-600 dark:text-neutral-400">
              Your role has the SEO permission, but this data is restricted to the
              platform owner account.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-950 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex rounded-xl bg-gray-100 p-1 dark:bg-neutral-900">
                {[
                  { id: "keywords", label: "Keywords", icon: KeyRound },
                  { id: "locations", label: "Locations", icon: MapPin },
                ].map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition sm:flex-none ${
                      tab === id
                        ? "bg-white text-primary shadow-sm dark:bg-neutral-800"
                        : "text-gray-500 hover:text-gray-800 dark:hover:text-neutral-200"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 sm:justify-end">
                <span className="text-xs text-gray-500">
                  {tab === "keywords"
                    ? `${keywords.length} keyword${keywords.length === 1 ? "" : "s"}`
                    : `${locationCount} location${locationCount === 1 ? "" : "s"}`}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    tab === "keywords" ? openKeyword() : openLocation("country")
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <Plus className="h-4 w-4" />
                  {tab === "keywords" ? "Add keyword" : "Add country"}
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex min-h-[360px] items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white text-sm text-gray-500 dark:border-neutral-800 dark:bg-neutral-950">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                Loading SEO data…
              </div>
            ) : tab === "keywords" ? (
              <KeywordList
                keywords={keywords}
                busyKey={busyKey}
                onEdit={openKeyword}
                onToggle={toggleKeyword}
                onDelete={removeKeyword}
              />
            ) : (
              <LocationTree
                countries={countries}
                expandedCountries={expandedCountries}
                expandedStates={expandedStates}
                busyKey={busyKey}
                onToggleCountry={toggleCountry}
                onToggleState={toggleState}
                onAdd={openLocation}
                onEdit={openLocation}
                onToggleCity={toggleCity}
                onDelete={removeLocation}
              />
            )}
          </div>
        )}
      </SuperPageGate>

      {keywordModal ? (
        <Modal
          title={keywordModal.creating ? "Add SEO keyword" : "Edit SEO keyword"}
          saving={saving}
          onClose={() => setKeywordModal(null)}
          onSubmit={saveKeyword}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Slug"
              required
              disabled={!keywordModal.creating}
              value={keywordForm.slug}
              onChange={(event) =>
                setKeywordForm((form) => ({ ...form, slug: event.target.value }))
              }
              placeholder="restaurant-pos"
              hint={!keywordModal.creating ? "Slugs cannot change after creation." : ""}
            />
            <Field
              label="Label"
              required
              value={keywordForm.label}
              onChange={(event) =>
                setKeywordForm((form) => ({ ...form, label: event.target.value }))
              }
              placeholder="Restaurant POS"
            />
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-200">
            Use <code>{"{city}"}</code>, <code>{"{country}"}</code>, and optionally{" "}
            <code>{"{state}"}</code> to personalize generated pages. Title and
            description templates must contain both <code>{"{city}"}</code> and{" "}
            <code>{"{country}"}</code>.
          </div>
          <Field
            label="Title template"
            required
            value={keywordForm.titleTemplate}
            onChange={(event) =>
              setKeywordForm((form) => ({
                ...form,
                titleTemplate: event.target.value,
              }))
            }
            placeholder="Restaurant POS Software in {city}, {country}"
          />
          <Field
            as="textarea"
            rows={4}
            label="Description template"
            required
            value={keywordForm.descriptionTemplate}
            onChange={(event) =>
              setKeywordForm((form) => ({
                ...form,
                descriptionTemplate: event.target.value,
              }))
            }
            placeholder="Find the best restaurant POS software in {city}, {country}…"
          />
          <div className="grid items-end gap-4 sm:grid-cols-2">
            <Field
              label="Category"
              required
              value={keywordForm.category}
              onChange={(event) =>
                setKeywordForm((form) => ({
                  ...form,
                  category: event.target.value,
                }))
              }
              placeholder="POS"
            />
            <label className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-2.5 dark:border-neutral-700">
              <span className="text-sm font-medium">Active</span>
              <Toggle
                checked={keywordForm.active}
                label="Keyword active"
                onChange={(active) =>
                  setKeywordForm((form) => ({ ...form, active }))
                }
              />
            </label>
          </div>
        </Modal>
      ) : null}

      {locationModal ? (
        <LocationModal
          modal={locationModal}
          form={locationForm}
          countries={countries}
          saving={saving}
          setForm={setLocationForm}
          onClose={() => setLocationModal(null)}
          onSubmit={saveLocation}
        />
      ) : null}
    </AdminLayout>
  );
}

function KeywordList({ keywords, busyKey, onEdit, onToggle, onDelete }) {
  if (keywords.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <EmptyState
          icon={KeyRound}
          title="No SEO keywords"
          body="Add a keyword to start generating location-based landing pages."
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-gray-100 bg-gray-50 text-xs uppercase tracking-wide text-gray-500 dark:border-neutral-800 dark:bg-neutral-900/70">
            <tr>
              <th className="px-4 py-3">Keyword</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Pages</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
            {keywords.map((keyword) => (
              <KeywordRow
                key={recordId(keyword)}
                keyword={keyword}
                busyKey={busyKey}
                onEdit={onEdit}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            ))}
          </tbody>
        </table>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-neutral-800 md:hidden">
        {keywords.map((keyword) => {
          const busy = busyKey === `keyword-${recordId(keyword)}`;
          return (
            <div key={recordId(keyword)} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {keyword.label}
                  </p>
                  <p className="truncate text-xs text-gray-500">/{keyword.slug}</p>
                </div>
                <Toggle
                  checked={keyword.active !== false}
                  disabled={busy}
                  label={`Toggle ${keyword.label}`}
                  onChange={() => onToggle(keyword)}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{keyword.category || "Uncategorised"}</span>
                <span>{keyword.pageCount || 0} pages</span>
              </div>
              <div className="flex justify-end gap-1">
                <IconAction label="Edit" icon={Pencil} onClick={() => onEdit(keyword)} />
                <IconAction
                  label="Delete"
                  icon={Trash2}
                  danger
                  disabled={busy}
                  onClick={() => onDelete(keyword)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KeywordRow({ keyword, busyKey, onEdit, onToggle, onDelete }) {
  const busy = busyKey === `keyword-${recordId(keyword)}`;
  return (
    <tr className="hover:bg-gray-50/70 dark:hover:bg-neutral-900/50">
      <td className="px-4 py-3">
        <p className="font-semibold text-gray-900 dark:text-white">{keyword.label}</p>
        <p className="mt-0.5 text-xs text-gray-500">/{keyword.slug}</p>
      </td>
      <td className="px-4 py-3 text-gray-600 dark:text-neutral-300">
        {keyword.category || "—"}
      </td>
      <td className="px-4 py-3 font-medium">{keyword.pageCount || 0}</td>
      <td className="px-4 py-3">
        <Toggle
          checked={keyword.active !== false}
          disabled={busy}
          label={`Toggle ${keyword.label}`}
          onChange={() => onToggle(keyword)}
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-1">
          <IconAction label="Edit" icon={Pencil} onClick={() => onEdit(keyword)} />
          <IconAction
            label="Delete"
            icon={Trash2}
            danger
            disabled={busy}
            onClick={() => onDelete(keyword)}
          />
        </div>
      </td>
    </tr>
  );
}

function IconAction({ label, icon: Icon, danger = false, ...props }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={`rounded-lg p-2 transition disabled:opacity-40 ${
        danger
          ? "text-gray-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10"
          : "text-gray-500 hover:bg-gray-100 hover:text-primary dark:hover:bg-neutral-800"
      }`}
      {...props}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function LocationTree({
  countries,
  expandedCountries,
  expandedStates,
  busyKey,
  onToggleCountry,
  onToggleState,
  onAdd,
  onEdit,
  onToggleCity,
  onDelete,
}) {
  if (countries.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <EmptyState
          icon={Globe2}
          title="No markets configured"
          body="Add a country, then build its state and city landing-page structure."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {countries.map((country) => {
        const open = expandedCountries[country.slug] !== false;
        const states = Object.values(country.states || {}).sort((a, b) =>
          a.name.localeCompare(b.name),
        );
        return (
          <section
            key={country.id}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950"
          >
            <div className="p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <button
                  type="button"
                  onClick={() => onToggleCountry(country.slug)}
                  className="flex min-w-0 items-start gap-3 text-left"
                >
                  <span className="mt-0.5 rounded-xl bg-primary/10 p-2 text-primary">
                    <Globe2 className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-semibold text-gray-900 dark:text-white">
                      {country.name}
                      {open ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      /{country.slug} · {country.hasStates ? `${states.length} states` : `${country.cities?.length || 0} cities`}
                    </span>
                  </span>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onAdd(country.hasStates ? "state" : "city", { country })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:border-primary hover:text-primary dark:border-neutral-700 dark:text-neutral-200"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add {country.hasStates ? "state" : "city"}
                  </button>
                  <IconAction
                    label="Edit country"
                    icon={Pencil}
                    onClick={() =>
                      onEdit("country", { record: country, country })
                    }
                  />
                  <IconAction
                    label="Delete country"
                    icon={Trash2}
                    danger
                    disabled={busyKey === `location-${country.id}`}
                    onClick={() => onDelete(country, "country")}
                  />
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
                <Meta label="Language" value={country.language || "—"} />
                <Meta label="Currency" value={country.currency || "—"} />
                <Meta label="VAT rate" value={`${country.vatRate || 0}%`} />
                <Meta label="Payments" value={country.localPayments || "—"} />
                <Meta label="QSR growth" value={country.qsrGrowth || "—"} />
                <Meta
                  label="Structure"
                  value={country.hasStates ? "State-based" : "Flat cities"}
                />
              </div>
            </div>

            {open ? (
              <div className="border-t border-gray-100 bg-gray-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/30 sm:p-4">
                {country.hasStates ? (
                  states.length ? (
                    <div className="space-y-3">
                      {states.map((state) => (
                        <StateSection
                          key={state.id}
                          country={country}
                          state={state}
                          open={
                            expandedStates[`${country.slug}/${state.slug}`] !==
                            false
                          }
                          busyKey={busyKey}
                          onToggle={() => onToggleState(country.slug, state.slug)}
                          onAdd={onAdd}
                          onEdit={onEdit}
                          onToggleCity={onToggleCity}
                          onDelete={onDelete}
                        />
                      ))}
                    </div>
                  ) : (
                    <SmallEmpty text="No states yet. Add the first state to this country." />
                  )
                ) : country.cities?.length ? (
                  <CityList
                    cities={country.cities}
                    country={country}
                    busyKey={busyKey}
                    onEdit={onEdit}
                    onToggle={onToggleCity}
                    onDelete={onDelete}
                  />
                ) : (
                  <SmallEmpty text="No cities yet. Add the first city to this country." />
                )}
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function Meta({ label, value }) {
  return (
    <div className="min-w-0 rounded-xl bg-gray-50 p-2.5 dark:bg-neutral-900">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
        {label}
      </p>
      <p className="mt-1 truncate font-medium text-gray-700 dark:text-neutral-200" title={String(value)}>
        {value}
      </p>
    </div>
  );
}

function SmallEmpty({ text }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-200 px-4 py-6 text-center text-sm text-gray-500 dark:border-neutral-700">
      {text}
    </p>
  );
}

function StateSection({
  country,
  state,
  open,
  busyKey,
  onToggle,
  onAdd,
  onEdit,
  onToggleCity,
  onDelete,
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <Building2 className="h-4 w-4 text-primary" />
          <span>
            <span className="font-semibold text-gray-900 dark:text-white">
              {state.name}
            </span>
            <span className="ml-2 text-xs text-gray-500">
              {state.cities?.length || 0} cities
            </span>
          </span>
        </button>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onAdd("city", { country, state })}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add city
          </button>
          <IconAction
            label="Edit state"
            icon={Pencil}
            onClick={() => onEdit("state", { record: state, country, state })}
          />
          <IconAction
            label="Delete state"
            icon={Trash2}
            danger
            disabled={busyKey === `location-${state.id}`}
            onClick={() => onDelete(state, "state")}
          />
        </div>
      </div>
      {open ? (
        <div className="border-t border-gray-100 dark:border-neutral-800">
          {state.cities?.length ? (
            <CityList
              cities={state.cities}
              country={country}
              state={state}
              busyKey={busyKey}
              onEdit={onEdit}
              onToggle={onToggleCity}
              onDelete={onDelete}
            />
          ) : (
            <div className="p-3">
              <SmallEmpty text="No cities in this state yet." />
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function CityList({
  cities,
  country,
  state = null,
  busyKey,
  onEdit,
  onToggle,
  onDelete,
}) {
  return (
    <div className="divide-y divide-gray-100 dark:divide-neutral-800">
      {cities.map((city) => {
        const busy = busyKey === `location-${city.id}`;
        return (
          <div
            key={city.id}
            className="grid gap-3 px-4 py-3 hover:bg-gray-50/70 dark:hover:bg-neutral-900/50 md:grid-cols-[minmax(160px,1fr)_120px_minmax(180px,1.5fr)_auto] md:items-center"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
                <p className="truncate font-semibold text-gray-900 dark:text-white">
                  {city.name}
                </p>
              </div>
              <p className="ml-6 truncate text-xs text-gray-500">
                /{[country.slug, state?.slug, city.slug].filter(Boolean).join("/")}
              </p>
            </div>
            <div className="text-xs text-gray-500 md:text-sm">
              <span className="mr-1 md:hidden">Population:</span>
              {formatPopulation(city.population)}
            </div>
            <p className="line-clamp-2 text-xs text-gray-500" title={city.context}>
              {city.context || "No local context added"}
            </p>
            <div className="flex items-center justify-end gap-1">
              <Toggle
                checked={city.active !== false}
                disabled={busy}
                label={`Toggle ${city.name}`}
                onChange={() => onToggle(city)}
              />
              <IconAction
                label="Edit city"
                icon={Pencil}
                onClick={() =>
                  onEdit("city", { record: city, country, state })
                }
              />
              <IconAction
                label="Delete city"
                icon={Trash2}
                danger
                disabled={busy}
                onClick={() => onDelete(city, "city")}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LocationModal({
  modal,
  form,
  countries,
  saving,
  setForm,
  onClose,
  onSubmit,
}) {
  const label = `${modal.editing ? "Edit" : "Add"} ${modal.type}`;
  const selectedCountry = countries.find(
    (country) => country.slug === form.countrySlug,
  );
  const states = Object.values(selectedCountry?.states || {}).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const lockedStructure = modal.editing;

  const change = (key) => (event) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <Modal title={label} saving={saving} onClose={onClose} onSubmit={onSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Name"
          required
          value={form.name}
          onChange={change("name")}
          placeholder={
            form.type === "country"
              ? "Portugal"
              : form.type === "state"
                ? "England"
                : "Lisbon"
          }
        />
        <Field
          label="Slug"
          required
          disabled={modal.editing}
          value={form.slug}
          onChange={change("slug")}
          placeholder="lowercase-url-slug"
          hint={modal.editing ? "URL slugs cannot change after creation." : ""}
        />
      </div>

      {form.type !== "country" ? (
        <div className={`grid gap-4 ${form.type === "city" && selectedCountry?.hasStates ? "sm:grid-cols-2" : ""}`}>
          <Field
            as="select"
            label="Parent country"
            required
            disabled={lockedStructure || Boolean(modal.country)}
            value={form.countrySlug}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                countrySlug: event.target.value,
                stateSlug: "",
              }))
            }
          >
            <option value="">Select country</option>
            {countries
              .filter((country) =>
                form.type === "state" ? country.hasStates : true,
              )
              .map((country) => (
                <option key={country.id} value={country.slug}>
                  {country.name}
                </option>
              ))}
          </Field>
          {form.type === "city" && selectedCountry?.hasStates ? (
            <Field
              as="select"
              label="Parent state"
              required
              disabled={lockedStructure || Boolean(modal.state)}
              value={form.stateSlug}
              onChange={change("stateSlug")}
            >
              <option value="">Select state</option>
              {states.map((state) => (
                <option key={state.id} value={state.slug}>
                  {state.name}
                </option>
              ))}
            </Field>
          ) : null}
        </div>
      ) : null}

      {form.type === "country" ? (
        <>
          <label className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-3 dark:border-neutral-700">
            <span>
              <span className="block text-sm font-semibold">Uses states</span>
              <span className="block text-xs text-gray-500">
                Cities will sit beneath a state in the URL hierarchy.
              </span>
            </span>
            <Toggle
              checked={form.hasStates}
              label="Country uses states"
              onChange={(hasStates) =>
                setForm((current) => ({ ...current, hasStates }))
              }
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Language"
              required
              value={form.language}
              onChange={change("language")}
              placeholder="en-GB"
            />
            <Field
              label="Currency"
              required
              value={form.currency}
              onChange={change("currency")}
              placeholder="GBP"
            />
            <Field
              label="VAT rate (%)"
              type="number"
              min="0"
              step="0.01"
              required
              value={form.vatRate}
              onChange={change("vatRate")}
              placeholder="20"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Local payments"
              value={form.localPayments}
              onChange={change("localPayments")}
              placeholder="Card and contactless"
            />
            <Field
              label="QSR growth"
              value={form.qsrGrowth}
              onChange={change("qsrGrowth")}
              placeholder="3.8%"
            />
          </div>
        </>
      ) : null}

      {form.type === "city" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Population"
              type="number"
              min="0"
              step="1"
              required
              value={form.population}
              onChange={change("population")}
              placeholder="500000"
            />
            <Field
              label="Region"
              value={form.region}
              onChange={change("region")}
              placeholder="Lisbon District"
            />
          </div>
          <Field
            as="textarea"
            rows={4}
            label="Local context"
            value={form.context}
            onChange={change("context")}
            placeholder="Describe the local restaurant and hospitality market…"
          />
          <label className="flex items-center justify-between rounded-xl border border-gray-200 px-3 py-3 dark:border-neutral-700">
            <span className="text-sm font-semibold">Active city page</span>
            <Toggle
              checked={form.active}
              label="City active"
              onChange={(active) =>
                setForm((current) => ({ ...current, active }))
              }
            />
          </label>
        </>
      ) : null}
    </Modal>
  );
}
