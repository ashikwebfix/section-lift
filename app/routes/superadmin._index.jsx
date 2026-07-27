import { useLoaderData } from "react-router";
import prisma from "../db.server";

export const loader = async () => {
  const shopCount = await prisma.shop.count();
  const sectionCount = await prisma.section.count();
  const entitlementCount = await prisma.entitlement.count();
  const installCount = await prisma.installation.count();

  const topSections = await prisma.section.findMany({
    include: {
      _count: {
        select: { entitlements: true, installations: true }
      }
    },
    orderBy: {
      entitlements: {
        _count: 'desc'
      }
    },
    take: 10
  });

  return { shopCount, sectionCount, entitlementCount, installCount, topSections };
};

export default function SuperadminDashboard() {
  const { shopCount, sectionCount, entitlementCount, installCount, topSections } = useLoaderData();

  return (
    <div className="efx-flex efx-flex-col efx-gap-lg">
      <div className="efx-flex efx-justify-between efx-items-end">
        <div>
          <h1 className="efx-heading-xl" style={{margin:0}}>Dashboard Overview</h1>
          <p className="efx-text-subdued" style={{margin:0}}>Analytics and top performing sections.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '20px' }}>
        <div className="efx-solid-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '24px' }}>
          <h3 className="efx-text-subdued" style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Shops</h3>
          <p className="efx-heading-xl" style={{ margin: 0, fontSize: '2.5rem', lineHeight: 1 }}>{shopCount}</p>
        </div>
        <div className="efx-solid-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '24px' }}>
          <h3 className="efx-text-subdued" style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Resources</h3>
          <p className="efx-heading-xl" style={{ margin: 0, fontSize: '2.5rem', lineHeight: 1 }}>{sectionCount}</p>
        </div>
        <div className="efx-solid-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '24px' }}>
          <h3 className="efx-text-subdued" style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Claims</h3>
          <p className="efx-heading-xl" style={{ margin: 0, fontSize: '2.5rem', lineHeight: 1 }}>{entitlementCount}</p>
        </div>
        <div className="efx-solid-card" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '24px' }}>
          <h3 className="efx-text-subdued" style={{ margin: 0, fontWeight: 600, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Installs</h3>
          <p className="efx-heading-xl" style={{ margin: 0, fontSize: '2.5rem', lineHeight: 1 }}>{installCount}</p>
        </div>
      </div>

      <div className="efx-solid-card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ padding: '24px', borderBottom: '1px solid var(--efx-border-solid)' }}>
          <h2 className="efx-heading-lg" style={{margin:0}}>Popular Designs</h2>
        </div>
        <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--efx-border-solid)' }}>
              <th className="efx-text-subdued" style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Section Name</th>
              <th className="efx-text-subdued" style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price</th>
              <th className="efx-text-subdued" style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Claims</th>
              <th className="efx-text-subdued" style={{ padding: '16px 24px', fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Installs</th>
            </tr>
          </thead>
          <tbody>
            {topSections.map((section) => (
              <tr key={section.id} style={{ borderBottom: '1px solid var(--efx-border-solid)', transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.3)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '16px 24px' }}>
                  <span className="efx-text-body" style={{ fontWeight: 500 }}>{section.name}</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className="efx-text-body" style={{ margin: 0 }}>{section.is_free ? 'Free' : `$${section.price}`}</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className="efx-text-body" style={{ margin: 0 }}>{section._count.entitlements}</span>
                </td>
                <td style={{ padding: '16px 24px' }}>
                  <span className="efx-text-body" style={{ margin: 0 }}>{section._count.installations}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
