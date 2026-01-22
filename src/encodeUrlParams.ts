export function encodeUrlParams(params: Record<string, any> = {}) {
  return Object.keys(params)
    .sort()
    .map((key) => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
}
