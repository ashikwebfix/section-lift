import prisma from "../db.server";
import AdmZip from "adm-zip";
import path from "path";
import fs from "fs/promises";

export const loader = async () => {
  const sections = await prisma.section.findMany({
    include: {
      category: true,
      versions: {
        orderBy: { published_at: "desc" },
        take: 1
      }
    }
  });

  const exportData = sections.map(sec => ({
    sku: sec.sku,
    name: sec.name,
    handle: sec.handle,
    category_slug: sec.category?.slug || null,
    short_description: sec.short_description,
    full_description: sec.full_description,
    price: sec.price,
    is_free: sec.is_free,
    is_exclusive: sec.is_exclusive,
    is_featured: sec.is_featured,
    type: sec.type,
    status: sec.status,
    preview_image_url: sec.preview_image_url,
    tag: sec.tag,
    liquid_content: sec.versions[0]?.liquid_content || ""
  }));

  const zip = new AdmZip();
  zip.addFile("data.json", Buffer.from(JSON.stringify(exportData, null, 2), "utf8"));

  for (const sec of sections) {
    if (sec.preview_image_url && sec.preview_image_url.startsWith("/uploads/")) {
      const filename = sec.preview_image_url.replace("/uploads/", "");
      const filePath = path.join(process.cwd(), "public/uploads", filename);
      try {
        const fileData = await fs.readFile(filePath);
        zip.addFile(`images/${filename}`, fileData);
      } catch (err) {
        console.error("Could not read file for export:", filePath, err);
      }
    }
  }

  const zipBuffer = zip.toBuffer();

  return new Response(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="sections_export_${Date.now()}.zip"`
    }
  });
};
