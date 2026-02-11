export default function Card({ title, description, children }) {
  return (
    <section className="bg-gray-50 dark:bg-neutral-950 border border-gray-300 dark:border-neutral-800 rounded-xl p-4 md:p-5">
      {(title || description) && (
        <header className="mb-4 flex items-center justify-between gap-2">
          <div>
            {title && <h2 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">{title}</h2>}
            {description && (
              <p className="text-xs text-gray-800 dark:text-neutral-400 mt-1">{description}</p>
            )}
          </div>
        </header>
      )}
      <div>{children}</div>
    </section>
  );
}

