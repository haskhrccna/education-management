import path from 'path';
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
  emailFrom: process.env.EMAIL_FROM || 'noreply@quran-review.app',
  clientUrl: process.env.CLIENT_URL,
  // Firebase Cloud Messaging — all optional; if any is missing, FCM is disabled gracefully
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  firebaseClientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
  firebasePrivateKey: process.env.FIREBASE_PRIVATE_KEY || '',
  // Mushaf page images (604 WebPs) served statically; populated by
  // scripts/extract_mushaf_pages.py. Env-overridable for tests/deploys.
  mushafPagesDir: process.env.MUSHAF_PAGES_DIR || path.join(__dirname, '..', '..', 'mushaf-pages'),
  allowMissingMushafPages: process.env.ALLOW_MISSING_MUSHAF_PAGES === '1',
  // Bundled font for server-side SVG->PNG rendering (share-image.service.ts).
  // The Docker base image (Alpine) ships zero fonts, and resvg silently
  // drops <text> nodes rather than throwing when no font is available — so
  // this must be a font we ship, not one we hope the host has.
  shareImageFontPath:
    process.env.SHARE_IMAGE_FONT_PATH || path.join(__dirname, '..', '..', 'assets', 'fonts', 'Cairo-Variable.ttf'),
  // Absolute base URL this API is publicly reachable at — required for
  // og:image (WhatsApp/Facebook crawlers need an absolute URL, and the
  // Host header must not be trusted to build one). Optional in dev, where
  // we fall back to localhost.
  publicApiUrl: process.env.PUBLIC_API_URL,
};

// Validate CLIENT_URL in production to prevent silent CORS failures
if (config.env === 'production' && !config.clientUrl) {
  throw new Error('Missing required environment variable in production: CLIENT_URL');
}

// Validate PUBLIC_API_URL in production so og:image is never silently relative/wrong
if (config.env === 'production' && !config.publicApiUrl) {
  throw new Error('Missing required environment variable in production: PUBLIC_API_URL');
}
