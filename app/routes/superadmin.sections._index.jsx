import { useLoaderData, useNavigate, Link } from "react-router";
import prisma from "../db.server";

export const loader = async () => {
  const sections = await prisma.section.findMany({
    include: { category: true, author: true },
    orderBy: { created_at: "desc" }
  });
  return { sections };
};

export default function SuperadminSectionsList() {
  const { sections } = useLoaderData();
  const navigate = useNavigate();

  return (
    <>
      <div className="sa-page-header">
        <div>
          <h1 className="sl-page-title">Manage Sections</h1>
          <p className="sl-body sl-mt-1">Add new designs or update pricing and details.</p>
        </div>
        <Link to="/superadmin/sections/new" className="sl-btn sl-btn-primary">
          + Add New Section
        </Link>
      </div>

      <div className="sl-card" style={{ overflow: "hidden" }}>
        {sections.length === 0 ? (
          <div className="sl-empty-state">
            <p className="sl-body" style={{ fontWeight: 500 }}>No sections yet</p>
            <p className="sl-caption">Create your first section to publish it to merchants.</p>
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
    </>
  );
}
