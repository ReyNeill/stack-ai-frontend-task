const requiredEnv = [
  'STACK_SUPABASE_URL',
  'STACK_SUPABASE_ANON_KEY',
  'STACK_API_BASE_URL',
  'STACK_AUTH_EMAIL',
  'STACK_AUTH_PASSWORD',
] as const;

type RequiredEnvKey = (typeof requiredEnv)[number];

type Config = Record<RequiredEnvKey, string>;

const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length > 0) {
  const formatted = missing.join(', ');
  throw new Error(
    `Missing required environment variables: ${formatted}. ` +
      'Create a .env.local file based on .env.example and restart the dev server.'
  );
}

export const stackConfig: Config = {
  STACK_SUPABASE_URL: process.env.STACK_SUPABASE_URL!,
  STACK_SUPABASE_ANON_KEY: process.env.STACK_SUPABASE_ANON_KEY!,
  STACK_API_BASE_URL: process.env.STACK_API_BASE_URL!,
  STACK_AUTH_EMAIL: process.env.STACK_AUTH_EMAIL!,
  STACK_AUTH_PASSWORD: process.env.STACK_AUTH_PASSWORD!,
};
