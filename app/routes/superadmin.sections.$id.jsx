import { useLoaderData, Form, redirect, useNavigation, useActionData } from "react-router";
import fs from "node:fs/promises";
import path from "node:path";
import prisma from "../db.server";

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
    <div className="efx-flex efx-flex-col efx-gap-lg">
      <div className="efx-flex efx-justify-between efx-items-end">
        <div>
          <h1 className="efx-heading-xl" style={{margin:0}}>Edit Section: {section.name}</h1>
        </div>
        <Form method="post" onSubmit={e => !window.confirm("Delete this section permanently?") && e.preventDefault()}>
          <input type="hidden" name="intent" value="delete" />
          <button type="submit" className="efx-button" style={{ color: 'var(--efx-color-error)', border: '1px solid var(--efx-color-error)' }}>
            Delete Section
          </button>
        </Form>
      </div>

      {actionData?.error && (
        <div style={{ padding: '12px', background: 'var(--efx-color-error)', color: 'white', borderRadius: '4px', maxWidth: '800px' }}>
          {actionData.error}
        </div>
      )}

      <Form method="post" encType="multipart/form-data" className="efx-glass-card efx-flex efx-flex-col efx-gap-md" style={{ maxWidth: '800px' }}>
        <input type="hidden" name="intent" value="update" />
        
        <div className="efx-grid-2">
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Name</label>
            <input type="text" name="name" defaultValue={section.name} className="efx-input" required />
          </div>
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>SKU (Unique)</label>
            <input type="text" name="sku" defaultValue={section.sku} className="efx-input" required />
          </div>
        </div>

        <div className="efx-grid-2">
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Handle (Unique, URL friendly)</label>
            <input type="text" name="handle" defaultValue={section.handle} className="efx-input" required />
          </div>
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Type</label>
            <select name="type" defaultValue={section.type || "SECTION"} className="efx-input" required>
              <option value="SECTION">Section</option>
              <option value="PAGE">Page</option>
            </select>
          </div>
        </div>

        <div className="efx-grid-2">
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Category</label>
            <select name="category_id" defaultValue={section.category_id || ""} className="efx-input" required>
              <option value="">Select Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="efx-grid-2">
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Price (USD)</label>
            <input type="number" step="0.01" name="price" defaultValue={section.price} className="efx-input" required />
          </div>
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Is Free?</label>
            <select name="is_free" defaultValue={section.is_free ? "true" : "false"} className="efx-input" required>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>

        <div className="efx-grid-2">
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Is Exclusive? (Excluded from Subscription)</label>
            <select name="is_exclusive" defaultValue={section.is_exclusive ? "true" : "false"} className="efx-input" required>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Is Featured?</label>
            <select name="is_featured" defaultValue={section.is_featured ? "true" : "false"} className="efx-input" required>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
        </div>

        <div className="efx-flex efx-flex-col efx-gap-sm">
          <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Tag (Optional)</label>
          <input type="text" name="tag" defaultValue={section.tag || ""} className="efx-input" placeholder="e.g. Banner, Slider" />
        </div>

        <div className="efx-flex efx-flex-col efx-gap-sm">
          <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Preview Image Upload (Leave blank to keep current)</label>
          {section.preview_image_url && (
             <div style={{ marginBottom: '8px' }}>
               <img src={section.preview_image_url} alt="Current Preview" style={{ width: '120px', borderRadius: '4px' }} />
             </div>
          )}
          <input type="file" name="preview_image" accept="image/*" className="efx-input" style={{ padding: '8px', cursor: 'pointer' }} />
        </div>

        <div className="efx-flex efx-flex-col efx-gap-sm">
          <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Short Description</label>
          <input type="text" name="short_description" defaultValue={section.short_description || ""} className="efx-input" />
        </div>

        <div className="efx-flex efx-flex-col efx-gap-sm">
          <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Full Description</label>
          <textarea name="full_description" defaultValue={section.full_description || ""} className="efx-input" rows="3"></textarea>
        </div>

        <div className="efx-flex efx-flex-col efx-gap-sm">
          <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Liquid Code Content</label>
          <textarea name="liquid_content" defaultValue={liquidContent} className="efx-input" rows="10" style={{ fontFamily: 'monospace' }} required></textarea>
        </div>

        <div className="efx-flex efx-justify-end efx-mt-md">
          <button type="submit" className="efx-button efx-button-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </Form>
    </div>
  );
}
