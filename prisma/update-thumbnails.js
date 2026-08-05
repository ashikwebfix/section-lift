import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const updates = [
    { handle: 'cro-cta-001', preview_image_url: '/uploads/cro_cta.png' },
    { handle: 'cro-faq-accordion-01', preview_image_url: '/uploads/cro_faq.png' },
    { handle: 'cro-compare-table-01', preview_image_url: '/uploads/cro_compare.png' },
    { handle: 'cro-trust-badges-01', preview_image_url: '/uploads/cro_trust.png' },
    { handle: 'cro-urgency-banner-01', preview_image_url: '/uploads/cro_urgency.png' },
  ];

  for (const update of updates) {
    await prisma.section.update({
      where: { handle: update.handle },
      data: { preview_image_url: update.preview_image_url }
    });
    console.log(`Updated thumbnail for ${update.handle}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
