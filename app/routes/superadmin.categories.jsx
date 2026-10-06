import { useLoaderData, Form, useNavigation, useActionData } from "react-router";
import prisma from "../db.server";

export const loader = async () => {
  const categories = await prisma.category.findMany({
    orderBy: { sort_order: "asc" },
    include: {
      _count: { select: { sections: true } }
    }
  });
  return { categories };
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = formData.get("name")?.trim();
    if (!name) return { error: "Name is required." };

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    const sortOrder = parseInt(formData.get("sort_order") || "0");

    const existing = await prisma.category.findUnique({ where: { slug } });
    if (existing) return { error: `A category with slug "${slug}" already exists.` };

    await prisma.category.create({
      data: { name, slug, sort_order: sortOrder }
    });
    return { success: true, message: "Category created." };
  }

  if (intent === "delete") {
    const id = formData.get("id");
    const sectionsCount = await prisma.section.count({ where: { category_id: id } });
    if (sectionsCount > 0) {
      return { error: `Cannot delete: ${sectionsCount} section(s) are using this category.` };
    }
    await prisma.category.delete({ where: { id } });
    return { success: true, message: "Category deleted." };
  }

  if (intent === "update") {
    const id = formData.get("id");
    const name = formData.get("name")?.trim();
    const sortOrder = parseInt(formData.get("sort_order") || "0");
    if (!name) return { error: "Name is required." };

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');

    try {
      await prisma.category.update({
        where: { id },
        data: { name, slug, sort_order: sortOrder }
      });
    } catch (err) {
      if (err.code === 'P2002') return { error: `Slug "${slug}" already exists.` };
      return { error: "Failed to update." };
    }
    return { success: true, message: "Category updated." };
  }

  return {};
};

export default function CategoriesPage() {
  const { categories } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="sl-page-container">
      <div className="sl-page-header">
        <h1 className="sl-page-title">Categories</h1>
        <p className="sl-page-desc">Manage categories for sections.</p>
      </div>

      {actionData?.error && (
        <div className="sl-alert sl-alert-error sl-mb-6" role="alert">{actionData.error}</div>
      )}
      {actionData?.success && (
        <div className="sl-alert sl-alert-success sl-mb-6" role="alert">{actionData.message}</div>
      )}

      {/* Add New Category */}
      <Form method="post" className="sl-card sl-p-6 sl-flex sl-items-end sl-gap-4 sl-mb-6">
        <input type="hidden" name="intent" value="create" />
        <div className="sl-field" style={{ flex: 1, marginBottom: 0 }}>
          <label className="sl-label-text">Category Name</label>
          <input type="text" name="name" className="sl-input" placeholder="e.g. Hero Banners" required />
        </div>
        <div className="sl-field" style={{ width: '120px', marginBottom: 0 }}>
          <label className="sl-label-text">Sort Order</label>
          <input type="number" name="sort_order" className="sl-input" defaultValue="0" />
        </div>
        <button type="submit" className="sl-btn sl-btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Adding...' : 'Add Category'}
        </button>
      </Form>

      {/* Categories List */}
      <div className="sl-card" style={{ padding: 0 }}>
        {categories.length === 0 ? (
          <div className="sl-p-8 sl-text-center sl-text-subdued">
            No categories yet. Add one above.
          </div>
        ) : (
          <div className="sl-table-wrapper">
            <table className="sl-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Slug</th>
                  <th>Order</th>
                  <th>Sections</th>
                  <th className="sl-text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((cat) => (
                  <tr key={cat.id}>
                    <td><strong>{cat.name}</strong></td>
                    <td className="sl-text-subdued"><span className="sl-code" style={{fontFamily: 'monospace', fontSize: '0.85rem'}}>{cat.slug}</span></td>
                    <td className="sl-text-subdued">{cat.sort_order}</td>
                    <td className="sl-text-subdued">{cat._count.sections}</td>
                    <td className="sl-text-right">
                      <Form method="post" style={{ display: 'inline' }}>
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={cat.id} />
                        <button
                          type="submit"
                          className="sl-btn sl-btn-secondary sl-btn-sm"
                          style={{ color: 'var(--sl-color-error)', borderColor: 'var(--sl-color-error-muted)' }}
                          onClick={(e) => { if (!window.confirm(`Delete "${cat.name}"?`)) e.preventDefault(); }}
                          disabled={isSubmitting}
                        >
                          Delete
                        </button>
                      </Form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
