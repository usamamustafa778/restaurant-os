import { Loader2 } from "lucide-react";

export default function PageLoader({ message = "Loading...", icon: Icon }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center mb-4">
        {Icon ? (
          <Icon className="w-10 h-10 text-primary animate-pulse" />
        ) : (
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
        )}
      </div>
      <div className="flex items-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin text-primary" />
        <p className="text-base font-semibold text-gray-700 dark:text-neutral-300">
          {message}
        </p>
      </div>
    </div>
  );
}
