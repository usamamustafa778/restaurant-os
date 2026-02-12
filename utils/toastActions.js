import toast from "react-hot-toast";

export async function handleAsyncAction(asyncFn, messages = {}) {
  const {
    loading = "Processing...",
    success = "Success!",
    error = "Failed to complete action"
  } = messages;

  const toastId = toast.loading(loading);

  try {
    const result = await asyncFn();
    toast.success(success, { id: toastId });
    return { success: true, data: result };
  } catch (err) {
    const errorMsg = err.message || error;
    toast.error(errorMsg, { id: toastId });
    return { success: false, error: errorMsg };
  }
}
