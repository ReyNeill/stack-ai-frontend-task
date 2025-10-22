import { stackConfig } from './config';
import { getAccessToken, resetCachedToken } from './auth';

export class StackApiError extends Error {
  constructor(message: string, readonly status: number, readonly body?: unknown) {
    super(message);
    this.name = 'StackApiError';
  }
}

async function stackFetch(input: string, init?: RequestInit, retry = true): Promise<Response> {
  const token = await getAccessToken();

  const response = await fetch(`${stackConfig.STACK_API_BASE_URL}${input}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 401 && retry) {
    resetCachedToken();
    return stackFetch(input, init, false);
  }

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }

    throw new StackApiError(
      `Stack API request failed: ${response.status} ${response.statusText}`,
      response.status,
      body
    );
  }

  return response;
}

export async function stackGet<T>(input: string): Promise<T> {
  const response = await stackFetch(input, { method: 'GET' });
  return (await response.json()) as T;
}

export async function stackPost<T>(input: string, body?: unknown, init?: RequestInit): Promise<T> {
  const response = await stackFetch(
    input,
    {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      ...init,
    }
  );

  if (response.headers.get('content-type')?.includes('application/json')) {
    return (await response.json()) as T;
  }

  return undefined as T;
}

export async function stackPut<T>(input: string, body: unknown): Promise<T> {
  const response = await stackFetch(input, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

  if (response.headers.get('content-type')?.includes('application/json')) {
    return (await response.json()) as T;
  }

  return undefined as T;
}

export async function stackDelete<T>(input: string): Promise<T> {
  const response = await stackFetch(input, {
    method: 'DELETE',
  });

  if (response.headers.get('content-type')?.includes('application/json')) {
    return (await response.json()) as T;
  }

  return undefined as T;
}
