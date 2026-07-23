import { Helmet } from "react-helmet-async";

export const NoIndex = () => (
  <Helmet>
    <meta name="robots" content="noindex, nofollow" />
    <meta name="googlebot" content="noindex, nofollow" />
  </Helmet>
);
