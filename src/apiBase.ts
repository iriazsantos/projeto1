const rawApiBase = String(import.meta.env.VITE_API_BASE_URL ?? '').trim();
const configuredApiBase = rawApiBase.replace(/\/+$/, '');

function isApiPath(value: string): boolean {
  return value.startsWith('/api');
}

function isLocalOrigin(origin: string): boolean {
  if (typeof window !== 'undefined' && origin === window.location.origin) {
    return true;
  }

  try {
    const parsed = new URL(origin);
    return parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  } catch {
    return false;
  }
}

export function resolveApiUrl(pathOrUrl: string): string {
  if (!configuredApiBase || !pathOrUrl) {
    return pathOrUrl;
  }

  if (isApiPath(pathOrUrl)) {
    return `${configuredApiBase}${pathOrUrl}`;
  }

  try {
    const parsed = new URL(pathOrUrl);
    if (isLocalOrigin(parsed.origin) && parsed.pathname.startsWith('/api')) {
      return `${configuredApiBase}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }
  } catch {
    // Ignore URL parsing failure and return as-is.
  }

  return pathOrUrl;
}

let fetchPatchInstalled = false;

export function installApiFetchPatch(): void {
  if (fetchPatchInstalled || typeof window === 'undefined') {
    return;
  }
  fetchPatchInstalled = true;

  if (!configuredApiBase) {
    return;
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      return originalFetch(resolveApiUrl(input), init);
    }

    if (input instanceof URL) {
      return originalFetch(resolveApiUrl(input.toString()), init);
    }

    if (input instanceof Request) {
      const resolved = resolveApiUrl(input.url);
      if (resolved !== input.url) {
        const rewritten = new Request(resolved, input);
        return originalFetch(rewritten, init);
      }
    }

    return originalFetch(input, init);
  }) as typeof window.fetch;
}
