const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
  const username = process.env.SEED_USERNAME || 'admin';
  const password = process.env.SEED_PASSWORD || 'Admin@1234';

  const saltRounds = 12;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const user = await prisma.user.upsert({
    where: { username },
    update: { passwordHash },
    create: {
      username,
      passwordHash,
    },
  });

  console.log(`✅ Seeded user: ${user.username} (id: ${user.id})`);

  // Initialize LicenseCache if not exists
  const licenseCache = await prisma.licenseCache.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      lastVerified: new Date(),
      status: 'valid',
      gracePeriodDays: parseInt(process.env.LICENSE_GRACE_PERIOD_DAYS || '3', 10),
    },
  });

  console.log(`✅ Initialized license cache (status: ${licenseCache.status})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Seed failed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
