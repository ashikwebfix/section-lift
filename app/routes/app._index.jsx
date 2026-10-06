import { useLoaderData, Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session, billing } = await authenticate.admin(request);

  const entitlementsCount = await prisma.entitlement.count({
    where: { shop_domain: session.shop, status: "ACTIVE" },
  });

  const installationsCount = await prisma.installation.count({
    where: { shop_domain: session.shop, status: "ACTIVE" },
  });

  const totalSections = await prisma.section.count({
    where: { status: "PUBLISHED", type: "SECTION" },
  });

  const totalPages = await prisma.section.count({
    where: { status: "PUBLISHED", type: "PAGE" },
  });

  const { hasActivePayment } = await billing.check({
    plans: [MONTHLY_PLAN],
    isTest: true,
  });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const claimsThisMonth = await prisma.entitlement.count({
    where: {
      shop_domain: session.shop,
      source_type: "SUBSCRIPTION",
      granted_at: { gte: startOfMonth },
    },
  });

  const SUBSCRIPTION_LIMIT = process.env.SUBSCRIPTION_LIMIT
    ? parseInt(process.env.SUBSCRIPTION_LIMIT)
    : 10;

  const featuredSections = await prisma.section.findMany({
    where: { is_featured: true, status: "PUBLISHED" },
    take: 6,
    include: { category: true },
    orderBy: { created_at: "desc" },
  });

  return {
    entitlementsCount,
    installationsCount,
    totalSections,
    totalPages,
    hasSubscription: hasActivePayment,
    claimsThisMonth,
    subscriptionLimit: SUBSCRIPTION_LIMIT,
    featuredSections,
  };
};

const GridIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
);

const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
  </svg>
);

const BookmarkIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
  </svg>
);

const InstallIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
  </svg>
);

const ArrowRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
  </svg>
);

export default function Index() {
  const {
    entitlementsCount,
    installationsCount,
    totalSections,
    totalPages,
    hasSubscription,
    claimsThisMonth,
    subscriptionLimit,
    featuredSections,
  } = useLoaderData();

  const claimPct = Math.min((claimsThisMonth / subscriptionLimit) * 100, 100);

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "28px" }}>

      {/* ── Page Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
        <div>
          <h1 className="sl-page-title">Dashboard</h1>
          <p className="sl-body sl-mt-1">Welcome back to Section Lift.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
          <Link to="/app/discover" className="sl-btn sl-btn-primary" style={{ textDecoration: "none" }}>
            Browse Sections <ArrowRight />
          </Link>
          <Link to="/app/pages" className="sl-btn sl-btn-secondary" style={{ textDecoration: "none" }}>
            Browse Pages
          </Link>
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="sl-grid-4">
        <Link to="/app/discover" className="sl-stat-card" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="sl-label">Sections</span>
            <span style={{ opacity: 0.3 }}><GridIcon /></span>
          </div>
          <div className="sl-stat-value">{totalSections}</div>
          <div className="sl-caption sl-mt-1">Available in catalog</div>
        </Link>

        <Link to="/app/pages" className="sl-stat-card" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="sl-label">Pages</span>
            <span style={{ opacity: 0.3 }}><FileIcon /></span>
          </div>
          <div className="sl-stat-value">{totalPages}</div>
          <div className="sl-caption sl-mt-1">Available in catalog</div>
        </Link>

        <Link to="/app/my-sections" className="sl-stat-card" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="sl-label">Owned</span>
            <span style={{ opacity: 0.3 }}><BookmarkIcon /></span>
          </div>
          <div className="sl-stat-value">{entitlementsCount}</div>
          <div className="sl-caption sl-mt-1">In your library</div>
        </Link>

        <Link to="/app/history" className="sl-stat-card" style={{ textDecoration: "none" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span className="sl-label">Installed</span>
            <span style={{ opacity: 0.3 }}><InstallIcon /></span>
          </div>
          <div className="sl-stat-value">{installationsCount}</div>
          <div className="sl-caption sl-mt-1">Active in themes</div>
        </Link>
      </div>

      {/* ── Plan Banner ── */}
      <div className={`sl-plan-banner ${hasSubscription ? "sl-plan-banner-active" : ""}`}>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span className="sl-section-title">Current Plan</span>
              {hasSubscription ? (
                <span className="sl-plan-pill sl-badge-success" style={{ padding: "3px 8px", borderRadius: "99px" }}>
                  <span className="sl-plan-pill-dot" style={{ background: "var(--sl-success)" }}></span>
                  Pro
                </span>
              ) : (
                <span className="sl-plan-pill sl-badge-default" style={{ padding: "3px 8px", borderRadius: "99px" }}>
                  Free
                </span>
              )}
            </div>

            {hasSubscription ? (
              <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
                <span className="sl-body">
                  Monthly claims: <strong style={{ color: "var(--sl-text-primary)" }}>{claimsThisMonth} / {subscriptionLimit}</strong>
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div className="sl-progress-track" style={{ width: "140px" }}>
                    <div className="sl-progress-fill" style={{ width: `${claimPct}%` }}></div>
                  </div>
                  <span className="sl-caption">{Math.round(claimPct)}%</span>
                </div>
              </div>
            ) : (
              <p className="sl-body">
                Upgrade to Pro to claim up to {subscriptionLimit} premium sections &amp; pages per month.
              </p>
            )}
          </div>
        </div>

        <Link
          to="/app/pricing"
          className={hasSubscription ? "sl-btn sl-btn-secondary" : "sl-btn sl-btn-primary"}
          style={{ textDecoration: "none", flexShrink: 0 }}
        >
          {hasSubscription ? "Manage Subscription" : "Upgrade to Pro"}
        </Link>
      </div>

      {/* ── Featured Sections ── */}
      {featuredSections.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
            <h2 className="sl-section-title">Featured Sections</h2>
            <Link to="/app/discover" className="sl-btn sl-btn-ghost sl-btn-sm" style={{ textDecoration: "none" }}>
              View all <ArrowRight />
            </Link>
          </div>

          <div className="sl-grid-3">
            {featuredSections.map((section) => (
              <Link
                key={section.id}
                to={`/app/sections/${section.handle}`}
                className="sl-section-card"
                style={{ textDecoration: "none" }}
              >
                <div className="sl-image-wrap">
                  {section.preview_image_url ? (
                    <img
                      src={section.preview_image_url}
                      alt={section.name}
                      className="sl-section-card-image"
                    />
                  ) : (
                    <div className="sl-section-card-image-placeholder">No Preview</div>
                  )}
                  <div className="sl-badge-overlay">
                    {section.is_free ? (
                      <span className={`sl-badge sl-tier-free`}>Free</span>
                    ) : section.is_exclusive ? (
                      <span className={`sl-badge sl-tier-premium`}>Premium</span>
                    ) : (
                      <span className={`sl-badge sl-tier-pro`}>Pro</span>
                    )}
                  </div>
                </div>

                <div className="sl-section-card-body">
                  <span className="sl-caption">{section.category?.name || "Section"}</span>
                  <span className="sl-card-title">{section.name}</span>
                </div>

                <div className="sl-section-card-footer">
                  <span className="sl-body" style={{ fontWeight: 600 }}>
                    {section.is_free ? "Free" : `$${section.price.toFixed(2)}`}
                  </span>
                  <span className="sl-caption" style={{ color: "var(--sl-text-tertiary)" }}>View →</span>
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
