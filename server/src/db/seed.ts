import { prisma } from '../db/prisma';
import { config } from '../config';
import { hashPassword } from '../utils/hash';
import { logger } from '../utils/logger';

async function main(): Promise<void> {
  const email = config.seed.adminEmail.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    logger.info({ email }, 'admin already exists; seeding skipped');
    return;
  }
  const passwordHash = await hashPassword(config.seed.adminPassword);
  await prisma.user.create({ data: { email, passwordHash, role: 'admin', name: 'Admin' } });
  logger.info({ email }, 'seeded admin user');
}

main()
  .catch((err) => { logger.error({ err }, 'seed failed'); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
