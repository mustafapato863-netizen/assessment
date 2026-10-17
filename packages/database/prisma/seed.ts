import { PrismaClient } from '../generated/client/index.js';
import { seedDatabase } from './seed.mjs';

// Prisma's configured TypeScript seed command delegates to the same richer
// seed implementation used by local scripts and CI.
const prisma = new PrismaClient();

seedDatabase(prisma)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
