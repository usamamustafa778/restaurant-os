import { useEffect, useRef } from "react";
import { MoreVertical } from "lucide-react";

export default function ActionDropdown({ 
  isOpen, 
  onToggle, 
  onClose,
  actions = [],
  disabled = false 
}) {
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, onClose]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        disabled={disabled}
        className="p-1.5 rounded-lg text-gray-600 dark:text-neutral-400 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-lg shadow-lg py-1 z-10">
          {actions.map((action, index) => (
            <button
              key={index}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
                action.onClick();
              }}
              disabled={action.disabled}
              className={`w-full flex items-center gap-2 px-4 py-2 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                action.variant === "danger"
                  ? "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
                  : "text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-800"
              }`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
