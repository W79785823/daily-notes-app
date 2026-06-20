const { PrismaClient } = require('@prisma/client');
const { randomBytes, scryptSync } = require('crypto');

const prisma = new PrismaClient();
const KEY_LENGTH = 64;

function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

async function main() {
  const loginName = process.env.SUPER_ADMIN_LOGIN;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!loginName || !password) {
    throw new Error('SUPER_ADMIN_LOGIN and SUPER_ADMIN_PASSWORD are required');
  }

  const existing = await prisma.user.findUnique({ where: { loginName } });
  const passwordHash = hashPassword(password);
  const data = {
    name: loginName,
    loginName,
    passwordHash,
    role: 'ADMIN',
    permissions: [],
    active: true,
    isSuperAdmin: true,
    teamId: null,
    sessionVersion: { increment: 1 },
  };

  const user = existing
    ? await prisma.user.update({ where: { loginName }, data })
    : await prisma.user.create({
        data: {
          ...data,
          sessionVersion: 0,
        },
      });

  console.log(`Super admin ready: ${user.loginName}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
