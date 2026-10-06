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

const StatIcon = ({ children }) => (
  <div className="sa-stat-icon">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {children}
    </svg>
  </div>
);

export default function SuperadminDashboard() {
  const { shopCount, sectionCount, entitlementCount, installCount, topSections } = useLoaderData();

  const stats = [
    { label: "Active Shops", value: shopCount, icon: <><path d="M3 9l1-5h16l1 5" /><path d="M4 9v11h16V9" /><path d="M9 20v-6h6v6" /></> },
    { label: "Total Resources", value: sectionCount, icon: <><path d="M12 2 2 7l10 5 10-5-10-5z" /><path d="m2 17 10 5 10-5" /><path d="m2 12 10 5 10-5" /></> },
    { label: "Total Claims", value: entitlementCount, icon: <><path d="M20 12v10H4V12" /><path d="M2 7h20v5H2z" /><path d="M12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></> },
    { label: "Total Installs", value: installCount, icon: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></> },
  ];

  return (
    <>
      <div className="sa-page-header">
        <div>
          <h1 className="sl-page-title">Dashboard Overview</h1>
          <p className="sl-body sl-mt-1">Analytics and top performing sections.</p>
        </div>
      </div>

      <div className="sl-grid-4">
        {stats.map((s) => (
          <div key={s.label} className="sl-stat-card">
            <div className="sl-flex sl-items-center sl-justify-between">
              <span className="sl-label">{s.label}</span>
              <StatIcon>{s.icon}</StatIcon>
            </div>
            <div className="sl-stat-value">{s.value.toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="sl-card">
        <div className="sl-card-body sl-flex sl-items-center sl-justify-between" style={{ borderBottom: "1px solid var(--sl-border)" }}>
          <div>
            <h2 className="sl-section-title">Popular Designs</h2>
            <p className="sl-caption sl-mt-1">Top 10 by number of claims</p>
          </div>
        </div>
        {topSections.length === 0 ? (
          <div className="sl-empty-state">
            <p className="sl-body" style={{ fontWeight: 500 }}>No sections yet</p>
            <p className="sl-caption">Add your first section to see performance here.</p>
          </div>
        ) : (
          <div className="sl-table-wrap">
            <table className="sl-table">
              <thead>
                <tr>
                  <th style={{ width: 48 }}>#</th>
                  <th>Section Name</th>
                  <th>Price</th>
                  <th>Claims</th>
                  <th>Installs</th>
                </tr>
              </thead>
              <tbody>
                {topSections.map((section, i) => (
                  <tr key={section.id}>
                    <td><span className="sl-caption" style={{ fontWeight: 600 }}>{i + 1}</span></td>
                    <td style={{ fontWeight: 600 }}>{section.name}</td>
                    <td>
                      {section.is_free
                        ? <span className="sl-badge sl-badge-success">Free</span>
                        : <span className="sl-badge sl-badge-default">${section.price}</span>}
                    </td>
                    <td>{section._count.entitlements}</td>
                    <td>{section._count.installations}</td>
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
