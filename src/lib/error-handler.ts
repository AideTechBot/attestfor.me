import { toast } from "sonner";

export interface ErrorResponse {
  error: string;
  message: string;
  loginUrl?: string;
}

// Predefined auth error messages — only these codes are valid.
// Prevents user-injected error text in the URL.
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  missing_handle: "Handle is required. Please enter your handle and try again.",
  invalid_handle: "Invalid handle. Please check your handle and try again.",
  login_failed: "Failed to initiate login. Please try again.",
  access_denied: "User denied access to their account.",
  network_error: "Network error. Please check your connection and try again.",
  session_expired: "Authentication session expired. Please try again.",
  invalid_response: "Invalid authentication response. Please try again.",
  auth_failed: "Authentication failed. Please try again.",
};

// Handle API errors
export async function handleApiError(response: Response): Promise<never> {
  let errorData: ErrorResponse;

  try {
    errorData = await response.json();
  } catch {
    errorData = {
      error: "unknown_error",
      message: "An unexpected error occurred",
    };
  }

  showErrorToast(errorData);
  throw new Error(errorData.message);
}

// Show error toast with appropriate actions
export function showErrorToast(error: ErrorResponse) {
  const { error: code, message, loginUrl } = error;

  if (code === "authentication_required" || code === "session_expired") {
    toast.error(message, {
      action: loginUrl
        ? {
            label: "Log In",
            onClick: () => {
              window.location.href = loginUrl;
            },
          }
        : undefined,
      duration: 10000,
    });
    return;
  }

  if (code === "rate_limit_exceeded") {
    toast.error(message, { duration: 5000 });
    return;
  }

  if (code === "network_error") {
    toast.error(message, {
      action: {
        label: "Retry",
        onClick: () => {
          window.location.reload();
        },
      },
      duration: 8000,
    });
    return;
  }

  toast.error(message, { duration: 5000 });
}

// Check URL params for auth errors (from OAuth callback)
export function checkAuthErrorParams() {
  if (typeof window === "undefined") {
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const authError = params.get("auth_error");
  const authSuccess = params.get("auth_success");

  if (authError || authSuccess) {
    window.history.replaceState({}, "", window.location.pathname);
  }

  if (authSuccess === "true") {
    return;
  }

  if (authError) {
    const message = AUTH_ERROR_MESSAGES[authError];
    if (!message) {
      return;
    }
    toast.error(message, { duration: 5000 });
  }
}

// Wrap fetch with error handling
export async function fetchWithErrorHandling(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  try {
    const response = await fetch(url, {
      ...options,
      credentials: "include",
    });

    if (!response.ok) {
      await handleApiError(response);
    }

    return response;
  } catch (error: unknown) {
    if ((error as { message?: string })?.message === "Failed to fetch") {
      showErrorToast({
        error: "network_error",
        message: "Network error. Please check your connection and try again.",
      });
    }
    throw error;
  }
}
