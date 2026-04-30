import { prisma } from '../prisma/client';

export async function withTransaction<T>(fn: (tx: typeof prisma) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => fn(tx as typeof prisma));
}
