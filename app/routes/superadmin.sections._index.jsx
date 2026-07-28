import { useLoaderData, Link } from "react-router";
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

  return (
    <div className="efx-flex efx-flex-col efx-gap-lg">
      <div className="efx-flex efx-justify-between efx-items-end">
        <div>
          <h1 className="efx-heading-xl" style={{margin:0}}>Manage Sections</h1>
          <p className="efx-text-subdued" style={{margin:0}}>Add new designs or update pricing and details.</p>
        </div>
        <Link to="/superadmin/sections/new" className="efx-button efx-button-primary" style={{textDecoration: 'none'}}>
          + Add New Section
        </Link>
      </div>

      <div className="efx-glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--efx-border)' }}>
              <th className="efx-text-subdued" style={{ padding: '16px 24px', fontWeight: 500 }}>Preview</th>
              <th className="efx-text-subdued" style={{ padding: '16px 24px', fontWeight: 500 }}>Name</th>
              <th className="efx-text-subdued" style={{ padding: '16px 24px', fontWeight: 500 }}>Category</th>
              <th className="efx-text-subdued" style={{ padding: '16px 24px', fontWeight: 500 }}>Added By</th>
              <th className="efx-text-subdued" style={{ padding: '16px 24px', fontWeight: 500 }}>Price</th>
              <th className="efx-text-subdued" style={{ padding: '16px 24px', fontWeight: 500 }}>Status</th>
              <th className="efx-text-subdued" style={{ padding: '16px 24px', fontWeight: 500, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <tr key={section.id} style={{ borderBottom: '1px solid var(--efx-border)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '16px 24px', width: '80px' }}>
                  {section.preview_image_url ? (
                    <img src={section.preview_image_url} alt={section.name} style={{ width: '64px', height: '48px', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '64px', height: '48px', background: 'rgba(0,0,0,0.1)' }}></div>
                  )}
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className="efx-text-body" style={{ fontWeight: 500 }}>{section.name}</span>
                  <div style={{ fontSize: '0.8rem', color: 'var(--efx-text-subdued)' }}>{section.handle}</div>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className="efx-badge" style={{ margin: 0 }}>{section.category?.name || 'Uncategorized'}</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className="efx-text-body" style={{ margin: 0 }}>{section.author?.name || 'Master Admin'}</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className="efx-text-body" style={{ margin: 0 }}>{section.is_free ? 'Free' : `$${section.price}`}</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className={`efx-badge ${section.status === 'PUBLISHED' ? 'efx-badge-success' : ''}`} style={{ margin: 0 }}>{section.status}</span>
                </td>
                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                  <Link to={`/superadmin/sections/${section.id}`} className="efx-button" style={{textDecoration: 'none'}}>
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
