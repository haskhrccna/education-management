import dotenv from 'dotenv';
dotenv.config();

const MIN_JWT_SECRET_LENGTH = 32;

const WEAK_JWT_SECRETS = new Set([
  'change-this-to-a-256-bit-secret-minimum-32-characters',
  'super-secret-jwt-key-change-in-production-minimum-32-characters-long',
  'secret',
  'changeme',
]);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function requireJwtSecret(): string {
  const secret = requireEnv('JWT_SECRET');
  if (secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters (got ${secret.length}). ` +
        `Generate one with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
    );
  }
  if ((process.env.NODE_ENV || 'development') === 'production' && WEAK_JWT_SECRETS.has(secret)) {
    throw new Error('JWT_SECRET matches a known placeholder value. Refusing to start in production.');
  }
  return secret;
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  env: process.env.NODE_ENV || 'development',
  databaseUrl: requireEnv('DATABASE_URL'),
  jwtSecret: requireJwtSecret(),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d',
  emailHost: process.env.EMAIL_HOST,
  emailPort: parseInt(process.env.EMAIL_PORT || '587', 10),
  emailUser: process.env.EMAIL_USER || '',
  emailPass: process.env.EMAIL_PASS || '',
  emailFrom: process.env.EMAIL_FROM || 'noreply@education-app.com',
  clientUrl: process.env.CLIENT_URL,
};

// Validate CLIENT_URL in production to prevent silent CORS failures
if (config.env === 'production' && !config.clientUrl) {
  throw new Error('Missing required environment variable in production: CLIENT_URL');
}
