import { useLoaderData, Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session, billing } = await authenticate.admin(request);

  // Stats
  const entitlementsCount = await prisma.entitlement.count({
    where: { shop_domain: session.shop, status: "ACTIVE" },
  });

  const installationsCount = await prisma.installation.count({
    where: { shop_domain: session.shop, status: "ACTIVE" },
  });

  // Total sections and pages available in the store
  const totalSections = await prisma.section.count({
    where: { status: "PUBLISHED", type: "SECTION" },
  });

  const totalPages = await prisma.section.count({
    where: { status: "PUBLISHED", type: "PAGE" },
  });

  // Billing Check
  const { hasActivePayment } = await billing.check({
    plans: [MONTHLY_PLAN],
    isTest: true,
  });

  // Claims this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const claimsThisMonth = await prisma.entitlement.count({
    where: {
      shop_domain: session.shop,
      source_type: "SUBSCRIPTION",
      granted_at: {
        gte: startOfMonth,
      }
    }
  });

  const SUBSCRIPTION_LIMIT = process.env.SUBSCRIPTION_LIMIT ? parseInt(process.env.SUBSCRIPTION_LIMIT) : 10;

  // Featured Sections
  const featuredSections = await prisma.section.findMany({
    where: { is_featured: true, status: "PUBLISHED" },
    take: 6,
    include: { category: true },
    orderBy: { created_at: 'desc' }
  });

  return { 
    entitlementsCount, 
    installationsCount,
    totalSections,
    totalPages,
    hasSubscription: hasActivePayment, 
    claimsThisMonth, 
    subscriptionLimit: SUBSCRIPTION_LIMIT,
    featuredSections 
  };
};

export default function Index() {
  const { entitlementsCount, installationsCount, totalSections, totalPages, hasSubscription, claimsThisMonth, subscriptionLimit, featuredSections } = useLoaderData();

  return (
    <div className="efx-flex efx-flex-col efx-gap-xl" style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header Area */}
      <div className="efx-flex efx-justify-between efx-items-center">
        <div>
          <h1 className="efx-heading-xl" style={{margin: 0}}>Dashboard</h1>
          <p className="efx-text-subdued efx-mt-sm">Welcome back to Section Lift.</p>
        </div>
        <div className="efx-flex efx-gap-sm">
          <Link to="/app/discover" className="efx-button efx-button-primary" style={{textDecoration: 'none'}}>
            Browse Sections &rarr;
          </Link>
          <Link to="/app/pages" className="efx-button efx-button-secondary" style={{textDecoration: 'none'}}>
            Browse Pages &rarr;
          </Link>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
        <Link to="/app/discover" className="efx-solid-card" style={{ textDecoration: 'none', color: 'inherit', textAlign: 'center' }}>
          <div className="efx-text-subdued efx-mb-sm" style={{fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em'}}>Total Sections</div>
          <div className="efx-heading-xl" style={{margin: 0, fontSize: '2rem'}}>{totalSections}</div>
        </Link>
        <Link to="/app/pages" className="efx-solid-card" style={{ textDecoration: 'none', color: 'inherit', textAlign: 'center' }}>
          <div className="efx-text-subdued efx-mb-sm" style={{fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em'}}>Total Pages</div>
          <div className="efx-heading-xl" style={{margin: 0, fontSize: '2rem'}}>{totalPages}</div>
        </Link>
        <Link to="/app/my-sections" className="efx-solid-card" style={{ textDecoration: 'none', color: 'inherit', textAlign: 'center' }}>
          <div className="efx-text-subdued efx-mb-sm" style={{fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em'}}>Owned</div>
          <div className="efx-heading-xl" style={{margin: 0, fontSize: '2rem'}}>{entitlementsCount}</div>
        </Link>
        <Link to="/app/history" className="efx-solid-card" style={{ textDecoration: 'none', color: 'inherit', textAlign: 'center' }}>
          <div className="efx-text-subdued efx-mb-sm" style={{fontWeight: 600, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em'}}>Installed</div>
          <div className="efx-heading-xl" style={{margin: 0, fontSize: '2rem'}}>{installationsCount}</div>
        </Link>
      </div>

      {/* Subscription Status Widget */}
      <div className="efx-solid-card" style={{ border: hasSubscription ? '2px solid #111827' : '1px solid var(--efx-border-solid)' }}>
        <div className="efx-flex efx-justify-between efx-items-center">
          <div className="efx-flex efx-items-center efx-gap-md">
            <div>
              <div className="efx-flex efx-items-center efx-gap-sm efx-mb-xs">
                <h2 className="efx-heading-lg" style={{margin: 0}}>Current Plan</h2>
                {hasSubscription ? (
                  <span style={{ background: '#059669', color: 'white', padding: '4px 10px', borderRadius: 'var(--efx-radius-pill)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em' }}>PRO</span>
                ) : (
                  <span style={{ background: '#6b7280', color: 'white', padding: '4px 10px', borderRadius: 'var(--efx-radius-pill)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em' }}>FREE</span>
                )}
              </div>
              {hasSubscription ? (
                <div className="efx-flex efx-items-center efx-gap-lg efx-mt-sm">
                  <div className="efx-text-subdued">
                    Monthly claims: <strong style={{ color: 'var(--efx-text-main)' }}>{claimsThisMonth} / {subscriptionLimit}</strong>
                  </div>
                  <div style={{ width: '120px', height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min((claimsThisMonth / subscriptionLimit) * 100, 100)}%`, background: '#111827', borderRadius: '3px', transition: 'width 0.3s ease' }}></div>
                  </div>
                </div>
              ) : (
                <p className="efx-text-subdued" style={{margin: 0}}>
                  Upgrade to Pro to claim up to {subscriptionLimit} premium sections & pages every month.
                </p>
              )}
            </div>
          </div>
          <Link to="/app/pricing" className={hasSubscription ? "efx-button efx-button-secondary" : "efx-button efx-button-primary"} style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}>
            {hasSubscription ? 'Manage Subscription' : 'Upgrade to Pro'}
          </Link>
        </div>
      </div>

      {/* Featured Sections */}
      {featuredSections.length > 0 && (
        <div className="efx-mt-xl">
          <div className="efx-flex efx-justify-between efx-items-end efx-mb-lg">
            <h2 className="efx-heading-lg" style={{margin: 0}}>Featured Sections</h2>
          </div>
          
          <div className="efx-grid-3">
            {featuredSections.map((section) => (
              <Link 
                to={`/app/sections/${section.handle}`} 
                key={section.id}
                className={`efx-glass-card efx-glass-card-interactive efx-flex efx-flex-col ${section.is_exclusive ? 'efx-premium-card' : ''}`} 
                style={{ padding: section.is_exclusive ? '2px' : 0, textDecoration: 'none', color: 'inherit', display: 'block', overflow: 'hidden' }}
              >
                <div style={{ height: '200px', backgroundColor: '#e4e5e7', position: 'relative', borderTopLeftRadius: 'inherit', borderTopRightRadius: 'inherit', overflow: 'hidden' }}>
                  {section.preview_image_url ? (
                    <img src={section.preview_image_url} alt={section.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div className="efx-flex efx-items-center efx-justify-center" style={{ height: '100%', color: '#8c9196' }}>No Preview</div>
                  )}
                  <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '8px' }}>
                    {section.is_free ? (
                      <span style={{ background: 'var(--efx-color-success)', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>Free</span>
                    ) : section.is_exclusive ? (
                      <span className="efx-badge-premium" style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>Premium</span>
                    ) : (
                      <span style={{ background: '#202223', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>Pro</span>
                    )}
                  </div>
                </div>
                <div className="efx-flex efx-flex-col efx-gap-xs" style={{ padding: '16px' }}>
                  <span className="efx-text-subdued" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {section.category?.name || 'Section'}
                  </span>
                  <div className="efx-text-body" style={{ fontWeight: 600, fontSize: '16px' }}>{section.name}</div>
                  {!section.is_free && (
                    <div className="efx-text-subdued efx-mt-xs">${section.price.toFixed(2)}</div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
