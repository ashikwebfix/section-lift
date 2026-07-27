import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  const sections = await prisma.section.findMany({
    include: { category: true },
    orderBy: { created_at: "desc" }
  });
  return { sections };
};

export default function Admin() {
  const { sections } = useLoaderData();

  return (
    <div className="efx-flex efx-flex-col efx-gap-lg" style={{ padding: '32px' }}>
      <div className="efx-flex efx-flex-col efx-gap-sm">
        <h1 className="efx-heading-xl">Admin Management</h1>
        <p className="efx-text-body">
          Manage your section library, pricing, and availability.
        </p>
      </div>

      <div className="efx-glass-card" style={{ padding: '0', overflow: 'hidden' }}>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--efx-border)' }}>
              <th className="efx-heading-md" style={{ padding: '16px 24px' }}>Name</th>
              <th className="efx-heading-md" style={{ padding: '16px 24px' }}>Category</th>
              <th className="efx-heading-md" style={{ padding: '16px 24px' }}>Price</th>
              <th className="efx-heading-md" style={{ padding: '16px 24px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {sections.map((section) => (
              <tr key={section.id} style={{ borderBottom: '1px solid var(--efx-border)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '16px 24px' }}>
                  <span className="efx-text-body" style={{ fontWeight: 500 }}>{section.name}</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className="efx-badge" style={{ margin: 0 }}>{section.category?.name || 'Uncategorized'}</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className="efx-text-body" style={{ margin: 0 }}>{section.is_free ? 'Free' : `$${section.price}`}</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className={`efx-badge ${section.status === 'PUBLISHED' ? 'efx-badge-success' : ''}`} style={{ margin: 0 }}>{section.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
