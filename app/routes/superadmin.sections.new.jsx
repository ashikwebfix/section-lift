import { useLoaderData, Form, redirect, useNavigation, useActionData } from "react-router";
import fs from "node:fs/promises";
import path from "node:path";
import prisma from "../db.server";
import { requireSuperadmin } from "../superadmin.server";
import SectionForm from "../components/SectionForm";

export const loader = async () => {
  const categories = await prisma.category.findMany({ orderBy: { sort_order: "asc" } });
  return { categories };
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  
  const sku = formData.get("sku");
  const name = formData.get("name");
  let handle = formData.get("handle");
  if (handle) {
    handle = handle.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
  }
  const category_id = formData.get("category_id");
  const price = parseFloat(formData.get("price"));
  const is_free = formData.get("is_free") === "true";
  const is_exclusive = formData.get("is_exclusive") === "true";
  const is_featured = formData.get("is_featured") === "true";
  const type = formData.get("type") || "SECTION";
  const short_description = formData.get("short_description");
  const full_description = formData.get("full_description");
  const tag = formData.get("tag");
  const liquid_content = formData.get("liquid_content");
  
  const imageFile = formData.get("preview_image");
  let preview_image_url = null;
  if (imageFile && imageFile.name && imageFile.size > 0) {
    const filename = Date.now() + "-" + imageFile.name;
    const uploadDir = path.join(process.cwd(), "public/uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, filename), Buffer.from(await imageFile.arrayBuffer()));
    preview_image_url = `/uploads/${filename}`;
  }
  
  const session = await requireSuperadmin(request);
  const adminId = session.get("adminId");
  const author_id = adminId === "superadmin" ? null : adminId;
  
  let section;
  try {
    section = await prisma.section.create({
      data: {
        sku, name, handle, category_id, price, is_free, is_exclusive, is_featured, type, short_description, full_description, preview_image_url, tag, author_id,
        status: 'PUBLISHED'
      }
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return { error: `A section with this ${error.meta?.target?.join(', ') || 'SKU or Handle'} already exists.` };
    }
    return { error: "An unexpected error occurred while saving." };
  }

  if (liquid_content) {
    await prisma.sectionVersion.create({
      data: {
        section_id: section.id,
        version: "1.0.0",
        liquid_content,
        is_breaking: false,
      }
    });
  }

  return redirect("/superadmin/sections");
};

export default function NewSection() {
  const { categories } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="sl-page-container">
      <div className="sl-page-header">
        <h1 className="sl-page-title">Add New Section</h1>
        <p className="sl-page-desc">Create a new section or page and configure its details.</p>
      </div>

      <SectionForm 
        categories={categories}
        isSubmitting={isSubmitting}
        submitLabel="Create Section"
        submittingLabel="Creating..."
        error={actionData?.error}
      />
    </div>
  );
}
