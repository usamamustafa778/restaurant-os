export default function Button({
  variant = "primary",
  disabled,
  className = "",
  children,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-primary/60 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-primary text-white hover:bg-secondary",
    ghost: "bg-transparent border border-gray-300 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 hover:bg-gray-100 dark:hover:bg-neutral-900",
    subtle: "bg-gray-100 dark:bg-neutral-900 text-gray-900 dark:text-neutral-100 hover:bg-gray-200 dark:hover:bg-neutral-800"
  };

  return (
    <button
      {...props}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

