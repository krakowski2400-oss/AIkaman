import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pin = '1234'; // Domyślny PIN do pierwszego logowania

  const user = await prisma.user.upsert({
    where: { pin },
    update: {
      dailyLimit: 100, // Wymuszamy 100 pakietów wariantów na czas testów
    },
    create: {
      pin: pin,
      dailyLimit: 100,
    },
  });
  
  console.log(`Zaktualizowano/utworzono użytkownika z kodem PIN: ${user.pin} (Limit: ${user.dailyLimit})`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });