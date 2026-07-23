import type { NavigateFunction } from "react-router-dom";

/**
 * Navigates to the public home page even when the user is authenticated.
 * Index.tsx auto-redirects logged-in/enrolled users to /dashboard unless
 * this session flag is present.
 */
export const goHome = (navigate: NavigateFunction) => {
  try {
    sessionStorage.setItem("slStayHome", "1");
  } catch {
    // ignore storage failures
  }
  navigate("/");
};
