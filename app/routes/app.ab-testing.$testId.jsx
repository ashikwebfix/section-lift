import { redirect } from "react-router";
import { useLoaderData, useNavigate, useSubmit, useNavigation } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { syncWebPixel } from "../pixel.server";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export const loader = async ({ request, params }) => {
  const { session, admin } = await authenticate.admin(request);
  const testId = params.testId;

  await syncWebPixel(admin, request);

  const test = await db.aBTest.findFirst({
    where: { id: testId, shop_domain: session.shop },
    include: { events: { orderBy: { created_at: 'desc' } } }
  });

  if (!test) throw new Response("Not Found", { status: 404 });

  const stats = {
    A: { views: 0, clicks: 0, purchases: 0, revenue: 0, unique_visitors: new Set() },
    B: { views: 0, clicks: 0, purchases: 0, revenue: 0, unique_visitors: new Set() }
  };
  if (test.variant_c_id) stats.C = { views: 0, clicks: 0, purchases: 0, revenue: 0, unique_visitors: new Set() };
  if (test.variant_d_id) stats.D = { views: 0, clicks: 0, purchases: 0, revenue: 0, unique_visitors: new Set() };

  const sourceStats = {};

  test.events.forEach(event => {
    const s = stats[event.variant];
    if (!s) return;
    if (event.visitor_id) s.unique_visitors.add(event.visitor_id);
    if (event.event_type === 'VIEW') {
      s.views++;
      const src = event.visitor_source || 'Direct';
      if (!sourceStats[src]) sourceStats[src] = new Set();
      if (event.visitor_id) sourceStats[src].add(event.visitor_id);
    }
    if (event.event_type === 'CLICK') s.clicks++;
    if (event.event_type === 'PURCHASE') {
      s.purchases++;
      s.revenue += (event.revenue || 0);
    }
  });

  const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const pct = (num, den) => den === 0 ? '0.00%' : ((num / den) * 100).toFixed(2) + '%';

  const mkRow = (key, name, color) => {
    const s = stats[key];
    return {
      name, color,
      unique_visitors: s.unique_visitors.size,
      views: s.views,
      clicks: s.clicks,
      ctr: pct(s.clicks, s.views),
      purchases: s.purchases,
      cvr: pct(s.purchases, s.views),
      sales: fmt(s.revenue),
      rpv: s.unique_visitors.size === 0 ? fmt(0) : fmt(s.revenue / s.unique_visitors.size)
    };
  };

  const report = [
    mkRow('A', 'Original (A)', '#64748b'),
    mkRow('B', 'Variant (B)', '#10b981'),
  ];
  if (stats.C) report.push(mkRow('C', 'Variant (C)', '#3b82f6'));
  if (stats.D) report.push(mkRow('D', 'Variant (D)', '#8b5cf6'));

  const chartData = [
    { name: 'Views',    Original: stats.A.views,    VariantB: stats.B.views,    VariantC: stats.C?.views,    VariantD: stats.D?.views },
    { name: 'Visitors', Original: stats.A.unique_visitors.size, VariantB: stats.B.unique_visitors.size, VariantC: stats.C?.unique_visitors.size, VariantD: stats.D?.unique_visitors.size },
    { name: 'Clicks',   Original: stats.A.clicks,   VariantB: stats.B.clicks,   VariantC: stats.C?.clicks,   VariantD: stats.D?.clicks },
    { name: 'Orders',   Original: stats.A.purchases, VariantB: stats.B.purchases, VariantC: stats.C?.purchases, VariantD: stats.D?.purchases },
  ];

  const sourceData = Object.keys(sourceStats)
    .map(k => ({ name: k, value: sourceStats[k].size }))
    .sort((a, b) => b.value - a.value);

  const recentEvents = test.events.slice(0, 20).map(e => ({
    id: e.id,
    event_type: e.event_type,
    variant: e.variant,
    revenue: e.revenue,
    visitor_source: e.visitor_source,
    created_at: e.created_at
  }));

  const themeRes = await admin.graphql(`query { themes(roles: [MAIN], first: 1) { nodes { id } } }`);
  const themeData = await themeRes.json();
  const themeId = themeData.data.themes.nodes[0]?.id.split('/').pop();

  return { test, report, chartData, sourceData, recentEvents, themeId, shopDomain: session.shop };
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
    await db.aBTest.deleteMany({ where: { id: params.testId, shop_domain: session.shop } });
    return redirect("/app/ab-testing");
  }

  return { success: true };
};

export default function ABTestReport() {
  const { test, report, chartData, sourceData, recentEvents, themeId, shopDomain } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const navigation = useNavigation();

  const PIE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1'];
  const EVENT_COLORS = {
    VIEW:     { bg: 'var(--sl-surface-sunken)', color: 'var(--sl-text-secondary)' },
    CLICK:    { bg: 'var(--sl-surface-sunken)', color: 'var(--sl-text-secondary)' },
    PURCHASE: { bg: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }
  };
  const VARIANT_COLORS = { A: '#64748b', B: '#10b981', C: '#3b82f6', D: '#8b5cf6' };

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "32px" }}>

      {test.winning_variant_id && (
        <div style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "var(--sl-radius-md)", padding: "24px", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ fontSize: "32px" }}>🏆</div>
          <div>
            <h3 style={{ margin: "0 0 4px 0", color: "var(--sl-success)", fontSize: "16px", fontWeight: 700 }}>We have a winner!</h3>
            <p className="sl-body" style={{ margin: 0, fontWeight: 500 }}>
              Variant <strong>{test.winning_variant_id}</strong> was automatically selected as the winner.
            </p>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <button onClick={() => navigate("/app/ab-testing")} className="sl-btn sl-btn-ghost sl-btn-sm">&larr; Back</button>
          <h1 className="sl-page-title" style={{ margin: 0 }}>{test.name}</h1>
          <span className={`sl-badge sl-badge-${test.status === 'ACTIVE' ? 'active' : 'inactive'}`}>
            {test.status}
          </span>
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          {themeId && (
            <a href={`https://admin.shopify.com/store/${shopDomain.split('.')[0]}/themes/${themeId}/editor?context=apps`}
              target="_blank" rel="noreferrer"
              className="sl-btn sl-btn-secondary">
              Open Theme Editor
            </a>
          )}
          <button onClick={() => { if (confirm("Delete this test and all its data?")) submit({ intent: "delete" }, { method: "post" }); }}
            className="sl-btn sl-btn-ghost" style={{ color: "var(--sl-error)" }}>
            Delete
          </button>
          <button onClick={() => submit({ intent: "stop" }, { method: "post" })}
            disabled={test.status !== "ACTIVE" || navigation.state === "submitting"}
            className="sl-btn sl-btn-primary">
            {test.status === "ACTIVE" ? "Stop Test" : "Test Completed"}
          </button>
        </div>
      </div>

      {test.status === 'ACTIVE' && (
        <div className="sl-alert sl-alert-warning">
          <strong>Seeing both sections on your site?</strong> Ensure the A/B Tracker App Embed is enabled in your Theme Editor.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${report.length}, 1fr)`, gap: '20px' }}>
        {report.map((row, i) => (
          <div key={i} className="sl-card sl-card-body" style={{ borderTop: `4px solid ${row.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: "16px" }}>
              <span style={{ fontWeight: 600, fontSize: '15px' }}>{row.name}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{row.purchases}</div>
                <div className="sl-caption">Orders</div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--sl-success)' }}>{row.sales}</div>
                <div className="sl-caption">Revenue</div>
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 700 }}>{row.cvr}</div>
                <div className="sl-caption">CVR</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="sl-card sl-card-body">
            <h2 className="sl-section-title sl-mb-4">Performance Chart</h2>
            <div style={{ width: '100%', height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--sl-border-subdued)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--sl-text-secondary)', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--sl-text-secondary)', fontSize: 12 }} dx={-10} />
                  <Tooltip cursor={{ fill: 'var(--sl-surface-sunken)' }} contentStyle={{ borderRadius: 'var(--sl-radius-md)', border: '1px solid var(--sl-border)' }} />
                  <Legend iconType="circle" wrapperStyle={{ paddingTop: '16px', fontSize: '12px' }} />
                  <Bar dataKey="Original" fill="#64748b" radius={[4, 4, 0, 0]} barSize={24} />
                  <Bar dataKey="VariantB" name="Variant B" fill="#10b981" radius={[4, 4, 0, 0]} barSize={24} />
                  {test.variant_c_id && <Bar dataKey="VariantC" name="Variant C" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />}
                  {test.variant_d_id && <Bar dataKey="VariantD" name="Variant D" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={24} />}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="sl-card sl-table-wrap">
            <div style={{ padding: '20px', borderBottom: '1px solid var(--sl-border)' }}>
              <h2 className="sl-section-title" style={{ margin: 0 }}>Detailed Metrics</h2>
            </div>
            <table className="sl-table">
              <thead>
                <tr>
                  <th>Variant</th>
                  <th>Unique Visitors</th>
                  <th>Views</th>
                  <th>Clicks</th>
                  <th>CTR</th>
                  <th>Orders</th>
                  <th>Conv. Rate</th>
                  <th>Total Sales</th>
                  <th>Rev / Visitor</th>
                </tr>
              </thead>
              <tbody>
                {report.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>
                      <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: row.color, marginRight: '8px' }} />
                      {row.name}
                    </td>
                    <td>{row.unique_visitors}</td>
                    <td>{row.views}</td>
                    <td>{row.clicks}</td>
                    <td>{row.ctr}</td>
                    <td style={{ fontWeight: 600 }}>{row.purchases}</td>
                    <td style={{ fontWeight: 600, color: 'var(--sl-success)' }}>{row.cvr}</td>
                    <td style={{ fontWeight: 700 }}>{row.sales}</td>
                    <td>{row.rpv}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="sl-card sl-card-body">
            <h2 className="sl-section-title sl-mb-4">Live Event Feed</h2>
            {recentEvents.length === 0 ? (
              <p className="sl-caption">No events yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                {recentEvents.map(ev => {
                  const c = EVENT_COLORS[ev.event_type] || EVENT_COLORS.VIEW;
                  return (
                    <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--sl-surface-sunken)', borderRadius: 'var(--sl-radius-sm)', fontSize: '13px' }}>
                      <span style={{ background: c.bg, color: c.color, padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '11px', minWidth: '68px', textAlign: 'center' }}>
                        {ev.event_type}
                      </span>
                      <span style={{ background: VARIANT_COLORS[ev.variant] || '#64748b', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '11px' }}>
                        {ev.variant}
                      </span>
                      {ev.revenue != null && <span style={{ fontWeight: 600, color: 'var(--sl-success)' }}>${parseFloat(ev.revenue).toFixed(2)}</span>}
                      {ev.visitor_source && <span className="sl-caption">{ev.visitor_source}</span>}
                      <span className="sl-caption" style={{ marginLeft: 'auto' }}>{new Date(ev.created_at).toLocaleString()}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="sl-card sl-card-body" style={{ alignSelf: 'start', position: "sticky", top: "24px" }}>
          <h2 className="sl-section-title sl-mb-4">Configuration</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <ConfigRow label="Page URL" value={test.page_url || 'All pages'} />
            <ConfigRow label="Original Section (A)" value={test.original_id} mono />
            <ConfigRow label="Variant Section (B)" value={test.variant_id} mono />
            {test.variant_c_id && <ConfigRow label="Variant Section (C)" value={test.variant_c_id} mono />}
            {test.variant_d_id && <ConfigRow label="Variant Section (D)" value={test.variant_d_id} mono />}
            <ConfigRow label="Traffic Split" value={
              `A: ${100 - (test.traffic_split + (test.traffic_split_c || 0) + (test.traffic_split_d || 0))}% / B: ${test.traffic_split}%` +
              (test.traffic_split_c ? ` / C: ${test.traffic_split_c}%` : '') +
              (test.traffic_split_d ? ` / D: ${test.traffic_split_d}%` : '')
            } />
            <ConfigRow label="Device" value={test.target_device === 'ALL' ? 'All Devices' : test.target_device} />
            <ConfigRow label="Visitors" value={test.target_visitor_type === 'NEW' ? 'New Visitors' : test.target_visitor_type === 'RETURNING' ? 'Returning Visitors' : 'All Visitors'} />
            {test.utm_campaign && <ConfigRow label="UTM Campaign" value={`?utm_campaign=${test.utm_campaign}`} mono />}
            
            {sourceData.length > 0 && (
              <div style={{ marginTop: "16px" }}>
                <span className="sl-label-text sl-mb-2">Traffic Sources</span>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={sourceData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={2} dataKey="value" stroke="none">
                        {sourceData.map((_, idx) => <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip cursor={{ fill: 'var(--sl-surface-sunken)' }} contentStyle={{ borderRadius: 'var(--sl-radius-sm)', border: '1px solid var(--sl-border)' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfigRow({ label, value, mono = false }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <span className="sl-label-text">{label}</span>
      <span style={{ fontSize: "13px", color: "var(--sl-text-primary)", ...(mono ? { fontFamily: "monospace", background: "var(--sl-surface-sunken)", padding: "2px 6px", borderRadius: "4px", alignSelf: "flex-start" } : {}) }}>
        {value}
      </span>
    </div>
  );
}
