import { toast, type ExternalToast } from 'sonner';

/**
 * Toasts for things that happen out of view: a background action finished, a file downloaded,
 * something left the list, or an action failed. If the result is already visible on screen, or a
 * whole panel failed to load (show an inline error with a retry instead), don't toast.
 *
 * Successes clear quickly; warnings and errors stay long enough to read and can be dismissed.
 */
export const notify = {
  success: (message: string, options?: ExternalToast) => toast.success(message, { duration: 3000, ...options }),
  warning: (message: string, options?: ExternalToast) =>
    toast.warning(message, { duration: 6000, closeButton: true, ...options }),
  error: (message: string, options?: ExternalToast) =>
    toast.error(message, { duration: 6000, closeButton: true, ...options }),
};

/** The backend's error message from a failed response, or `fallback` when it doesn't send one. */
export async function responseError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data?.error?.message || fallback;
  } catch {
    return fallback;
  }
}
