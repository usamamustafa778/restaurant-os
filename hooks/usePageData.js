import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { SubscriptionInactiveError } from "../lib/apiClient";

export function usePageData(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [suspended, setSuspended] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const result = await fetchFn();
        setData(result);
        setError("");
      } catch (err) {
        if (err instanceof SubscriptionInactiveError) {
          setSuspended(true);
        } else {
          const errorMsg = err.message || "Failed to load data";
          setError(errorMsg);
          toast.error(errorMsg);
        }
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refetch = async () => {
    try {
      setLoading(true);
      const result = await fetchFn();
      setData(result);
      setError("");
    } catch (err) {
      const errorMsg = err.message || "Failed to load data";
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return { data, loading, error, suspended, refetch, setData };
}
