import { PrismaClient } from '@prisma/client';
import { configs } from './configs.js';

import { startBotV2 } from './modules/bot.js';

const prisma = new PrismaClient();

async function main() {
  try {
    configs.init();
    startBotV2();
  } catch (e) {
    console.error('Error on main level: ', e);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
