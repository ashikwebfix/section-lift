import { useLoaderData, useNavigate, Link, Form, useSubmit, useNavigation } from "react-router";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const categoryId = url.searchParams.get("category_id") || "";
  
  const limit = 40;
  const skip = (page - 1) * limit;

  const where = {};
  if (categoryId) {
    where.category_id = categoryId;
  }

  const [sections, totalCount, categories] = await Promise.all([
    prisma.section.findMany({
      where,
      include: { category: true, author: true },
      orderBy: { created_at: "desc" },
      take: limit,
      skip,
    }),
    prisma.section.count({ where }),
    prisma.category.findMany({ orderBy: { sort_order: "asc" } })
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return { sections, totalPages, page, categoryId, categories };
};

export default function SuperadminSectionsList() {
  const { sections, totalPages, page, categoryId, categories } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";

  return (
    <>
      <div className="sa-page-header sl-mb-6">
        <div>
          <h1 className="sl-page-title">Manage Sections</h1>
          <p className="sl-body sl-mt-1">Add new designs or update pricing and details.</p>
        </div>
        <div className="sl-flex sl-items-center sl-gap-3">
          <a href="/superadmin/sections/export" download className="sl-btn sl-btn-secondary">
            Export All
          </a>
          <Link to="/superadmin/sections/import" className="sl-btn sl-btn-secondary">
            Import
          </Link>
          <Link to="/superadmin/sections/new" className="sl-btn sl-btn-primary">
            + Add New Section
          </Link>
        </div>
      </div>

      <div className="sl-card sl-mb-6 sl-flex sl-items-center sl-justify-between" style={{ padding: '16px 24px' }}>
        <Form method="get" className="sl-flex sl-items-center sl-gap-4" onChange={(e) => submit(e.currentTarget)}>
          <div className="sl-field" style={{ marginBottom: 0 }}>
            <label className="sl-label-text sl-sr-only">Filter by Category</label>
            <select name="category_id" defaultValue={categoryId} className="sl-select" style={{ minWidth: 200, padding: '8px 12px' }}>
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          {isLoading && <span className="sl-text-subdued sl-text-sm">Loading...</span>}
        </Form>
        
        <div className="sl-text-sm sl-text-subdued">
          Page {page} of {totalPages || 1}
        </div>
      </div>

      <div className="sl-card" style={{ overflow: "hidden" }}>
        {sections.length === 0 ? (
          <div className="sl-empty-state">
            <p className="sl-body" style={{ fontWeight: 500 }}>No sections yet</p>
            <p className="sl-caption">We couldn't find any sections matching your criteria.</p>
            <Link to="/superadmin/sections/new" className="sl-btn sl-btn-secondary sl-mt-2">Add New Section</Link>
          </div>
        ) : (
          <div className="sl-table-wrap">
            <table className="sl-table">
              <thead>
                <tr>
                  <th style={{ width: 88 }}>Preview</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Added By</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th className="sl-text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sections.map((section) => (
                  <tr
                    key={section.id}
                    className="sl-table-row-clickable"
                    onClick={() => navigate(`/superadmin/sections/${section.id}`)}
                  >
                    <td>
                      {section.preview_image_url ? (
                        <img src={section.preview_image_url} alt={section.name} className="sa-thumb" />
                      ) : (
                        <div className="sa-thumb" />
                      )}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{section.name}</div>
                      <div className="sa-mono sl-mt-1">{section.handle}</div>
                    </td>
                    <td>
                      <span className="sl-badge sl-badge-default">{section.category?.name || "Uncategorized"}</span>
                    </td>
                    <td><span className="sl-body" style={{ fontSize: 13 }}>{section.author?.name || "Master Admin"}</span></td>
                    <td>
                      {section.is_free
                        ? <span className="sl-badge sl-badge-success">Free</span>
                        : <span style={{ fontWeight: 600 }}>${section.price}</span>}
                    </td>
                    <td>
                      <span className={`sl-badge ${section.status === "PUBLISHED" ? "sl-badge-active" : "sl-badge-inactive"}`}>
                        {section.status}
                      </span>
                    </td>
                    <td className="sl-text-right">
                      <Link
                        to={`/superadmin/sections/${section.id}`}
                        className="sl-btn sl-btn-secondary sl-btn-sm"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="sl-flex sl-items-center sl-justify-center sl-gap-2 sl-mt-6">
          <Link
            to={`?page=${Math.max(1, page - 1)}${categoryId ? `&category_id=${categoryId}` : ''}`}
            className={`sl-btn sl-btn-secondary ${page <= 1 ? 'sl-opacity-50 sl-pointer-events-none' : ''}`}
          >
            Previous
          </Link>
          <span className="sl-text-sm" style={{ padding: '0 12px' }}>Page {page} of {totalPages}</span>
          <Link
            to={`?page=${Math.min(totalPages, page + 1)}${categoryId ? `&category_id=${categoryId}` : ''}`}
            className={`sl-btn sl-btn-secondary ${page >= totalPages ? 'sl-opacity-50 sl-pointer-events-none' : ''}`}
          >
            Next
          </Link>
        </div>
      )}
    </>
  );
}
