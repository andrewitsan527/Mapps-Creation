import { PrismaClient, StockMovementType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { applyStockMovement } from "../src/server/domain/stock";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("mapps123", 10);

  const owner = await prisma.user.upsert({
    where: { email: "owner@mapps.local" },
    update: {},
    create: {
      email: "owner@mapps.local",
      name: "Mapps Owner",
      passwordHash,
      role: "OWNER",
    },
  });

  const existingLot = await prisma.lot.findUnique({
    where: { lotNumber: "LOT-DEMO-001" },
  });

  if (!existingLot) {
    const lot = await prisma.lot.create({
      data: {
        lotNumber: "LOT-DEMO-001",
        rollNumber: "R-01",
        marka: "RM-BUF",
        width: 60,
        gsm: 180,
        quantity: 1200,
        onHand: 0,
        reserved: 0,
        unit: "m",
        qualityGrade: "A",
      },
    });

    await applyStockMovement(prisma, {
      lotId: lot.id,
      type: StockMovementType.IN,
      quantity: 1200,
      referenceType: "SEED",
      referenceId: owner.id,
      notes: "Demo inward stock",
      createdById: owner.id,
    });

    await applyStockMovement(prisma, {
      lotId: lot.id,
      type: StockMovementType.RESERVE,
      quantity: 200,
      referenceType: "SEED",
      referenceId: owner.id,
      notes: "Demo reservation against enquiry",
      createdById: owner.id,
    });
  }

  console.log("Seed complete.");
  console.log("Login: owner@mapps.local / mapps123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
