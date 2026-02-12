import { useState } from "react";

export function useDropdown() {
  const [openDropdown, setOpenDropdown] = useState(null);

  const toggle = (id) => {
    setOpenDropdown(openDropdown === id ? null : id);
  };

  const close = () => {
    setOpenDropdown(null);
  };

  const isOpen = (id) => {
    return openDropdown === id;
  };

  return { openDropdown, toggle, close, isOpen };
}
