import { stackConfig } from './config';

interface TokenResponse {
  access_token: string;
  expires_in: number;
  expires_at: number;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

const REFRESH_BUFFER_SECONDS = 60;

async function requestToken(): Promise<TokenResponse> {
  const response = await fetch(
    `${stackConfig.STACK_SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Apikey: stackConfig.STACK_SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({
        email: stackConfig.STACK_AUTH_EMAIL,
        password: stackConfig.STACK_AUTH_PASSWORD,
        gotrue_meta_security: {},
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to authenticate with Stack AI Supabase instance: ${response.status} ${response.statusText} ${text}`
    );
  }

  const json = (await response.json()) as TokenResponse;

  return json;
}

export async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  if (cachedToken && cachedToken.expiresAt - REFRESH_BUFFER_SECONDS > now) {
    return cachedToken.token;
  }

  const token = await requestToken();

  cachedToken = {
    token: token.access_token,
    expiresAt: token.expires_at,
  };

  return cachedToken.token;
}

export function resetCachedToken() {
  cachedToken = null;
}
