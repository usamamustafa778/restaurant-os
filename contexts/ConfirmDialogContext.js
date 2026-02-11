import { createContext, useCallback, useContext, useState } from "react";

const ConfirmDialogContext = createContext(null);

export function ConfirmDialogProvider({ children }) {
  const [state, setState] = useState({
    open: false,
    title: "",
    message: "",
    confirmLabel: "Confirm",
    cancelLabel: "Cancel",
    resolve: null
  });

  const confirm = useCallback(({ title, message, confirmLabel = "Confirm", cancelLabel = "Cancel" }) => {
    return new Promise(resolve => {
      setState({
        open: true,
        title,
        message,
        confirmLabel,
        cancelLabel,
        resolve
      });
    });
  }, []);

  const handleClose = result => {
    if (state.resolve) {
      state.resolve(result);
    }
    setState(prev => ({
      ...prev,
      open: false,
      resolve: null
    }));
  };

  return (
    <ConfirmDialogContext.Provider value={{ confirm }}>
      {children}
      {state.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950 p-5 shadow-xl">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              {state.title || "Are you sure?"}
            </h2>
            <p className="text-xs text-gray-500 dark:text-neutral-400 mb-5">
              {state.message || "This action cannot be undone."}
            </p>
            <div className="flex justify-end gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleClose(false)}
                className="inline-flex items-center justify-center rounded-lg border border-gray-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-2 text-gray-700 dark:text-neutral-200 hover:bg-gray-50 dark:hover:bg-neutral-800 font-medium transition-colors"
              >
                {state.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => handleClose(true)}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-primary/90 transition-colors"
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const ctx = useContext(ConfirmDialogContext);
  if (!ctx) {
    throw new Error("useConfirmDialog must be used within a ConfirmDialogProvider");
  }
  return ctx;
}

