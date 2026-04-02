export const getAppBaseUrl = () => {
  const envSiteUrl = (import.meta.env.VITE_SITE_URL as string | undefined)?.trim();
  const isLocalDevHost =
    window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";

  if (isLocalDevHost) return window.location.origin;
  if (!envSiteUrl) return window.location.origin;
  return envSiteUrl.replace(/\/+$/, "");
};
