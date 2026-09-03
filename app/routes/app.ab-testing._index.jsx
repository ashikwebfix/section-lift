import { useLoaderData, useNavigate, Link } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  
  const tests = await db.aBTest.findMany({
    where: { shop_domain: session.shop },
    orderBy: { created_at: "desc" },
    include: {
      _count: {
        select: { events: true }
      }
    }
  });

  return { tests };
};

export default function ABTestingList() {
  const { tests } = useLoaderData();
  const navigate = useNavigate();

  return (
    <div className="efx-flex efx-flex-col efx-gap-xl" style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="efx-flex efx-justify-between efx-items-center">
        <div>
          <h1 className="efx-heading-xl" style={{margin: 0}}>A/B Tests</h1>
          <p className="efx-text-subdued efx-mt-sm">Optimize your store's performance.</p>
        </div>
        <div>
          <button 
            onClick={() => navigate("/app/ab-testing/new")} 
            className="efx-button efx-button-primary"
          >
            Create New Test
          </button>
        </div>
      </div>

      <div className="efx-solid-card" style={{ padding: 0, overflow: 'hidden' }}>
        {tests.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center' }} className="efx-text-subdued">
            No A/B tests found. Create your first test to get started.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--efx-border-subdued)', background: '#f9fafb' }}>
                <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '14px' }}>Name</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '14px' }}>Status</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '14px' }}>Page URL</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '14px' }}>Total Events</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '14px' }}>Created At</th>
                <th style={{ padding: '12px 16px', fontWeight: 600, fontSize: '14px' }}></th>
              </tr>
            </thead>
            <tbody>
              {tests.map((test) => (
                <tr key={test.id} style={{ borderBottom: '1px solid var(--efx-border-subdued)', cursor: 'pointer' }} onClick={() => navigate(`/app/ab-testing/${test.id}`)}>
                  <td style={{ padding: '16px' }}><div className="efx-text-body" style={{ fontWeight: 600 }}>{test.name}</div></td>
                  <td style={{ padding: '16px' }}>
                    <span style={{ 
                      background: test.status === 'ACTIVE' ? '#059669' : test.status === 'DRAFT' ? '#3b82f6' : '#6b7280', 
                      color: 'white', 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px', 
                      fontWeight: 600 
                    }}>
                      {test.status}
                    </span>
                  </td>
                  <td style={{ padding: '16px', color: 'var(--efx-text-subdued)' }}>{test.page_url || "Global"}</td>
                  <td style={{ padding: '16px', color: 'var(--efx-text-subdued)' }}>{test._count.events}</td>
                  <td style={{ padding: '16px', color: 'var(--efx-text-subdued)' }}>{new Date(test.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '16px', textAlign: 'right' }}>
                    <Link to={`/app/ab-testing/${test.id}`} style={{ color: 'var(--efx-color-primary)', textDecoration: 'none', fontWeight: 500 }}>View &rarr;</Link>
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
