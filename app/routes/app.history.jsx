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
    // For repair, use the installed version. For update, use the latest version.
    let expectedContent = "";
    let versionIdToSet = installation.section_version_id;

    if (intent === "repair") {
      expectedContent = installation.section_version?.liquid_content || "";
    } else {
      // Fetch latest version
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

    // Create a new Installation record
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
    // Update installation status
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
        // Update local status to unchanged after repair
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

  const getStatusBadge = (status) => {
    switch(status) {
      case "UNCHANGED": return <s-text color="success">Unchanged</s-text>;
      case "MODIFIED": return <s-text color="warning">Modified Code</s-text>;
      case "MISSING": return <s-text color="critical">File Missing</s-text>;
      default: return <s-text color="subdued">Unknown</s-text>;
    }
  };

  const getStatusBadgeHtml = (status) => {
    switch(status) {
      case "UNCHANGED": return <span className="efx-badge efx-badge-success" style={{margin: 0}}>Unchanged</span>;
      case "MODIFIED": return <span className="efx-badge" style={{background: 'rgba(255, 193, 7, 0.2)', color: '#b28900', margin: 0}}>Modified Code</span>;
      case "MISSING": return <span className="efx-badge efx-badge-neutral" style={{background: 'rgba(222, 54, 24, 0.1)', color: '#de3618', margin: 0}}>File Missing</span>;
      default: return <span className="efx-badge efx-badge-neutral" style={{margin: 0}}>Unknown</span>;
    }
  };

  return (
    <div className="efx-flex efx-flex-col efx-gap-lg" style={{ padding: '32px' }}>
      <div className="efx-flex efx-flex-col efx-gap-sm">
        <h1 className="efx-heading-xl">Manage Installations</h1>
        <p className="efx-text-body">
          Manage the sections you have installed across your themes. Scan them to ensure they haven't been deleted or altered.
        </p>
      </div>

      {installations.length === 0 ? (
        <div className="efx-solid-card" style={{ textAlign: 'center', padding: '48px' }}>
          <p className="efx-text-subdued">No active installations found.</p>
        </div>
      ) : (
        <div className="efx-glass-card" style={{ padding: '0', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: '800px' }}>
              <thead style={{ background: 'rgba(0,0,0,0.02)' }}>
                <tr style={{ borderBottom: '1px solid var(--efx-border-solid)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--efx-text-subdued)', fontSize: '0.875rem' }}>Date</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--efx-text-subdued)', fontSize: '0.875rem' }}>Section</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--efx-text-subdued)', fontSize: '0.875rem' }}>Theme</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--efx-text-subdued)', fontSize: '0.875rem' }}>File State</th>
                  <th style={{ padding: '16px 24px', fontWeight: 600, color: 'var(--efx-text-subdued)', fontSize: '0.875rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {installations.map((inst) => {
                  const isScanning = fetcher.state === "submitting" && fetcher.formData?.get("installationId") === inst.id && fetcher.formData?.get("intent") === "scan";
                  const currentStatus = scanResults[inst.id];
                  const latestVersionId = inst.section?.versions?.[0]?.id;
                  const isOutOfDate = latestVersionId && latestVersionId !== inst.section_version_id;

                  return (
                    <tr key={inst.id} style={{ borderBottom: '1px solid var(--efx-border-solid)', transition: 'background 0.2s' }}>
                      <td style={{ padding: '16px 24px', fontSize: '0.875rem' }}>{new Date(inst.installed_at).toLocaleDateString()}</td>
                      <td style={{ padding: '16px 24px', fontWeight: 500 }}>{inst.section.name}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <div className="efx-flex efx-flex-col">
                          <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{inst.theme_name}</span>
                          <span className="efx-text-subdued" style={{ fontSize: '0.75rem' }}>({inst.theme_role})</span>
                        </div>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        {currentStatus ? getStatusBadgeHtml(currentStatus) : <span className="efx-text-subdued" style={{fontSize: '0.875rem'}}>Not scanned</span>}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <div className="efx-flex efx-flex-row efx-gap-sm efx-items-center efx-flex-wrap">
                          <button 
                            className="efx-button efx-button-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                            onClick={() => handleScan(inst.id)}
                            disabled={isScanning}
                          >
                            {isScanning ? 'Scanning...' : 'Scan'}
                          </button>
                          
                          {currentStatus === "MISSING" && (
                            <button
                              className="efx-button efx-button-primary"
                              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                              onClick={() => fetcher.submit({ intent: "repair", installationId: inst.id }, { method: "POST" })}
                              disabled={fetcher.state === "submitting"}
                            >
                              Repair
                            </button>
                          )}

                          {isOutOfDate && currentStatus === "UNCHANGED" && (
                            <button
                              className="efx-button efx-button-primary"
                              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                              onClick={() => fetcher.submit({ intent: "update_overwrite", installationId: inst.id }, { method: "POST" })}
                              disabled={fetcher.state === "submitting"}
                            >
                              Update (1-Click)
                            </button>
                          )}

                          {isOutOfDate && currentStatus === "MODIFIED" && (
                            <>
                              <button
                                className="efx-button efx-button-danger"
                                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
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
                                className="efx-button efx-button-primary"
                                style={{ padding: '6px 12px', fontSize: '0.75rem' }}
                                onClick={() => fetcher.submit({ intent: "update_new_copy", installationId: inst.id }, { method: "POST" })}
                                disabled={fetcher.state === "submitting"}
                              >
                                Update as New Copy
                              </button>
                            </>
                          )}

                          {currentStatus !== "MISSING" && currentStatus !== undefined && (
                            <button
                              className="efx-button efx-button-danger"
                              style={{ padding: '6px 12px', fontSize: '0.75rem' }}
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
        </div>
      )}
    </div>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
