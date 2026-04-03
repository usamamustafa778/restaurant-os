import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";

/**
 * Inline searchable combobox (same UX as voucher forms): magnifier in field,
 * type-to-search, fixed-position dropdown, orange focus ring.
 */
export default function AsyncCombobox({
  placeholder,
  fetchFn,
  value,
  valueObj,
  onChange,
  displayFn,
  keyFn,
  hasError,
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const debounce = useRef(null);

  const runSearch = useCallback(async (q) => {
    setLoading(true);
    try {
      setOptions(await fetchFn(q));
    } catch {
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  useEffect(() => {
    runSearch("");
  }, [runSearch]);

  useEffect(() => {
    if (!open) return;
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(query), 250);
    return () => clearTimeout(debounce.current);
  }, [query, open, runSearch]);

  useEffect(() => {
    function handler(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setIsFocused(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedDisplay = value && valueObj ? displayFn(valueObj) : "";
  const inputDisplayValue = isFocused ? query : selectedDisplay;
  const inputPlaceholder = isFocused && selectedDisplay ? selectedDisplay : placeholder;

  function handleFocus() {
    setIsFocused(true);
    setOpen(true);
    if (wrapRef.current) {
      const rect = wrapRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    if (options.length === 0) runSearch("");
  }

  function handleBlur() {
    setTimeout(() => {
      setIsFocused(false);
      setOpen(false);
      setQuery("");
    }, 150);
  }

  function handleSelect(opt) {
    onChange(keyFn(opt), opt);
    setQuery("");
    setOpen(false);
    setIsFocused(false);
  }

  function handleClear(e) {
    e.preventDefault();
    e.stopPropagation();
    onChange(null, null);
    setQuery("");
    inputRef.current?.focus();
  }

  const borderCls = hasError
    ? "border-red-400 dark:border-red-500 ring-1 ring-red-400/30"
    : isFocused
      ? "border-orange-400 dark:border-orange-500 ring-2 ring-orange-500/20"
      : "border-gray-200 dark:border-neutral-700 hover:border-gray-300 dark:hover:border-neutral-600";

  return (
    <div ref={wrapRef} className="relative">
      <div
        className={`flex items-center gap-1.5 bg-gray-100 dark:bg-neutral-800 border rounded-lg px-2.5 py-[7px] transition-all ${borderCls}`}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 dark:text-neutral-500 flex-shrink-0" />
        ) : (
          <svg
            className="w-3.5 h-3.5 text-gray-400 dark:text-neutral-500 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
        )}
        <input
          ref={inputRef}
          value={inputDisplayValue}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={inputPlaceholder}
          className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-neutral-500 focus:outline-none"
        />
        {value && (
          <button
            type="button"
            onMouseDown={handleClear}
            tabIndex={-1}
            className="flex-shrink-0 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {open && (
        <div
          style={{
            position: "fixed",
            top: dropPos.top,
            left: dropPos.left,
            width: Math.max(dropPos.width, 220),
            zIndex: 9999,
          }}
          className="bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden"
        >
          <div className="max-h-52 overflow-y-auto">
            {loading && options.length === 0 ? (
              <div className="px-3 py-3 text-xs text-gray-400 dark:text-neutral-500 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Searching…
              </div>
            ) : options.length === 0 ? (
              <p className="px-3 py-3 text-xs text-gray-400 dark:text-neutral-500">
                {query ? `No results for "${query}"` : "No options available"}
              </p>
            ) : (
              options.map((opt) => (
                <button
                  key={keyFn(opt)}
                  type="button"
                  onMouseDown={() => handleSelect(opt)}
                  className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                    keyFn(opt) === value
                      ? "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400"
                      : "text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-neutral-700"
                  }`}
                >
                  {displayFn(opt)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
