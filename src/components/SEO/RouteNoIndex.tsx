import { Helmet } from "react-helmet-async";
import { useLocation } from "react-router-dom";

// Path prefixes that should never be indexed by search engines.
// Mirrors public/robots.txt — this is page-level defense in depth.
const PRIVATE_PATH_PREFIXES = [
  "/dashboard",
  "/student-dashboard",
  "/admin",
  "/instructor",
  "/checker",
  "/learning",
  "/auth",
  "/forgot-password",
  "/profile",
  "/my-courses",
  "/my-rewards",
  "/cart",
  "/checkout",
  "/payment-success",
  "/payment-failed",
  "/payment-callback",
  "/ai-tutorial",
  "/language-topup",
  "/doubt",
  "/recordings",
  "/v3-player",
  "/watch",
  "/live",
  "/timetable",
  "/enroll",
  "/forum/group",
  "/implementation",
];

const isPrivatePath = (pathname: string) =>
  PRIVATE_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

export const RouteNoIndex = () => {
  const { pathname } = useLocation();
  if (!isPrivatePath(pathname)) return null;
  return (
    <Helmet>
      <meta name="robots" content="noindex, nofollow" />
      <meta name="googlebot" content="noindex, nofollow" />
    </Helmet>
  );
};
