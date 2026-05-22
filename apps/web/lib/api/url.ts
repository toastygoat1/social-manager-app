export function buildApiUrl(baseUrl: string, path: string) {
  if (path.startsWith("http")) return path;

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  return `${normalizedBaseUrl}${normalizedPath}`;
}
