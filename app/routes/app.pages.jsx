import { useLoaderData, useSearchParams, Link, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") || "";
  const categoryId = url.searchParams.get("category") || "";
  const pricing = url.searchParams.get("pricing") || "";
  const tagParam = url.searchParams.get("tag") || "";

  const whereClause = { status: "PUBLISHED", type: "PAGE" };

  if (q) {
    whereClause.OR = [
      { name: { contains: q } },
      { short_description: { contains: q } },
    ];
  }
  if (categoryId) whereClause.category_id = categoryId;
  if (pricing === "free") whereClause.is_free = true;
  else if (pricing === "paid") whereClause.is_free = false;
  if (tagParam) whereClause.tag = { contains: tagParam };

  const [sections, categories, allSectionsForTags] = await Promise.all([
    prisma.section.findMany({
      where: whereClause,
      include: { category: true },
      orderBy: { created_at: "desc" },
    }),
    prisma.category.findMany({ orderBy: { sort_order: "asc" } }),
    prisma.section.findMany({
      where: { status: "PUBLISHED", type: "PAGE" },
      select: { tag: true },
    }),
  ]);

  const allTags = [
    ...new Set(
      allSectionsForTags
        .flatMap((s) => (s.tag ? s.tag.split(",").map((t) => t.trim()) : []))
        .filter(Boolean)
    ),
  ];

  const entitlements = await prisma.entitlement.findMany({
    where: { shop_domain: session.shop, status: "ACTIVE" },
  });

  const response = await admin.graphql(`#graphql
    query { themes(first: 10) { edges { node { id name role } } } }`);
  const responseJson = await response.json();
  const themes = responseJson.data.themes.edges.map((edge) => edge.node);

  return { sections, categories, allTags, filters: { q, category: categoryId, pricing, tag: tagParam }, entitlements, themes, shopDomain: session.shop };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const sectionId = formData.get("sectionId");

  if (!sectionId) return { success: false, error: "Section ID is required" };

  const section = await prisma.section.findUnique({
    where: { id: sectionId },
    include: { versions: { orderBy: { published_at: "desc" }, take: 1 } },
  });
  if (!section) return { success: false, error: "Section not found" };

  if (intent === "claim_free") {
    if (!section.is_free) return { success: false, error: "Invalid claim request" };
    const existing = await prisma.entitlement.findFirst({ where: { shop_domain: session.shop, section_id: section.id } });
    if (!existing) {
      await prisma.entitlement.create({
        data: { shop_domain: session.shop, section_id: section.id, source_type: "FREE", status: "ACTIVE" },
      });
    }
    return { success: true, action: "claimed", sectionId };
  }

  if (intent === "remove") {
    await prisma.entitlement.deleteMany({ where: { shop_domain: session.shop, section_id: section.id } });
    return { success: true, action: "removed", sectionId };
  }

  if (intent === "purchase") {
    if (section.is_free) return { success: false, error: "Section is free" };
    const returnUrl = `https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app/purchase-callback?section_id=${section.id}`;
    const chargeName = `EFX_SECTION_${section.handle}`;
    const response = await admin.graphql(
      `#graphql
      mutation AppPurchaseOneTimeCreate($name: String!, $price: MoneyInput!, $returnUrl: URL!, $test: Boolean) {
        appPurchaseOneTimeCreate(name: $name, price: $price, returnUrl: $returnUrl, test: $test) {
          appPurchaseOneTime { id status }
          confirmationUrl
          userErrors { field message }
        }
      }`,
      { variables: { name: chargeName, price: { amount: section.price, currencyCode: "USD" }, returnUrl, test: true } }
    );
    const json = await response.json();
    const data = json.data?.appPurchaseOneTimeCreate;
    if (data?.userErrors?.length > 0) return { success: false, error: data.userErrors[0].message };
    if (data?.confirmationUrl) return { success: true, action: "purchase_redirect", confirmationUrl: data.confirmationUrl };
    return { success: false, error: "Failed to create purchase charge" };
  }

  if (intent === "install") {
    const themeId = formData.get("themeId");
    if (!section.versions || section.versions.length === 0) return { success: false, error: "Section version not found", sectionName: section.name };
    const activeVersion = section.versions[0];
    const liquidContent = activeVersion.liquid_content || "";
    try {
      const themeResponse = await admin.graphql(
        `#graphql query getTheme($id: ID!) { theme(id: $id) { name role } }`,
        { variables: { id: themeId } }
      );
      const themeJson = await themeResponse.json();
      const themeData = themeJson.data.theme;
      const safeHandle = section.handle.toLowerCase().replace(/[^a-z0-9_-]/g, "-").replace(/-+/g, "-");
      const filename = `sections/${safeHandle}.liquid`;
      const upsertResponse = await admin.graphql(
        `#graphql
        mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
          themeFilesUpsert(themeId: $themeId, files: $files) {
            upsertedThemeFiles { filename }
            userErrors { field message }
          }
        }`,
        { variables: { themeId, files: [{ filename, body: { type: "TEXT", value: liquidContent } }] } }
      );
      const upsertJson = await upsertResponse.json();
      const userErrors = upsertJson.data?.themeFilesUpsert?.userErrors;
      if (userErrors && userErrors.length > 0) return { success: false, error: userErrors[0].message, sectionName: section.name };
      await prisma.installation.create({
        data: {
          shop_domain: session.shop, section_id: section.id, section_version_id: activeVersion.id,
          theme_id: themeId, theme_name: themeData?.name || "Unknown", theme_role: themeData?.role || "Unknown",
          filename, status: "ACTIVE",
        },
      });
      return { success: true, action: "installed", themeId, sectionName: section.name };
    } catch (err) {
      return { success: false, error: `Installation failed: ${err.message || "An unexpected error occurred"}`, sectionName: section.name };
    }
  }

  return { success: false };
};

const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", opacity: 0.4, pointerEvents: "none" }}>
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
);

const XIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
);

const CheckCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
  </svg>
);

export default function Pages() {
  const { sections, categories, allTags, filters, entitlements, themes, shopDomain } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher();

  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedThemeId, setSelectedThemeId] = useState("");

  const handleFilterChange = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    value ? newParams.set(key, value) : newParams.delete(key);
    setSearchParams(newParams);
  };

  const isClaiming = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "claim_free";
  const isPurchasing = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "purchase";
  const isInstalling = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "install";
  const isRemoving = fetcher.state !== "idle" && fetcher.formData?.get("intent") === "remove";

  useEffect(() => {
    if (fetcher.data?.success && fetcher.data?.action === "purchase_redirect" && fetcher.data.confirmationUrl) {
      window.top.location.href = fetcher.data.confirmationUrl;
    }
  }, [fetcher.data]);

  const isOwned = selectedSection ? entitlements.some((e) => e.section_id === selectedSection.id) : false;
  const installedThemeId =
    fetcher.data?.action === "installed" && fetcher.data?.sectionName === selectedSection?.name
      ? fetcher.data.themeId
      : null;

  const handleClaim = () => fetcher.submit({ intent: "claim_free", sectionId: selectedSection.id }, { method: "post" });
  const handlePurchase = () => fetcher.submit({ intent: "purchase", sectionId: selectedSection.id }, { method: "post" });
  const handleInstall = () => {
    if (!selectedThemeId) return;
    fetcher.submit({ intent: "install", sectionId: selectedSection.id, themeId: selectedThemeId }, { method: "post" });
  };
  const handleCloseModal = () => { setSelectedSection(null); setSelectedThemeId(""); };
  const handleRemove = () => {
    if (window.confirm("Remove this page from your library?")) {
      fetcher.submit({ intent: "remove", sectionId: selectedSection.id }, { method: "post" });
    }
  };

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>

      {/* ── Header ── */}
      <div>
        <h1 className="sl-page-title">Browse Pages</h1>
        <p className="sl-body sl-mt-1">
          High-quality native Shopify pages — install directly into your theme.
        </p>
      </div>

      {/* ── Filter Bar ── */}
      <div className="sl-filter-bar">
        <div style={{ position: "relative", flex: 1, minWidth: "180px" }}>
          <SearchIcon />
          <input
            type="text"
            placeholder="Search pages..."
            value={filters.q}
            onChange={(e) => handleFilterChange("q", e.target.value)}
            className="sl-input"
            style={{ paddingLeft: "34px" }}
          />
        </div>

        <select
          value={filters.category}
          onChange={(e) => handleFilterChange("category", e.target.value)}
          className="sl-select"
          style={{ width: "180px", flexShrink: 0 }}
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={filters.pricing}
          onChange={(e) => handleFilterChange("pricing", e.target.value)}
          className="sl-select"
          style={{ width: "140px", flexShrink: 0 }}
        >
          <option value="">All Prices</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </select>

        {(filters.q || filters.category || filters.pricing || filters.tag) && (
          <button
            onClick={() => setSearchParams({})}
            className="sl-btn sl-btn-ghost sl-btn-sm"
            style={{ flexShrink: 0 }}
          >
            <XIcon /> Clear
          </button>
        )}
      </div>

      {/* ── Tag Chips ── */}
      {allTags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => handleFilterChange("tag", filters.tag === tag ? "" : tag)}
              className={`sl-chip ${filters.tag === tag ? "sl-chip-active" : ""}`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* ── Results ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="sl-caption">{sections.length} {sections.length === 1 ? "result" : "results"}</span>
      </div>

      {sections.length === 0 ? (
        <div className="sl-card sl-card-body">
          <div className="sl-empty-state">
            <div className="sl-empty-state-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </div>
            <p className="sl-body" style={{ fontWeight: 500 }}>No pages match your filters</p>
            <p className="sl-caption">Try adjusting your search or removing a filter.</p>
          </div>
        </div>
      ) : (
        <div className="sl-grid-3">
          {sections.map((section) => (
            <div
              key={section.id}
              className="sl-section-card"
              onClick={() => setSelectedSection(section)}
            >
              <div className="sl-image-wrap">
                {section.preview_image_url ? (
                  <img src={section.preview_image_url} alt={section.name} className="sl-section-card-image" />
                ) : (
                  <div className="sl-section-card-image-placeholder">No Preview</div>
                )}
                <div className="sl-badge-overlay">
                  {section.is_free ? (
                    <span className="sl-badge sl-tier-free">Free</span>
                  ) : section.is_exclusive ? (
                    <span className="sl-badge sl-tier-premium">Premium</span>
                  ) : (
                    <span className="sl-badge sl-tier-pro">Pro</span>
                  )}
                </div>
              </div>

              <div className="sl-section-card-body">
                <span className="sl-caption">{section.category?.name || "Page"}</span>
                <span className="sl-card-title">{section.name}</span>
                {section.short_description && (
                  <p className="sl-caption sl-truncate" style={{ WebkitLineClamp: 2, WebkitBoxOrient: "vertical", display: "-webkit-box", overflow: "hidden", whiteSpace: "normal" }}>
                    {section.short_description}
                  </p>
                )}
              </div>

              <div className="sl-section-card-footer">
                <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--sl-text-primary)" }}>
                  {section.is_free ? "Free" : `$${section.price.toFixed(2)}`}
                </span>
                <span className="sl-btn sl-btn-secondary sl-btn-sm" style={{ pointerEvents: "none" }}>View</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Detail Modal ── */}
      {selectedSection && (
        <div className="sl-modal-backdrop" onClick={handleCloseModal}>
          <div className="sl-modal" onClick={(e) => e.stopPropagation()}>

            {/* Left: Image */}
            <div style={{
              flex: "1 1 380px", minHeight: "360px",
              background: "var(--sl-surface-sunken)",
              display: "flex", alignItems: "center", justifyContent: "center",
              position: "relative", overflow: "hidden",
            }}>
              {selectedSection.preview_image_url ? (
                <img
                  src={selectedSection.preview_image_url}
                  alt={selectedSection.name}
                  style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0 }}
                />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", color: "var(--sl-text-tertiary)" }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  <span className="sl-caption">No preview available</span>
                </div>
              )}
            </div>

            {/* Right: Content */}
            <div style={{ flex: "1 1 380px", display: "flex", flexDirection: "column", maxHeight: "88vh", overflowY: "auto" }}>
              <div style={{ padding: "28px", flex: 1 }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px", marginBottom: "16px" }}>
                  <div>
                    <span className="sl-badge sl-badge-default sl-mb-2" style={{ display: "inline-flex", marginBottom: "8px" }}>
                      {selectedSection.category?.name || "Page"}
                    </span>
                    <h2 style={{ fontSize: "18px", fontWeight: 650, letterSpacing: "-0.02em", color: "var(--sl-text-primary)", margin: 0 }}>
                      {selectedSection.name}
                    </h2>
                  </div>
                  <button
                    className="sl-btn sl-btn-ghost sl-btn-sm"
                    onClick={handleCloseModal}
                    style={{ flexShrink: 0 }}
                    aria-label="Close"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>

                <p className="sl-body" style={{ lineHeight: 1.7 }}>
                  {selectedSection.full_description || selectedSection.short_description}
                </p>
              </div>

              {/* Sticky Action Footer */}
              <div style={{
                padding: "20px 28px",
                borderTop: "1px solid var(--sl-border)",
                background: "var(--sl-surface)",
                position: "sticky", bottom: 0, zIndex: 10,
              }}>
                {fetcher.data?.error && (
                  <div className="sl-alert sl-alert-error sl-mb-3">
                    {fetcher.data.error}
                  </div>
                )}

                {installedThemeId ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", textAlign: "center" }}>
                    <div style={{ color: "var(--sl-success)", display: "flex", alignItems: "center", gap: "8px" }}>
                      <CheckCircle />
                      <span style={{ fontWeight: 600, fontSize: "14px" }}>Installed Successfully</span>
                    </div>
                    <a
                      href={`https://${shopDomain}/admin/themes/${installedThemeId.split("/").pop()}/editor`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="sl-btn sl-btn-primary"
                    >
                      Open Theme Editor →
                    </a>
                  </div>
                ) : isOwned ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <span className="sl-label-text">Install to Theme</span>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <select
                        className="sl-select"
                        value={selectedThemeId}
                        onChange={(e) => setSelectedThemeId(e.target.value)}
                        style={{ flex: 1 }}
                      >
                        <option value="">Select a theme...</option>
                        {themes.map((t) => (
                          <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                        ))}
                      </select>
                      <button
                        className="sl-btn sl-btn-primary"
                        onClick={handleInstall}
                        disabled={!selectedThemeId || isInstalling}
                      >
                        {isInstalling ? "Installing..." : "Install"}
                      </button>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <button
                        onClick={handleRemove}
                        disabled={isRemoving}
                        className="sl-btn sl-btn-ghost sl-btn-sm"
                        style={{ color: "var(--sl-error)" }}
                      >
                        {isRemoving ? "Removing..." : "Remove from Library"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
                    <div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--sl-text-primary)" }}>
                        {selectedSection.is_free ? "Free" : `$${selectedSection.price.toFixed(2)}`}
                      </div>
                      {!selectedSection.is_free && (
                        <span className="sl-caption">One-time purchase, yours forever</span>
                      )}
                    </div>
                    {selectedSection.is_free ? (
                      <button className="sl-btn sl-btn-primary" onClick={handleClaim} disabled={isClaiming}>
                        {isClaiming ? "Claiming..." : "Claim Free Page"}
                      </button>
                    ) : (
                      <button className="sl-btn sl-btn-primary" onClick={handlePurchase} disabled={isPurchasing}>
                        {isPurchasing ? "Processing..." : "Purchase Page"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
