import { useLoaderData, Form, redirect, useNavigation, useActionData } from "react-router";
import fs from "node:fs/promises";
import path from "node:path";
import prisma from "../db.server";
import { requireSuperadmin } from "../superadmin.server";

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
    <div className="efx-flex efx-flex-col efx-gap-lg">
      <div className="efx-flex efx-justify-between efx-items-end">
        <div>
          <h1 className="efx-heading-xl" style={{margin:0}}>Add New Section</h1>
        </div>
      </div>

      {actionData?.error && (
        <div style={{ padding: '12px', background: 'var(--efx-color-error)', color: 'white', borderRadius: '4px', maxWidth: '800px' }}>
          {actionData.error}
        </div>
      )}

      <Form method="post" encType="multipart/form-data" className="efx-glass-card efx-flex efx-flex-col efx-gap-md" style={{ maxWidth: '800px' }}>
        <div className="efx-grid-2">
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Name</label>
            <input type="text" name="name" className="efx-input" required />
          </div>
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>SKU (Unique)</label>
            <input type="text" name="sku" className="efx-input" required />
          </div>
        </div>

        <div className="efx-grid-2">
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Handle (Unique, URL friendly)</label>
            <input type="text" name="handle" className="efx-input" required />
          </div>
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Type</label>
            <select name="type" className="efx-input" required>
              <option value="SECTION">Section</option>
              <option value="PAGE">Page</option>
            </select>
          </div>
        </div>

        <div className="efx-grid-2">
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Category</label>
            <select name="category_id" className="efx-input" required>
              <option value="">Select Category</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>

        <div className="efx-grid-2">
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Price (USD)</label>
            <input type="number" step="0.01" name="price" defaultValue="0" className="efx-input" required />
          </div>
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Is Free?</label>
            <select name="is_free" className="efx-input" required>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
        </div>

        <div className="efx-grid-2">
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Is Exclusive? (Excluded from Subscription)</label>
            <select name="is_exclusive" className="efx-input" required>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
          <div className="efx-flex efx-flex-col efx-gap-sm">
            <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Is Featured?</label>
            <select name="is_featured" className="efx-input" required>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
        </div>

        <div className="efx-flex efx-flex-col efx-gap-sm">
          <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Tag (Optional)</label>
          <input type="text" name="tag" className="efx-input" placeholder="e.g. Banner, Slider" />
        </div>

        <div className="efx-flex efx-flex-col efx-gap-sm">
          <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Preview Image Upload</label>
          <input type="file" name="preview_image" accept="image/*" className="efx-input" style={{ padding: '8px', cursor: 'pointer' }} />
        </div>

        <div className="efx-flex efx-flex-col efx-gap-sm">
          <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Short Description</label>
          <input type="text" name="short_description" className="efx-input" />
        </div>

        <div className="efx-flex efx-flex-col efx-gap-sm">
          <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Full Description</label>
          <textarea name="full_description" className="efx-input" rows="3"></textarea>
        </div>

        <div className="efx-flex efx-flex-col efx-gap-sm">
          <label className="efx-text-body" style={{margin: 0, fontWeight: 500}}>Liquid Code Content</label>
          <textarea name="liquid_content" className="efx-input" rows="10" style={{ fontFamily: 'monospace' }} required></textarea>
        </div>

        <div className="efx-flex efx-justify-end efx-mt-md">
          <button type="submit" className="efx-button efx-button-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Create Section'}
          </button>
        </div>
      </Form>
    </div>
  );
}
