import { PrismaClient } from '@prisma/client';
import { auditExtension } from './audit.middleware';

const isDev = process.env.NODE_ENV === 'development';

const basePrisma = new PrismaClient({
  log: isDev ? [{ emit: 'event', level: 'query' }, 'info', 'warn', 'error'] : ['warn', 'error'],
});

if (isDev) {
  // @ts-ignore
  basePrisma.$on('query', (e: { duration: number; query: string }) => {
    if (e.duration > 100) {
      console.warn(`[Slow Query] ${e.duration}ms: ${e.query}`);
    }
  });
}

export const prisma = basePrisma.$extends(auditExtension);
