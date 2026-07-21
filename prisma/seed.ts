import { PrismaClient, PartyType, StockMovementType } from "@prisma/client";
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

  const cotton = await prisma.fabricType.upsert({
    where: { name: "Cotton RFD" },
    update: {},
    create: { name: "Cotton RFD", code: "COT-RFD", defaultUnit: "m" },
  });

  await prisma.fabricType.upsert({
    where: { name: "PC Blend" },
    update: {},
    create: { name: "PC Blend", code: "PC", defaultUnit: "m" },
  });

  const black = await prisma.colorFamily.upsert({
    where: { name: "Black" },
    update: {},
    create: { name: "Black", sortOrder: 1 },
  });

  const navy = await prisma.colorFamily.upsert({
    where: { name: "Navy" },
    update: {},
    create: { name: "Navy", sortOrder: 2 },
  });

  const jetBlack = await prisma.shade.upsert({
    where: { colorFamilyId_code: { colorFamilyId: black.id, code: "BLK-01" } },
    update: {},
    create: {
      colorFamilyId: black.id,
      code: "BLK-01",
      name: "Jet Black",
      hex: "#0d0d0d",
    },
  });

  await prisma.shade.upsert({
    where: { colorFamilyId_code: { colorFamilyId: black.id, code: "BLK-02" } },
    update: {},
    create: {
      colorFamilyId: black.id,
      code: "BLK-02",
      name: "Soft Black",
      hex: "#2a2a2a",
    },
  });

  await prisma.shade.upsert({
    where: { colorFamilyId_code: { colorFamilyId: navy.id, code: "NVY-01" } },
    update: {},
    create: {
      colorFamilyId: navy.id,
      code: "NVY-01",
      name: "Deep Navy",
      hex: "#0b1c3a",
    },
  });

  await prisma.finishType.upsert({
    where: { name: "Soft finish" },
    update: {},
    create: { name: "Soft finish" },
  });

  const godown = await prisma.godown.upsert({
    where: { name: "Main Godown" },
    update: {},
    create: { name: "Main Godown", code: "G1" },
  });

  const parties: { name: string; type: PartyType; whatsapp?: string }[] = [
    { name: "Sunrise Textiles", type: "CLIENT", whatsapp: "919800000001" },
    { name: "Rajkot Process Mill", type: "MILL", whatsapp: "919800000002" },
    { name: "Patel Weaver", type: "WEAVER" },
    { name: "Grey Mart Suppliers", type: "GREY_SUPPLIER" },
    { name: "Agency Mehta", type: "AGENT" },
  ];

  for (const p of parties) {
    const existing = await prisma.party.findFirst({
      where: { name: p.name, type: p.type },
    });
    if (!existing) {
      await prisma.party.create({
        data: {
          name: p.name,
          type: p.type,
          whatsapp: p.whatsapp,
          paymentTermsDays: p.type === "CLIENT" ? 21 : 30,
        },
      });
    }
  }

  const existingLot = await prisma.lot.findUnique({
    where: { lotNumber: "LOT-DEMO-001" },
  });

  if (!existingLot) {
    const lot = await prisma.lot.create({
      data: {
        lotNumber: "LOT-DEMO-001",
        rollNumber: "R-01",
        marka: "RM-BUF",
        fabricTypeId: cotton.id,
        shadeId: jetBlack.id,
        godownId: godown.id,
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
