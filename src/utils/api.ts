export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getAdminToken(): string | null {
  try {
    return localStorage.getItem('slimi_admin_token');
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem('slimi_admin_token', token);
    } else {
      localStorage.removeItem('slimi_admin_token');
    }
  } catch {
    // Ignore storage errors in restricted contexts
  }
}

export async function apiJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers || {});
  headers.set('X-Requested-With', 'fetch');

  const token = getAdminToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Admin-Token', token);
  }

  if (init.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(url, {
    ...init,
    headers,
    credentials: 'include',
  });
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text };
  }
  if (!res.ok) {
    const errMsg = (data as { error?: string })?.error || `HTTP ${res.status}`;
    throw new ApiError(res.status, errMsg);
  }
  return data as T;
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
