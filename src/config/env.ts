import { cleanEnv, str, port, num } from 'envalid';

export const env = cleanEnv(process.env, {
  // Server
  NODE_ENV: str({ choices: ['development', 'test', 'production'] }),
  PORT: port({ default: 3000 }),

  // Supabase
  SUPABASE_URL: str(),
  SUPABASE_ANON_KEY: str(),
  SUPABASE_SERVICE_ROLE_KEY: str(),
  SUPABASE_JWT_SECRET: str(),

  // API
  API_RATE_LIMIT: num({ default: 100 }),
  API_RATE_LIMIT_WINDOW: str({ default: '15m' }),

  // Email
  SMTP_HOST: str({ default: undefined }),
  SMTP_PORT: port({ default: 587 }),
  SMTP_USER: str({ default: undefined }),
  SMTP_PASSWORD: str({ default: undefined }),
  SMTP_FROM_EMAIL: str({ default: undefined }),

  // Redis
  REDIS_URL: str({ default: undefined }),

  // Webhook
  WEBHOOK_SECRET: str({ default: undefined }),
}); 