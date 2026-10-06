import { useLoaderData, useNavigate, Link } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { syncWebPixel } from "../pixel.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  
  // Ensure the Web Pixel is installed AND synced with the live trackUrl
  await syncWebPixel(admin, request);

  
  const tests = await db.aBTest.findMany({
    where: { shop_domain: session.shop },
    orderBy: { created_at: "desc" },
    include: {
      _count: {
        select: { events: true }
      },
      events: {
        where: { event_type: "PURCHASE" },
        select: { variant: true, revenue: true }
      }
    }
  });

  const testsWithSales = tests.map(test => {
    const ordersA = { count: 0, revenue: 0 };
    const ordersB = { count: 0, revenue: 0 };
    const ordersC = { count: 0, revenue: 0 };
    const ordersD = { count: 0, revenue: 0 };

    test.events.forEach(e => {
      const rev = e.revenue || 0;
      if (e.variant === 'A') { ordersA.count++; ordersA.revenue += rev; }
      else if (e.variant === 'B') { ordersB.count++; ordersB.revenue += rev; }
      else if (e.variant === 'C') { ordersC.count++; ordersC.revenue += rev; }
      else if (e.variant === 'D') { ordersD.count++; ordersD.revenue += rev; }
    });

    const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

    return {
      ...test,
      ordersA: ordersA.count,
      ordersB: ordersB.count,
      ordersC: ordersC.count,
      ordersD: ordersD.count,
      revenueA: fmt(ordersA.revenue),
      revenueB: fmt(ordersB.revenue),
      revenueC: fmt(ordersC.revenue),
      revenueD: fmt(ordersD.revenue),
    };
  });

  return { tests: testsWithSales };
};

export default function ABTestingList() {
  const { tests } = useLoaderData();
  const navigate = useNavigate();

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px" }}>
        <div>
          <h1 className="sl-page-title">A/B Tests</h1>
          <p className="sl-body sl-mt-1">Optimize your store's performance with data-driven experiments.</p>
        </div>
        <button 
          onClick={() => navigate("/app/ab-testing/new")} 
          className="sl-btn sl-btn-primary"
        >
          Create New Test
        </button>
      </div>

      {tests.length === 0 ? (
        <div className="sl-card sl-card-body">
          <div className="sl-empty-state">
            <div className="sl-empty-state-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                <line x1="12" y1="22.08" x2="12" y2="12"/>
              </svg>
            </div>
            <p className="sl-body" style={{ fontWeight: 500 }}>No A/B tests found</p>
            <p className="sl-caption">Create your first test to get started.</p>
          </div>
        </div>
      ) : (
        <div className="sl-card sl-table-wrap">
          <table className="sl-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Status</th>
                <th>Page URL</th>
                <th>Orders</th>
                <th>Revenue</th>
                <th>Events</th>
                <th>Created</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => (
                <tr 
                  key={test.id} 
                  className="sl-table-row-clickable"
                  onClick={() => navigate(`/app/ab-testing/${test.id}`)}
                >
                  <td style={{ fontWeight: 600 }}>{test.name}</td>
                  <td>
                    {test.status === 'ACTIVE' ? (
                      <span className="sl-badge sl-badge-active">Active</span>
                    ) : test.status === 'DRAFT' ? (
                      <span className="sl-badge sl-badge-draft">Draft</span>
                    ) : (
                      <span className="sl-badge sl-badge-inactive">{test.status}</span>
                    )}
                  </td>
                  <td>
                    <span className="sl-caption">{test.page_url || "Global"}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px" }}>
                      <span style={{ color: "var(--sl-text-primary)" }}>A: {test.ordersA}</span>
                      <span style={{ color: "var(--sl-success)" }}>B: {test.ordersB}</span>
                      {test.variant_c_id && <span style={{ color: "#2563eb" }}>C: {test.ordersC}</span>}
                      {test.variant_d_id && <span style={{ color: "#d97706" }}>D: {test.ordersD}</span>}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12px", fontWeight: 600 }}>
                      <span style={{ color: "var(--sl-text-primary)" }}>A: {test.revenueA}</span>
                      <span style={{ color: "var(--sl-success)" }}>B: {test.revenueB}</span>
                      {test.variant_c_id && <span style={{ color: "#2563eb" }}>C: {test.revenueC}</span>}
                      {test.variant_d_id && <span style={{ color: "#d97706" }}>D: {test.revenueD}</span>}
                    </div>
                  </td>
                  <td>
                    <span className="sl-caption">{test._count.events}</span>
                  </td>
                  <td>
                    <span className="sl-caption">{new Date(test.created_at).toLocaleDateString()}</span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <span className="sl-btn sl-btn-secondary sl-btn-sm" style={{ pointerEvents: "none" }}>View</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
