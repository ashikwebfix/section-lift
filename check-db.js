const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const tests = await prisma.aBTest.findMany();
  console.log(tests);
}

main().finally(() => prisma.$disconnect());
