import { useState } from "react";

export function useViewMode(defaultMode = "grid") {
  const [viewMode, setViewMode] = useState(defaultMode);

  return { viewMode, setViewMode };
}
