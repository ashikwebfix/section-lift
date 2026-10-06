import { Form, useActionData, useNavigation, Link } from "react-router";
import prisma from "../db.server";
import AdmZip from "adm-zip";
import fs from "fs/promises";
import path from "path";
import { requireSuperadmin } from "../superadmin.server";

export const action = async ({ request }) => {
  const formData = await request.formData();
  const file = formData.get("import_file");

  if (!file || !file.name || file.size === 0) {
    return { error: "Please upload a valid zip file." };
  }

  try {
    const session = await requireSuperadmin(request);
    const adminId = session.get("adminId");
    const author_id = adminId === "superadmin" ? null : adminId;

    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(buffer);
    const zipEntries = zip.getEntries();

    const dataEntry = zipEntries.find(e => e.entryName === "data.json");
    if (!dataEntry) {
      return { error: "data.json not found in the zip file." };
    }

    const dataRaw = zip.readAsText(dataEntry);
    const sections = JSON.parse(dataRaw);

    const uploadDir = path.join(process.cwd(), "public/uploads");
    await fs.mkdir(uploadDir, { recursive: true });

    let importedCount = 0;

    for (const sec of sections) {
      // Find or create category
      let category_id = null;
      if (sec.category_slug) {
        let cat = await prisma.category.findUnique({ where: { slug: sec.category_slug } });
        if (!cat) {
          cat = await prisma.category.create({
            data: {
              name: sec.category_slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
              slug: sec.category_slug,
              sort_order: 0
            }
          });
        }
        category_id = cat.id;
      }

      // Handle unique constraints by appending a random string
      const uniqueSuffix = "-" + Math.random().toString(36).substring(2, 7);
      const newSku = sec.sku + uniqueSuffix;
      const newHandle = sec.handle + uniqueSuffix;

      // Handle image
      let new_preview_image_url = null;
      if (sec.preview_image_url && sec.preview_image_url.startsWith("/uploads/")) {
        const oldFilename = sec.preview_image_url.replace("/uploads/", "");
        const imageEntry = zipEntries.find(e => e.entryName === `images/${oldFilename}`);
        
        if (imageEntry) {
          const imageBuffer = zip.readFile(imageEntry);
          const newFilename = Date.now() + "-" + oldFilename;
          await fs.writeFile(path.join(uploadDir, newFilename), imageBuffer);
          new_preview_image_url = `/uploads/${newFilename}`;
        }
      }

      const newSection = await prisma.section.create({
        data: {
          sku: newSku,
          name: sec.name + " (Imported)",
          handle: newHandle,
          category_id,
          short_description: sec.short_description,
          full_description: sec.full_description,
          price: sec.price,
          is_free: sec.is_free,
          is_exclusive: sec.is_exclusive,
          is_featured: sec.is_featured,
          type: sec.type,
          status: "DRAFT", // Import as draft to be safe
          preview_image_url: new_preview_image_url,
          tag: sec.tag,
          author_id
        }
      });

      if (sec.liquid_content) {
        await prisma.sectionVersion.create({
          data: {
            section_id: newSection.id,
            version: "1.0.0",
            liquid_content: sec.liquid_content,
            is_breaking: false,
          }
        });
      }

      importedCount++;
    }

    return { success: true, message: `Successfully imported ${importedCount} sections.` };
  } catch (error) {
    console.error("Import error:", error);
    return { error: "Failed to process the import file. Ensure it is a valid zip with data.json." };
  }
};

export default function ImportSections() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="sl-page-container">
      <div className="sl-page-header sl-flex sl-items-center sl-gap-4">
        <Link to="/superadmin/sections" className="sl-btn sl-btn-secondary">
          ← Back
        </Link>
        <h1 className="sl-page-title" style={{marginBottom: 0}}>Import Sections</h1>
      </div>

      <div className="sl-card" style={{ maxWidth: 600, padding: '24px' }}>
        {actionData?.error && (
          <div className="sl-alert sl-alert-error sl-mb-4" role="alert">{actionData.error}</div>
        )}
        {actionData?.success && (
          <div className="sl-alert sl-alert-success sl-mb-4" role="alert">{actionData.message}</div>
        )}

        <Form method="post" encType="multipart/form-data" className="sa-form-section" style={{ padding: 0 }}>
          <div className="sl-field">
            <label className="sl-label-text">Zip File</label>
            <input type="file" name="import_file" accept=".zip" className="sl-input sa-file-input" required />
            <span className="sa-hint sl-mt-2 sl-block">Upload the .zip file generated from the Export tool. New sections will be added as Drafts.</span>
          </div>

          <div className="sl-mt-6">
            <button type="submit" className="sl-btn sl-btn-primary" disabled={isSubmitting}>
              {isSubmitting ? "Importing..." : "Import Sections"}
            </button>
          </div>
        </Form>
      </div>
    </div>
  );
}
