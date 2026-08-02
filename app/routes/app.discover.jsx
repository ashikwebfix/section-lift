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

  const whereClause = {
    status: "PUBLISHED",
    type: "SECTION",
  };

  if (q) {
    whereClause.OR = [
      { name: { contains: q } },
      { short_description: { contains: q } }
    ];
  }

  if (categoryId) {
    whereClause.category_id = categoryId;
  }

  if (pricing === "free") {
    whereClause.is_free = true;
  } else if (pricing === "paid") {
    whereClause.is_free = false;
  }

  if (tagParam) {
    whereClause.tag = tagParam;
  }

  const [sections, categories, allSectionsForTags] = await Promise.all([
    prisma.section.findMany({
      where: whereClause,
      include: { category: true },
      orderBy: { created_at: "desc" },
    }),
    prisma.category.findMany({
      orderBy: { sort_order: "asc" }
    }),
    prisma.section.findMany({
      where: { status: "PUBLISHED", type: "SECTION" },
      select: { tag: true }
    })
  ]);

  const allTags = [...new Set(allSectionsForTags.map(s => s.tag).filter(Boolean))];

  // Fetch Entitlements
  const entitlements = await prisma.entitlement.findMany({
    where: { shop_domain: session.shop, status: "ACTIVE" },
  });

  // Fetch Themes
  const response = await admin.graphql(
    `#graphql
    query {
      themes(first: 10) {
        edges {
          node {
            id
            name
            role
          }
        }
      }
    }`
  );
  const responseJson = await response.json();
  const themes = responseJson.data.themes.edges.map(edge => edge.node);

  return {
    sections,
    categories,
    allTags,
    filters: { q, category: categoryId, pricing, tag: tagParam },
    entitlements,
    themes,
    shopDomain: session.shop
  };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const sectionId = formData.get("sectionId");

  if (!sectionId) return { success: false, error: "Section ID is required" };

  const section = await prisma.section.findUnique({ 
    where: { id: sectionId },
    include: { versions: { orderBy: { published_at: 'desc' }, take: 1 } }
  });

  if (!section) return { success: false, error: "Section not found" };

  if (intent === "claim_free") {
    if (!section.is_free) return { success: false, error: "Invalid claim request" };

    const existing = await prisma.entitlement.findFirst({
      where: { shop_domain: session.shop, section_id: section.id },
    });

    if (!existing) {
      await prisma.entitlement.create({
        data: {
          shop_domain: session.shop,
          section_id: section.id,
          source_type: "FREE",
          status: "ACTIVE",
        },
      });
    }
    return { success: true, action: "claimed", sectionId };
  }

  if (intent === "remove") {
    await prisma.entitlement.deleteMany({
      where: { shop_domain: session.shop, section_id: section.id }
    });
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
          appPurchaseOneTime {
            id
            status
          }
          confirmationUrl
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          name: chargeName,
          price: { amount: section.price, currencyCode: "USD" },
          returnUrl: returnUrl,
          test: true 
        }
      }
    );
    const json = await response.json();
    const data = json.data?.appPurchaseOneTimeCreate;

    if (data?.userErrors?.length > 0) {
      return { success: false, error: data.userErrors[0].message };
    }

    if (data?.confirmationUrl) {
      return { success: true, action: "purchase_redirect", confirmationUrl: data.confirmationUrl };
    }

    return { success: false, error: "Failed to create purchase charge" };
  }

  if (intent === "install") {
    const themeId = formData.get("themeId");
    if (!section.versions || section.versions.length === 0) return { success: false, error: "Section version not found", sectionName: section.name };

    const activeVersion = section.versions[0];
    const liquidContent = activeVersion.liquid_content || "";

    try {

    const themeResponse = await admin.graphql(
      `#graphql
      query getTheme($id: ID!) {
        theme(id: $id) {
          name
          role
        }
      }`,
      { variables: { id: themeId } }
    );
    const themeJson = await themeResponse.json();
    const themeData = themeJson.data.theme;

    const safeHandle = section.handle.toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
    const filename = `sections/${safeHandle}.liquid`;

    const upsertResponse = await admin.graphql(
      `#graphql
      mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
        themeFilesUpsert(themeId: $themeId, files: $files) {
          upsertedThemeFiles {
            filename
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          themeId: themeId,
          files: [{ filename, body: { type: "TEXT", value: liquidContent } }],
        },
      }
    );
      const upsertJson = await upsertResponse.json();
      const userErrors = upsertJson.data?.themeFilesUpsert?.userErrors;

      if (userErrors && userErrors.length > 0) {
        console.error("Theme Upsert User Error:", userErrors);
        return { success: false, error: userErrors[0].message, sectionName: section.name };
      }

      await prisma.installation.create({
        data: {
          shop_domain: session.shop,
          section_id: section.id,
          section_version_id: activeVersion.id,
          theme_id: themeId,
          theme_name: themeData?.name || "Unknown",
          theme_role: themeData?.role || "Unknown",
          filename: filename,
          status: "ACTIVE"
        }
      });

      return { success: true, action: "installed", themeId, sectionName: section.name };
    } catch (err) {
      console.error("Install action error:", err);
      return { success: false, error: `Installation failed: ${err.message || "An unexpected error occurred"}`, sectionName: section.name };
    }
  }

  return { success: false };
};

export default function Discover() {
  const { sections, categories, allTags, filters, entitlements, themes, shopDomain } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();
  const fetcher = useFetcher();

  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedThemeId, setSelectedThemeId] = useState("");

  const handleFilterChange = (key, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, value);
    } else {
      newParams.delete(key);
    }
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

  const isOwned = selectedSection ? entitlements.some(e => e.section_id === selectedSection.id) : false;
  const installedThemeId = (fetcher.data?.action === "installed" && fetcher.data?.sectionName === selectedSection?.name) ? fetcher.data.themeId : null;

  const handleClaim = () => {
    fetcher.submit({ intent: "claim_free", sectionId: selectedSection.id }, { method: "post" });
  };

  const handlePurchase = () => {
    fetcher.submit({ intent: "purchase", sectionId: selectedSection.id }, { method: "post" });
  };

  const handleInstall = () => {
    if (!selectedThemeId) return;
    fetcher.submit({ intent: "install", sectionId: selectedSection.id, themeId: selectedThemeId }, { method: "post" });
  };

  const handleCloseModal = () => {
    setSelectedSection(null);
    setSelectedThemeId("");
  };

  const handleRemove = () => {
    if (window.confirm("Are you sure you want to remove this section from your library?")) {
      fetcher.submit({ intent: "remove", sectionId: selectedSection.id }, { method: "post" });
    }
  };

  return (
    <div className="efx-flex efx-flex-col efx-gap-lg" style={{ padding: '32px', position: 'relative' }}>
      <div className="efx-flex efx-flex-col efx-gap-sm">
        <h1 className="efx-heading-xl">Discover Sections</h1>
        <p className="efx-text-body">
          Browse our collection of high-quality, native Shopify sections. 
          Install them directly into your theme to customize your store instantly.
        </p>
      </div>

      {/* Filters */}
      <div className="efx-glass-card efx-flex efx-flex-row efx-gap-md efx-items-center" style={{ padding: '16px 24px' }}>
        <input 
          type="text" 
          placeholder="Search sections..." 
          value={filters.q}
          onChange={(e) => handleFilterChange("q", e.target.value)}
          className="efx-input"
          style={{ flexGrow: 1 }}
        />
        <select 
          value={filters.categoryId} 
          onChange={(e) => handleFilterChange("category", e.target.value)}
          className="efx-input"
          style={{ width: '200px' }}
        >
          <option value="">All Categories</option>
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select 
          value={filters.pricing} 
          onChange={(e) => handleFilterChange("pricing", e.target.value)}
          className="efx-input"
          style={{ width: '150px' }}
        >
          <option value="">All Prices</option>
          <option value="free">Free</option>
          <option value="paid">Premium</option>
        </select>
      </div>

      {allTags && allTags.length > 0 && (
        <div className="efx-flex efx-flex-row efx-gap-sm" style={{ flexWrap: 'wrap', marginTop: '-8px' }}>
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => handleFilterChange("tag", filters.tag === tag ? "" : tag)}
              className={`efx-button ${filters.tag === tag ? 'efx-button-primary' : ''}`}
              style={{ padding: '4px 12px', fontSize: '0.85rem' }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {sections.length === 0 ? (
        <div className="efx-solid-card" style={{ textAlign: 'center', padding: '48px' }}>
          <p className="efx-text-subdued">No sections found matching your criteria.</p>
        </div>
      ) : (
        <div className="efx-grid-3">
          {sections.map((section) => (
            <div key={section.id} className={`efx-glass-card efx-glass-card-interactive efx-flex efx-flex-col ${section.is_exclusive ? 'efx-premium-card' : ''}`}>
              <div style={{ height: '180px', marginBottom: '16px', backgroundColor: '#e4e5e7', position: 'relative', borderRadius: 'var(--efx-radius-md)', overflow: 'hidden' }}>
                {section.preview_image_url ? (
                  <img src={section.preview_image_url} alt={section.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div className="efx-flex efx-items-center efx-justify-center" style={{ height: '100%', color: '#8c9196' }}>No Preview</div>
                )}
                <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '8px' }}>
                  {section.is_free ? (
                    <span style={{ background: '#10b981', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>Free</span>
                  ) : section.is_exclusive ? (
                    <span className="efx-badge-premium" style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>Premium</span>
                  ) : (
                    <span style={{ background: '#202223', color: 'white', padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 600 }}>Pro</span>
                  )}
                </div>
              </div>
              
              <div className="efx-flex efx-flex-col efx-gap-sm" style={{ flexGrow: 1 }}>
                <div>
                  <span className="efx-badge">{section.category?.name}</span>
                  <h3 className="efx-heading-lg" style={{fontSize: '1.25rem', marginBottom: '4px'}}>{section.name}</h3>
                </div>
                
                <p className="efx-text-subdued" style={{ flexGrow: 1, marginBottom: '16px' }}>
                  {section.short_description}
                </p>

                <div className="efx-flex efx-flex-row efx-justify-between efx-items-center">
                  <span className="efx-heading-md" style={{margin: 0}}>
                    {section.is_free ? "Free" : `$${section.price.toFixed(2)}`}
                  </span>
                  <button onClick={() => setSelectedSection(section)} className="efx-button efx-button-primary">
                    View details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Overlay */}
      {selectedSection && (
        <div 
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
          }}
          onClick={handleCloseModal}
        >
          <div 
            className="efx-glass-card" 
            style={{ maxWidth: '1000px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '0', display: 'flex', flexWrap: 'wrap', overflow: 'hidden' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Left side: Image */}
            <div style={{ flex: '1 1 400px', minHeight: '400px', position: 'relative', backgroundColor: 'var(--efx-color-border)' }}>
              {selectedSection.preview_image_url ? (
                <img src={selectedSection.preview_image_url} alt={selectedSection.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0 }} />
              ) : (
                <div className="efx-preview-skeleton" style={{ width: '100%', height: '100%', position: 'absolute' }}>
                  <span className="efx-text-subdued">No Preview</span>
                </div>
              )}
            </div>

            {/* Right side: Content */}
            <div style={{ flex: '1 1 400px', padding: '32px', display: 'flex', flexDirection: 'column' }}>
              <div className="efx-flex efx-justify-between efx-items-start efx-mb-md">
                <div>
                  <span className="efx-badge">{selectedSection.category?.name}</span>
                  <h2 className="efx-heading-xl efx-mt-sm" style={{margin:0}}>{selectedSection.name}</h2>
                </div>
                <button className="efx-button" onClick={handleCloseModal}>Close</button>
              </div>

              <p className="efx-text-body efx-mb-lg" style={{ fontSize: '1.1rem', flexGrow: 1 }}>
                {selectedSection.full_description || selectedSection.short_description}
              </p>
              
              <div className="efx-solid-card efx-flex efx-flex-col efx-gap-md" style={{ padding: '24px', marginTop: 'auto' }}>
               {fetcher.data?.error && (
                 <div style={{ padding: '12px', backgroundColor: 'var(--efx-color-error)', color: '#fff', borderRadius: '4px' }}>
                   {fetcher.data.error}
                 </div>
               )}

               {installedThemeId ? (
                 <div className="efx-flex efx-flex-col efx-gap-sm efx-items-center" style={{ textAlign: 'center' }}>
                   <h3 className="efx-heading-lg" style={{ color: 'var(--efx-color-success)', margin: 0 }}>Installed Successfully!</h3>
                   <p className="efx-text-body" style={{ margin: 0 }}>The section has been added to your theme.</p>
                   <a 
                     href={`https://${shopDomain}/admin/themes/${installedThemeId.split("/").pop()}/editor`} 
                     target="_blank" 
                     rel="noopener noreferrer" 
                     className="efx-button efx-button-primary efx-mt-sm"
                   >
                     Go to Theme Editor
                   </a>
                 </div>
               ) : isOwned ? (
                 <div className="efx-flex efx-flex-col efx-gap-sm">
                   <h3 className="efx-heading-md" style={{margin:0}}>Install to Theme</h3>
                   <div className="efx-flex efx-gap-sm">
                     <select 
                       className="efx-input" 
                       value={selectedThemeId} 
                       onChange={(e) => setSelectedThemeId(e.target.value)}
                       style={{ flexGrow: 1 }}
                     >
                       <option value="">Select a theme...</option>
                       {themes.map(t => (
                         <option key={t.id} value={t.id}>
                           {t.name} ({t.role})
                         </option>
                       ))}
                     </select>
                     <button 
                       className="efx-button efx-button-primary" 
                       onClick={handleInstall}
                       disabled={!selectedThemeId || isInstalling}
                     >
                       {isInstalling ? 'Installing...' : 'Install'}
                     </button>
                   </div>
                   <div style={{ marginTop: '16px', textAlign: 'center' }}>
                     <button 
                       onClick={handleRemove} 
                       disabled={isRemoving}
                       style={{ background: 'none', border: 'none', color: 'var(--efx-color-error)', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.9rem' }}
                     >
                       {isRemoving ? 'Removing...' : 'Remove from Library'}
                     </button>
                   </div>
                 </div>
               ) : (
                 <div className="efx-flex efx-justify-between efx-items-center">
                   <div>
                     <h3 className="efx-heading-lg" style={{margin:0}}>
                       {selectedSection.is_free ? "Free Section" : `$${selectedSection.price.toFixed(2)}`}
                     </h3>
                     <p className="efx-text-subdued" style={{margin:0}}>One-time purchase, yours forever.</p>
                   </div>
                   {selectedSection.is_free ? (
                     <button className="efx-button efx-button-primary" onClick={handleClaim} disabled={isClaiming}>
                       {isClaiming ? 'Claiming...' : 'Claim Free Section'}
                     </button>
                   ) : (
                     <button className="efx-button efx-button-primary" onClick={handlePurchase} disabled={isPurchasing}>
                       {isPurchasing ? 'Processing...' : 'Purchase Section'}
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
