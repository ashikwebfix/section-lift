import { useEffect, useState } from "react";
import { useLoaderData, useFetcher, Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);

  const entitlements = await prisma.entitlement.findMany({
    where: { shop_domain: session.shop, status: "ACTIVE" },
    include: { section: true },
  });

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

  return { entitlements, themes };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "install") {
    const themeId = formData.get("themeId");
    const sectionId = formData.get("sectionId");

    const section = await prisma.section.findUnique({ 
      where: { id: sectionId },
      include: { versions: { orderBy: { published_at: 'desc' }, take: 1 } }
    });
    if (!section || section.versions.length === 0) return { success: false, error: "Section or version not found" };

    const activeVersion = section.versions[0];
    const liquidContent = activeVersion.liquid_content || "";

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

    const filename = `sections/${section.handle}.liquid`;

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
    const userErrors = upsertJson.data.themeFilesUpsert.userErrors;

    if (userErrors && userErrors.length > 0) {
      return { success: false, error: userErrors[0].message };
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

    return { success: true, sectionName: section.name };
  }

  if (intent === "remove") {
    const sectionId = formData.get("sectionId");
    if (!sectionId) return { success: false, error: "Section ID is required" };
    
    await prisma.entitlement.deleteMany({
      where: { shop_domain: session.shop, section_id: sectionId }
    });
    return { success: true, action: "removed", sectionId };
  }

  return { success: false };
};

export default function MySections() {
  const { entitlements, themes } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();

  const [selectedThemes, setSelectedThemes] = useState({});
  const [activeTab, setActiveTab] = useState("SECTION");

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data?.action === "removed") {
        shopify.toast.show("Removed from library");
      } else {
        shopify.toast.show(`${fetcher.data.sectionName} installed successfully!`);
      }
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const handleThemeChange = (sectionId, themeId) => {
    setSelectedThemes({...selectedThemes, [sectionId]: themeId});
  };

  const handleInstall = (sectionId) => {
    const themeId = selectedThemes[sectionId];
    if (!themeId) {
      shopify.toast.show("Please select a theme first.", { isError: true });
      return;
    }
    fetcher.submit({ intent: "install", sectionId, themeId }, { method: "post" });
  };

  const handleRemove = (sectionId) => {
    if (window.confirm("Are you sure you want to remove this from your library?")) {
      fetcher.submit({ intent: "remove", sectionId }, { method: "post" });
    }
  };

  const sectionEntitlements = entitlements.filter(e => (e.section?.type || "SECTION") === "SECTION");
  const pageEntitlements = entitlements.filter(e => e.section?.type === "PAGE");
  const filtered = activeTab === "SECTION" ? sectionEntitlements : pageEntitlements;

  return (
    <div className="efx-flex efx-flex-col efx-gap-md" style={{ padding: '24px' }}>
      <h1 className="efx-heading-xl" style={{ margin: 0 }}>My Library</h1>

      {/* Tabs */}
      <div className="efx-flex efx-gap-xs" style={{ borderBottom: '1px solid var(--efx-border-solid)' }}>
        <button
          onClick={() => setActiveTab("SECTION")}
          style={{
            padding: '10px 20px',
            fontSize: '0.9rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === "SECTION" ? '2px solid #111827' : '2px solid transparent',
            color: activeTab === "SECTION" ? '#111827' : '#6b7280',
            transition: 'all 0.2s ease',
          }}
        >
          Sections ({sectionEntitlements.length})
        </button>
        <button
          onClick={() => setActiveTab("PAGE")}
          style={{
            padding: '10px 20px',
            fontSize: '0.9rem',
            fontWeight: 600,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            borderBottom: activeTab === "PAGE" ? '2px solid #111827' : '2px solid transparent',
            color: activeTab === "PAGE" ? '#111827' : '#6b7280',
            transition: 'all 0.2s ease',
          }}
        >
          Pages ({pageEntitlements.length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="efx-solid-card efx-flex efx-flex-col efx-items-center efx-gap-sm" style={{ padding: '40px 24px', textAlign: 'center' }}>
          <h2 className="efx-heading-lg" style={{ margin: 0 }}>No {activeTab === "SECTION" ? "sections" : "pages"} yet</h2>
          <p className="efx-text-subdued" style={{ maxWidth: '360px' }}>
            Browse the {activeTab === "SECTION" ? "Sections" : "Pages"} page to find and add your first one.
          </p>
          <Link to={activeTab === "SECTION" ? "/app/discover" : "/app/pages"} className="efx-button efx-button-primary" style={{ textDecoration: 'none' }}>
            Browse {activeTab === "SECTION" ? "Sections" : "Pages"}
          </Link>
        </div>
      ) : (
        <div className="efx-flex efx-flex-col efx-gap-sm">
          {filtered.map((entitlement) => {
            const section = entitlement.section;
            return (
              <div key={entitlement.id} className="efx-solid-card efx-flex efx-items-center efx-gap-md" style={{ padding: '12px 16px' }}>
                {/* Thumbnail */}
                <div style={{ width: '56px', height: '56px', borderRadius: 'var(--efx-radius-sm)', overflow: 'hidden', flexShrink: 0, background: '#e5e7eb' }}>
                  {section.preview_image_url ? (
                    <img src={section.preview_image_url} alt={section.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '10px' }}>N/A</div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="efx-text-body" style={{ fontWeight: 600, margin: 0, fontSize: '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{section.name}</div>
                  <div className="efx-text-subdued" style={{ fontSize: '0.8rem' }}>
                    {entitlement.source_type === "FREE" ? "Free" : entitlement.source_type === "SUBSCRIPTION" ? "Subscription" : "Purchased"} · {new Date(entitlement.granted_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Theme select + actions */}
                <div className="efx-flex efx-items-center efx-gap-sm" style={{ flexShrink: 0 }}>
                  <select 
                    className="efx-input" 
                    value={selectedThemes[section.id] || ""} 
                    onChange={(e) => handleThemeChange(section.id, e.target.value)}
                    style={{ width: '180px', padding: '8px 10px', fontSize: '0.85rem' }}
                  >
                    <option value="">Select theme...</option>
                    {themes.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                    ))}
                  </select>
                  <button 
                    className="efx-button efx-button-primary" 
                    onClick={() => handleInstall(section.id)}
                    disabled={!selectedThemes[section.id] || fetcher.state !== "idle"}
                    style={{ padding: '8px 16px', fontSize: '0.85rem' }}
                  >
                    Install
                  </button>
                  <button 
                    className="efx-button"
                    onClick={() => handleRemove(section.id)}
                    disabled={fetcher.state !== "idle"}
                    style={{ padding: '8px 12px', fontSize: '0.85rem', color: '#ef4444', background: 'transparent', border: '1px solid #fecaca' }}
                    title="Remove from Library"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
