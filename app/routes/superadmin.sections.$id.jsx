import { useLoaderData, Form, redirect, useNavigation, useActionData } from "react-router";
import fs from "node:fs/promises";
import path from "node:path";
import prisma from "../db.server";
import SectionForm from "../components/SectionForm";

export const loader = async ({ params }) => {
  const categories = await prisma.category.findMany({ orderBy: { sort_order: "asc" } });
  const section = await prisma.section.findUnique({
    where: { id: params.id },
    include: {
      versions: {
        orderBy: { published_at: "desc" },
        take: 1
      }
    }
  });

  if (!section) {
    throw new Response("Not Found", { status: 404 });
  }

  return { categories, section };
};

export const action = async ({ request, params }) => {
  const formData = await request.formData();
  
  if (formData.get("intent") === "delete") {
    // Delete versions and entitlements first due to foreign key constraints
    await prisma.sectionVersion.deleteMany({ where: { section_id: params.id } });
    await prisma.entitlement.deleteMany({ where: { section_id: params.id } });
    await prisma.installation.deleteMany({ where: { section_id: params.id } });
    
    await prisma.section.delete({ where: { id: params.id } });
    return redirect("/superadmin/sections");
  }

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
  const updateData = { sku, name, handle, category_id, price, is_free, is_exclusive, is_featured, type, short_description, full_description, tag };
  if (imageFile && imageFile.name && imageFile.size > 0) {
    const filename = Date.now() + "-" + imageFile.name;
    const uploadDir = path.join(process.cwd(), "public/uploads");
    await fs.mkdir(uploadDir, { recursive: true });
    await fs.writeFile(path.join(uploadDir, filename), Buffer.from(await imageFile.arrayBuffer()));
    updateData.preview_image_url = `/uploads/${filename}`;
  }
  
  try {
    await prisma.section.update({
      where: { id: params.id },
      data: updateData
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return { error: `A section with this ${error.meta?.target?.join(', ') || 'SKU or Handle'} already exists.` };
    }
    return { error: "An unexpected error occurred while saving." };
  }

  if (liquid_content) {
    const existingVersions = await prisma.sectionVersion.findMany({
      where: { section_id: params.id },
      orderBy: { published_at: "desc" },
      take: 1
    });
    
    if (existingVersions.length === 0) {
      await prisma.sectionVersion.create({
        data: { section_id: params.id, version: "1.0.0", liquid_content, is_breaking: false }
      });
    } else if (existingVersions[0].liquid_content !== liquid_content) {
      // Just update the latest version for simplicity in MVP instead of version bumping
      await prisma.sectionVersion.update({
        where: { id: existingVersions[0].id },
        data: { liquid_content }
      });
    }
  }

  return redirect("/superadmin/sections");
};

export default function EditSection() {
  const { categories, section } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const liquidContent = section.versions?.[0]?.liquid_content || "";

  return (
    <div className="sl-page-container">
      <div className="sl-page-header sl-flex sl-justify-between sl-items-center">
        <div>
          <h1 className="sl-page-title">Edit Section: {section.name}</h1>
          <p className="sl-page-desc">Modify the details and liquid code of this section.</p>
        </div>
        <Form method="post" onSubmit={e => !window.confirm("Delete this section permanently?") && e.preventDefault()}>
          <input type="hidden" name="intent" value="delete" />
          <button type="submit" className="sl-btn sl-btn-secondary" style={{ color: 'var(--sl-color-error)', borderColor: 'var(--sl-color-error-muted)' }}>
            Delete Section
          </button>
        </Form>
      </div>

      <SectionForm 
        categories={categories}
        section={section}
        liquidContent={liquidContent}
        isSubmitting={isSubmitting}
        submitLabel="Save Changes"
        submittingLabel="Saving..."
        error={actionData?.error}
      />
    </div>
  );
}
