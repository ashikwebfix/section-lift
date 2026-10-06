const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const tests = await prisma.aBTest.findMany();
  console.log(JSON.stringify(tests, null, 2));
}
main().finally(() => prisma.$disconnect());
