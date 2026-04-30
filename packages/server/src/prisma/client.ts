import { PrismaClient } from '@prisma/client';

const isDev = process.env.NODE_ENV === 'development';

export const prisma = new PrismaClient({
  log: isDev
    ? [{ emit: 'event', level: 'query' }, 'info', 'warn', 'error']
    : ['warn', 'error'],
});

if (isDev) {
  // @ts-ignore
  prisma.$on('query', (e: any) => {
    if (e.duration > 100) {
      console.warn(`[Slow Query] ${e.duration}ms: ${e.query}`);
    }
  });
}
