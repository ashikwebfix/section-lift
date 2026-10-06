import { useState, useEffect } from "react";
import { useLoaderData, useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const installations = await prisma.installation.findMany({
    where: { shop_domain: session.shop, status: "ACTIVE" },
    include: { 
      section: {
        include: { versions: { orderBy: { published_at: "desc" }, take: 1 } }
      },
      section_version: true
    },
    orderBy: { installed_at: "desc" }
  });

  return { installations };
};

export const action = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const installationId = formData.get("installationId");

  const installation = await prisma.installation.findUnique({
    where: { id: installationId },
    include: { section: true, section_version: true }
  });

  if (!installation) return { success: false, error: "Installation not found" };

  if (intent === "scan") {
    const response = await admin.graphql(
      `#graphql
      query getThemeFile($themeId: ID!, $filenames: [String!]!) {
        theme(id: $themeId) {
          files(first: 1, filenames: $filenames) {
            edges {
              node {
                filename
                body {
                  ... on OnlineStoreThemeFileBodyText {
                    content
                  }
                }
              }
            }
          }
        }
      }`,
      {
        variables: {
          themeId: installation.theme_id,
          filenames: [installation.filename]
        }
      }
    );
    
    const json = await response.json();
    const edges = json.data?.theme?.files?.edges || [];

    if (edges.length === 0) {
      return { success: true, status: "MISSING", installationId };
    }

    const liveContent = edges[0].node.body?.content;

    const expectedContent = installation.section_version?.liquid_content || "";

    if (liveContent === expectedContent) {
      return { success: true, status: "UNCHANGED", installationId };
    } else {
      return { success: true, status: "MODIFIED", installationId };
    }
  }

  if (intent === "repair" || intent === "update_overwrite") {
    let expectedContent = "";
    let versionIdToSet = installation.section_version_id;

    if (intent === "repair") {
      expectedContent = installation.section_version?.liquid_content || "";
    } else {
      const latestVersion = await prisma.sectionVersion.findFirst({
        where: { section_id: installation.section_id },
        orderBy: { published_at: "desc" }
      });
      expectedContent = latestVersion?.liquid_content || "";
      versionIdToSet = latestVersion.id;
    }

    const upsertResponse = await admin.graphql(
      `#graphql
      mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
        themeFilesUpsert(themeId: $themeId, files: $files) {
          userErrors { message }
        }
      }`,
      {
        variables: {
          themeId: installation.theme_id,
          files: [{ filename: installation.filename, body: { type: "TEXT", value: expectedContent } }],
        },
      }
    );
    const json = await upsertResponse.json();
    if (json.data?.themeFilesUpsert?.userErrors?.length > 0) {
      return { success: false, error: json.data.themeFilesUpsert.userErrors[0].message };
    }

    if (intent === "update_overwrite") {
      await prisma.installation.update({
        where: { id: installationId },
        data: { section_version_id: versionIdToSet }
      });
    }

    return { success: true, action: intent, installationId };
  }

  if (intent === "update_new_copy") {
    const latestVersion = await prisma.sectionVersion.findFirst({
      where: { section_id: installation.section_id },
      orderBy: { published_at: "desc" }
    });
    const expectedContent = latestVersion?.liquid_content || "";
    const newFilename = installation.filename.replace(".liquid", `-v${latestVersion.version.replace(/\./g, "-")}.liquid`);

    const upsertResponse = await admin.graphql(
      `#graphql
      mutation themeFilesUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
        themeFilesUpsert(themeId: $themeId, files: $files) {
          userErrors { message }
        }
      }`,
      {
        variables: {
          themeId: installation.theme_id,
          files: [{ filename: newFilename, body: { type: "TEXT", value: expectedContent } }],
        },
      }
    );
    const json = await upsertResponse.json();
    if (json.data?.themeFilesUpsert?.userErrors?.length > 0) {
      return { success: false, error: json.data.themeFilesUpsert.userErrors[0].message };
    }

    await prisma.installation.create({
      data: {
        shop_domain: session.shop,
        section_id: installation.section_id,
        section_version_id: latestVersion.id,
        theme_id: installation.theme_id,
        theme_name: installation.theme_name,
        theme_role: installation.theme_role,
        filename: newFilename,
        status: "ACTIVE"
      }
    });

    return { success: true, action: intent, installationId: "NEW" };
  }

  if (intent === "delete") {
    const deleteResponse = await admin.graphql(
      `#graphql
      mutation themeFilesDelete($themeId: ID!, $filenames: [String!]!) {
        themeFilesDelete(themeId: $themeId, files: $filenames) {
          userErrors { message }
        }
      }`,
      {
        variables: {
          themeId: installation.theme_id,
          filenames: [installation.filename]
        }
      }
    );
    const json = await deleteResponse.json();
    if (json.data?.themeFilesDelete?.userErrors?.length > 0) {
      return { success: false, error: json.data.themeFilesDelete.userErrors[0].message };
    }
    
    await prisma.installation.update({
      where: { id: installationId },
      data: { status: "REMOVED" }
    });
    return { success: true, action: "delete", installationId };
  }
};

export default function History() {
  const { installations } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const [scanResults, setScanResults] = useState({});

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "repair") {
        shopify.toast.show("Section successfully repaired in theme!");
        setScanResults(prev => ({ ...prev, [fetcher.data.installationId]: "UNCHANGED" }));
      } else if (fetcher.data.action === "update_overwrite") {
        shopify.toast.show("Section successfully updated!");
        if (fetcher.data.installationId) {
          setScanResults(prev => ({ ...prev, [fetcher.data.installationId]: "UNCHANGED" }));
        }
      } else if (fetcher.data.action === "update_new_copy") {
        shopify.toast.show("New version injected as a separate file!");
      } else if (fetcher.data.action === "delete") {
        shopify.toast.show("Section deleted from theme.");
        setScanResults(prev => ({ ...prev, [fetcher.data.installationId]: undefined }));
      } else if (fetcher.data.status && fetcher.data.installationId) {
        if (scanResults[fetcher.data.installationId] !== fetcher.data.status) {
          setScanResults(prev => ({ ...prev, [fetcher.data.installationId]: fetcher.data.status }));
        }
      }
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const handleScan = (installationId) => {
    fetcher.submit({ intent: "scan", installationId }, { method: "POST" });
  };

  const getStatusBadgeHtml = (status) => {
    switch(status) {
      case "UNCHANGED": return <span className="sl-badge sl-badge-success">Unchanged</span>;
      case "MODIFIED": return <span className="sl-badge sl-badge-warning">Modified Code</span>;
      case "MISSING": return <span className="sl-badge sl-badge-error">File Missing</span>;
      default: return <span className="sl-badge sl-badge-default">Unknown</span>;
    }
  };

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1 className="sl-page-title">Manage Installations</h1>
        <p className="sl-body sl-mt-1">
          Scan your installed sections to ensure they haven't been deleted or altered.
        </p>
      </div>

      {installations.length === 0 ? (
        <div className="sl-card sl-card-body">
          <div className="sl-empty-state">
            <div className="sl-empty-state-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                <polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>
              </svg>
            </div>
            <p className="sl-body" style={{ fontWeight: 500 }}>No active installations found.</p>
          </div>
        </div>
      ) : (
        <div className="sl-card sl-table-wrap">
          <table className="sl-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Section</th>
                <th>Theme</th>
                <th>File State</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {installations.map((inst) => {
                const isScanning = fetcher.state === "submitting" && fetcher.formData?.get("installationId") === inst.id && fetcher.formData?.get("intent") === "scan";
                const currentStatus = scanResults[inst.id];
                const latestVersionId = inst.section?.versions?.[0]?.id;
                const isOutOfDate = latestVersionId && latestVersionId !== inst.section_version_id;

                return (
                  <tr key={inst.id}>
                    <td>{new Date(inst.installed_at).toLocaleDateString()}</td>
                    <td style={{ fontWeight: 500 }}>{inst.section.name}</td>
                    <td>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontWeight: 500 }}>{inst.theme_name}</span>
                        <span className="sl-caption">({inst.theme_role})</span>
                      </div>
                    </td>
                    <td>
                      {currentStatus ? getStatusBadgeHtml(currentStatus) : <span className="sl-caption">Not scanned</span>}
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", flexWrap: "wrap" }}>
                        <button 
                          className="sl-btn sl-btn-secondary sl-btn-sm"
                          onClick={() => handleScan(inst.id)}
                          disabled={isScanning}
                        >
                          {isScanning ? "Scanning..." : "Scan"}
                        </button>
                        
                        {currentStatus === "MISSING" && (
                          <button
                            className="sl-btn sl-btn-primary sl-btn-sm"
                            onClick={() => fetcher.submit({ intent: "repair", installationId: inst.id }, { method: "POST" })}
                            disabled={fetcher.state === "submitting"}
                          >
                            Repair
                          </button>
                        )}

                        {isOutOfDate && currentStatus === "UNCHANGED" && (
                          <button
                            className="sl-btn sl-btn-primary sl-btn-sm"
                            onClick={() => fetcher.submit({ intent: "update_overwrite", installationId: inst.id }, { method: "POST" })}
                            disabled={fetcher.state === "submitting"}
                          >
                            Update (1-Click)
                          </button>
                        )}

                        {isOutOfDate && currentStatus === "MODIFIED" && (
                          <>
                            <button
                              className="sl-btn sl-btn-danger sl-btn-sm"
                              onClick={() => {
                                if (confirm("This will overwrite your customizations! Are you sure?")) {
                                  fetcher.submit({ intent: "update_overwrite", installationId: inst.id }, { method: "POST" });
                                }
                              }}
                              disabled={fetcher.state === "submitting"}
                            >
                              Overwrite
                            </button>
                            <button
                              className="sl-btn sl-btn-primary sl-btn-sm"
                              onClick={() => fetcher.submit({ intent: "update_new_copy", installationId: inst.id }, { method: "POST" })}
                              disabled={fetcher.state === "submitting"}
                            >
                              Update as New Copy
                            </button>
                          </>
                        )}

                        {currentStatus !== "MISSING" && currentStatus !== undefined && (
                          <button
                            className="sl-btn sl-btn-danger sl-btn-sm"
                            onClick={() => {
                              if (confirm("Are you sure you want to delete this section from the theme?")) {
                                fetcher.submit({ intent: "delete", installationId: inst.id }, { method: "POST" });
                              }
                            }}
                            disabled={fetcher.state === "submitting"}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
