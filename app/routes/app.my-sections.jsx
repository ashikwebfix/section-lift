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
      const themeData = themeJson.data?.theme;

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
      const userErrors = upsertJson.data?.themeFilesUpsert?.userErrors;

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
    } catch (err) {
      console.error("Install action error:", err);
      return { success: false, error: `Installation failed: ${err.message || "An unexpected error occurred"}` };
    }
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
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
      <h1 className="sl-page-title">My Library</h1>

      {/* Tabs */}
      <div className="sl-tabs">
        <button
          onClick={() => setActiveTab("SECTION")}
          className={`sl-tab ${activeTab === "SECTION" ? "sl-tab-active" : ""}`}
        >
          Sections ({sectionEntitlements.length})
        </button>
        <button
          onClick={() => setActiveTab("PAGE")}
          className={`sl-tab ${activeTab === "PAGE" ? "sl-tab-active" : ""}`}
        >
          Pages ({pageEntitlements.length})
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="sl-card sl-card-body">
          <div className="sl-empty-state">
            <div className="sl-empty-state-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <h2 className="sl-section-title">No {activeTab === "SECTION" ? "sections" : "pages"} yet</h2>
            <p className="sl-caption" style={{ maxWidth: "360px" }}>
              Browse the catalog to find and add your first {activeTab === "SECTION" ? "section" : "page"}.
            </p>
            <Link to={activeTab === "SECTION" ? "/app/discover" : "/app/pages"} className="sl-btn sl-btn-primary sl-mt-4">
              Browse {activeTab === "SECTION" ? "Sections" : "Pages"}
            </Link>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filtered.map((entitlement) => {
            const section = entitlement.section;
            return (
              <div key={entitlement.id} className="sl-card" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "20px" }}>
                
                {/* Thumbnail */}
                <div style={{ width: "64px", height: "64px", borderRadius: "var(--sl-radius-sm)", overflow: "hidden", flexShrink: 0, background: "var(--sl-surface-sunken)" }}>
                  {section.preview_image_url ? (
                    <img src={section.preview_image_url} alt={section.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--sl-text-tertiary)", fontSize: "10px" }}>No Prev</div>
                  )}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="sl-card-title sl-truncate">{section.name}</div>
                  <div className="sl-caption sl-mt-1">
                    {entitlement.source_type === "FREE" ? "Free" : entitlement.source_type === "SUBSCRIPTION" ? "Subscription" : "Purchased"} 
                    <span style={{ margin: "0 6px", opacity: 0.5 }}>•</span> 
                    {new Date(entitlement.granted_at).toLocaleDateString()}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
                  <select 
                    className="sl-select" 
                    value={selectedThemes[section.id] || ""} 
                    onChange={(e) => handleThemeChange(section.id, e.target.value)}
                    style={{ width: "180px", padding: "6px 10px", fontSize: "12px" }}
                  >
                    <option value="">Select theme...</option>
                    {themes.map(t => (
                      <option key={t.id} value={t.id}>{t.name} ({t.role})</option>
                    ))}
                  </select>
                  <button 
                    className="sl-btn sl-btn-primary sl-btn-sm" 
                    onClick={() => handleInstall(section.id)}
                    disabled={!selectedThemes[section.id] || fetcher.state !== "idle"}
                  >
                    Install
                  </button>
                  <button 
                    className="sl-btn sl-btn-ghost sl-btn-sm"
                    onClick={() => handleRemove(section.id)}
                    disabled={fetcher.state !== "idle"}
                    style={{ color: "var(--sl-error)", padding: "6px" }}
                    title="Remove from Library"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
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
