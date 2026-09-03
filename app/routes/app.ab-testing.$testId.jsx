import { redirect } from "react-router";
import { useLoaderData, useNavigate, useSubmit, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const testId = params.testId;

  const test = await db.aBTest.findFirst({
    where: { id: testId, shop_domain: session.shop },
    include: { events: true }
  });

  if (!test) {
    throw new Response("Not Found", { status: 404 });
  }

  // Calculate stats
  const stats = {
    A: { views: 0, clicks: 0, purchases: 0, unique_visitors: new Set() },
    B: { views: 0, clicks: 0, purchases: 0, unique_visitors: new Set() }
  };

  test.events.forEach(event => {
    if (!stats[event.variant]) return;
    
    if (event.visitor_id) {
      stats[event.variant].unique_visitors.add(event.visitor_id);
    }

    if (event.event_type === 'VIEW') stats[event.variant].views++;
    if (event.event_type === 'CLICK') stats[event.variant].clicks++;
    if (event.event_type === 'PURCHASE') stats[event.variant].purchases++;
  });

  const getCtr = (variant) => {
    if (stats[variant].views === 0) return "0.00%";
    return ((stats[variant].clicks / stats[variant].views) * 100).toFixed(2) + "%";
  };
  
  const getCvr = (variant) => {
    if (stats[variant].views === 0) return "0.00%";
    return ((stats[variant].purchases / stats[variant].views) * 100).toFixed(2) + "%";
  };

  const report = [
    { name: "Original (A)", unique_visitors: stats.A.unique_visitors.size, views: stats.A.views, clicks: stats.A.clicks, ctr: getCtr('A'), purchases: stats.A.purchases, cvr: getCvr('A') },
    { name: "Variant (B)", unique_visitors: stats.B.unique_visitors.size, views: stats.B.views, clicks: stats.B.clicks, ctr: getCtr('B'), purchases: stats.B.purchases, cvr: getCvr('B') }
  ];

  const chartData = [
    { name: 'Total Views', Original: stats.A.views, Variant: stats.B.views },
    { name: 'Unique Visitors', Original: stats.A.unique_visitors.size, Variant: stats.B.unique_visitors.size },
    { name: 'Clicks', Original: stats.A.clicks, Variant: stats.B.clicks },
    { name: 'Purchases', Original: stats.A.purchases, Variant: stats.B.purchases },
  ];

  // Fetch Main Theme ID for Theme Editor button
  const { admin } = await authenticate.admin(request);
  const themeResponse = await admin.graphql(`
    query {
      themes(roles: [MAIN], first: 1) {
        nodes { id }
      }
    }
  `);
  const themeData = await themeResponse.json();
  const themeId = themeData.data.themes.nodes[0]?.id.split("/").pop();

  return { test, report, chartData, themeId, shopDomain: session.shop };
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "stop") {
    await db.aBTest.updateMany({
      where: { id: params.testId, shop_domain: session.shop },
      data: { status: "COMPLETED" }
    });
  } else if (intent === "delete") {
    await db.aBTest.deleteMany({
      where: { id: params.testId, shop_domain: session.shop }
    });
    return redirect("/app/ab-testing");
  }

  return { success: true };
};

export default function ABTestReport() {
  const { test, report, chartData, themeId, shopDomain } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();

  const handleStop = () => {
    submit({ intent: "stop" }, { method: "post" });
  };
  
  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this test and all its data?")) {
      submit({ intent: "delete" }, { method: "post" });
    }
  };

  return (
    <div className="efx-flex efx-flex-col efx-gap-xl" style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header */}
      <div className="efx-flex efx-justify-between efx-items-center">
        <div className="efx-flex efx-items-center efx-gap-md">
          <button 
            onClick={() => navigate("/app/ab-testing")}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: '4px' }}
            className="efx-button-secondary"
          >
            &larr; Back
          </button>
          <h1 className="efx-heading-xl" style={{margin: 0}}>{test.name}</h1>
          <span style={{ 
            background: test.status === 'ACTIVE' ? '#059669' : test.status === 'DRAFT' ? '#3b82f6' : '#6b7280', 
            color: 'white', 
            padding: '4px 8px', 
            borderRadius: '4px', 
            fontSize: '12px', 
            fontWeight: 600,
            marginLeft: '12px'
          }}>
            {test.status}
          </span>
        </div>
        <div className="efx-flex efx-gap-sm">
          {themeId && (
            <a 
              href={`https://admin.shopify.com/store/${shopDomain.split('.')[0]}/themes/${themeId}/editor?context=apps`}
              target="_blank" 
              rel="noreferrer"
              style={{ background: 'none', border: '1px solid #10b981', color: '#10b981', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center' }}
            >
              Open Theme Editor
            </a>
          )}
          <button 
            onClick={handleDelete}
            style={{ background: 'none', border: '1px solid #ef4444', color: '#ef4444', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
          >
            Delete
          </button>
          <button 
            onClick={handleStop}
            disabled={test.status !== "ACTIVE" || navigation.state === "submitting"}
            className="efx-button efx-button-primary"
            style={{ opacity: test.status !== "ACTIVE" ? 0.5 : 1 }}
          >
            {test.status === "ACTIVE" ? "Stop Test" : "Test Completed"}
          </button>
        </div>
      </div>

      {test.status === 'ACTIVE' && (
        <div style={{ padding: '16px 20px', background: '#fffbeb', borderLeft: '4px solid #f59e0b', borderRadius: '4px', borderTop: '1px solid #fef3c7', borderRight: '1px solid #fef3c7', borderBottom: '1px solid #fef3c7', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ flex: 1 }}>
            <h4 style={{ margin: 0, color: '#92400e', fontSize: '15px', fontWeight: 600 }}>Troubleshooting: Are you seeing both sections on your site?</h4>
            <p style={{ margin: '4px 0 0 0', color: '#b45309', fontSize: '14px' }}>
              If your A/B test isn't hiding the sections properly, you need to enable the <strong>A/B Tracker App Embed</strong> in your Theme Editor. 
              Click the "Open Theme Editor" button above, then enable the A/B Tracker block and click Save.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '24px' }}>
        {/* Left Column: Report */}
        <div className="efx-flex efx-flex-col efx-gap-lg">
          
          {/* Chart Card */}
          <div className="efx-solid-card" style={{ padding: '32px' }}>
             <h2 className="efx-heading-lg efx-mb-lg" style={{margin: 0, marginBottom: '24px'}}>Performance Visualized</h2>
             <div style={{ width: '100%', height: 350 }}>
               <ResponsiveContainer>
                 <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                   <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                   <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} dy={10} />
                   <YAxis axisLine={false} tickLine={false} tick={{fill: '#6b7280'}} dx={-10} />
                   <Tooltip 
                     cursor={{fill: '#f3f4f6'}}
                     contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)', padding: '12px' }}
                     itemStyle={{ fontWeight: 600 }}
                   />
                   <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                   <Bar dataKey="Original" fill="#9ca3af" radius={[4, 4, 0, 0]} barSize={40} />
                   <Bar dataKey="Variant" fill="#10b981" radius={[4, 4, 0, 0]} barSize={40} />
                 </BarChart>
               </ResponsiveContainer>
             </div>
          </div>

          {/* Data Table Card */}
          <div className="efx-solid-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--efx-border-subdued)' }}>
              <h2 className="efx-heading-lg" style={{margin: 0}}>Detailed Metrics</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--efx-border-subdued)', background: '#f9fafb' }}>
                    <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', color: '#6b7280' }}>Variant</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', color: '#6b7280' }}>Unique Visitors</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', color: '#6b7280' }}>Total Views</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', color: '#6b7280' }}>Clicks</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', color: '#6b7280' }}>Click-Through Rate</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', color: '#6b7280' }}>Purchases</th>
                    <th style={{ padding: '16px 24px', fontWeight: 600, fontSize: '13px', textTransform: 'uppercase', color: '#6b7280' }}>Conversion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((row, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--efx-border-subdued)', transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{ padding: '20px 24px' }}>
                        <div className="efx-flex efx-items-center efx-gap-sm">
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: row.name.includes('Original') ? '#9ca3af' : '#10b981' }}></div>
                          <div className="efx-text-body" style={{ fontWeight: 600, color: '#111827' }}>{row.name}</div>
                        </div>
                      </td>
                      <td style={{ padding: '20px 24px', fontWeight: 500, color: '#374151' }}>{row.unique_visitors}</td>
                      <td style={{ padding: '20px 24px', color: '#4b5563' }}>{row.views}</td>
                      <td style={{ padding: '20px 24px', color: '#4b5563' }}>{row.clicks}</td>
                      <td style={{ padding: '20px 24px', color: '#4b5563' }}>{row.ctr}</td>
                      <td style={{ padding: '20px 24px', color: '#4b5563' }}>{row.purchases}</td>
                      <td style={{ padding: '20px 24px', fontWeight: 600, color: '#10b981' }}>{row.cvr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        {/* Right Column: Config */}
        <div className="efx-solid-card">
          <h2 className="efx-heading-lg efx-mb-lg" style={{margin: 0, marginBottom: '24px'}}>Configuration</h2>
          
          <div className="efx-flex efx-flex-col efx-gap-lg">
            <div className="efx-flex efx-flex-col efx-gap-xs">
              <span className="efx-text-subdued" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Page URL</span>
              <span className="efx-text-body" style={{ fontWeight: 500 }}>{test.page_url}</span>
            </div>
            
            <div className="efx-flex efx-flex-col efx-gap-xs">
              <span className="efx-text-subdued" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Original Section ID</span>
              <span className="efx-text-body" style={{ fontWeight: 500, fontFamily: 'monospace', background: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', alignSelf: 'flex-start' }}>{test.original_id}</span>
            </div>
            
            <div className="efx-flex efx-flex-col efx-gap-xs">
              <span className="efx-text-subdued" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Variant Section ID</span>
              <span className="efx-text-body" style={{ fontWeight: 500, fontFamily: 'monospace', background: '#f3f4f6', padding: '4px 8px', borderRadius: '4px', alignSelf: 'flex-start' }}>{test.variant_id}</span>
            </div>

            <div className="efx-flex efx-flex-col efx-gap-xs">
              <span className="efx-text-subdued" style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>Traffic Split</span>
              <span className="efx-text-body" style={{ fontWeight: 500 }}>{100 - test.traffic_split}% Original / {test.traffic_split}% Variant</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
