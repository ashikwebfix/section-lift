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
    <div className="efx-flex efx-flex-col efx-gap-md">
      <h1 className="efx-heading-xl" style={{ margin: 0 }}>Categories</h1>

      {actionData?.error && (
        <div style={{ padding: '10px 16px', background: '#fef2f2', color: '#dc2626', borderRadius: 'var(--efx-radius-sm)', border: '1px solid #fecaca', fontSize: '0.9rem' }}>
          {actionData.error}
        </div>
      )}
      {actionData?.success && (
        <div style={{ padding: '10px 16px', background: '#f0fdf4', color: '#16a34a', borderRadius: 'var(--efx-radius-sm)', border: '1px solid #bbf7d0', fontSize: '0.9rem' }}>
          {actionData.message}
        </div>
      )}

      {/* Add New Category */}
      <Form method="post" className="efx-solid-card efx-flex efx-items-end efx-gap-sm" style={{ padding: '16px' }}>
        <input type="hidden" name="intent" value="create" />
        <div className="efx-flex efx-flex-col efx-gap-xs" style={{ flex: 1 }}>
          <label className="efx-text-subdued" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Category Name</label>
          <input type="text" name="name" className="efx-input" placeholder="e.g. Hero Banners" required style={{ padding: '10px 12px' }} />
        </div>
        <div className="efx-flex efx-flex-col efx-gap-xs" style={{ width: '100px' }}>
          <label className="efx-text-subdued" style={{ fontSize: '0.8rem', fontWeight: 600 }}>Sort Order</label>
          <input type="number" name="sort_order" className="efx-input" defaultValue="0" style={{ padding: '10px 12px' }} />
        </div>
        <button type="submit" className="efx-button efx-button-primary" disabled={isSubmitting} style={{ padding: '10px 20px' }}>
          {isSubmitting ? 'Adding...' : 'Add Category'}
        </button>
      </Form>

      {/* Categories List */}
      <div className="efx-solid-card" style={{ padding: 0, overflow: 'hidden' }}>
        {categories.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center' }}>
            <p className="efx-text-subdued">No categories yet. Add one above.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--efx-border-solid)' }}>
                <th className="efx-text-subdued" style={{ padding: '12px 16px', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</th>
                <th className="efx-text-subdued" style={{ padding: '12px 16px', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Slug</th>
                <th className="efx-text-subdued" style={{ padding: '12px 16px', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '80px' }}>Order</th>
                <th className="efx-text-subdued" style={{ padding: '12px 16px', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '80px' }}>Sections</th>
                <th className="efx-text-subdued" style={{ padding: '12px 16px', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em', width: '140px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr key={cat.id} style={{ borderBottom: '1px solid var(--efx-border-solid)' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{cat.name}</span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span className="efx-text-subdued" style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}>{cat.slug}</span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span className="efx-text-subdued">{cat.sort_order}</span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span className="efx-text-subdued">{cat._count.sections}</span>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <div className="efx-flex efx-gap-xs">
                      <Form method="post" style={{ display: 'inline' }}>
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="id" value={cat.id} />
                        <button
                          type="submit"
                          className="efx-button"
                          style={{ padding: '4px 10px', fontSize: '0.8rem', color: '#ef4444', background: 'transparent', border: '1px solid #fecaca' }}
                          onClick={(e) => { if (!window.confirm(`Delete "${cat.name}"?`)) e.preventDefault(); }}
                          disabled={isSubmitting}
                        >
                          Delete
                        </button>
                      </Form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
