import { z } from 'zod';

const placeholderPattern = /^(TU_|YOUR_|<|\$\{)/i;

const firebaseValue = z.string()
  .trim()
  .min(1)
  .refine((value) => !placeholderPattern.test(value), 'placeholder values are not allowed');

const frontendEnvSchema = z.object({
  VITE_FIREBASE_API_KEY: firebaseValue.optional(),
  VITE_FIREBASE_AUTH_DOMAIN: firebaseValue.optional(),
  VITE_FIREBASE_PROJECT_ID: firebaseValue.optional(),
  VITE_FIREBASE_STORAGE_BUCKET: firebaseValue.optional(),
  VITE_FIREBASE_MESSAGING_SENDER_ID: firebaseValue.optional(),
  VITE_FIREBASE_APP_ID: firebaseValue.optional(),
  VITE_APP_VERSION: z.string().trim().optional(),
  VITE_BUILD_ID: z.string().trim().optional(),
  VITE_GIT_SHA: z.string().trim().optional(),
  VITE_DEPLOY_ENV: z.enum(['development', 'staging', 'production', 'test']).optional(),
}).passthrough();

export function validateFrontendEnv(env = import.meta.env) {
  const result = frontendEnvSchema.safeParse(env || {});
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    throw new Error(`Variables de entorno frontend inválidas: ${details}`);
  }
  return result.data;
}

export { frontendEnvSchema };
