import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const pin = '1234'; // Domyślny PIN do pierwszego logowania

  const existingUser = await prisma.user.findUnique({ where: { pin } });

  if (!existingUser) {
    const user = await prisma.user.create({
      data: {
        pin: pin,
        dailyLimit: 1000, // 1000 pakietów wariantów na czas testów
      },
    });
    console.log(`Utworzono domyślnego użytkownika z kodem PIN: ${user.pin}`);
  } else {
    console.log(`Użytkownik z kodem PIN ${pin} już istnieje.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });