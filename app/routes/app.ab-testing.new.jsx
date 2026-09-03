import { redirect } from "react-router";
import { useSubmit, useNavigate, useActionData, useNavigation, useLoaderData, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  
  // Fetch sections this shop has installed via Section Lift
  const installations = await db.installation.findMany({
    where: { 
      shop_domain: session.shop,
      status: "ACTIVE"
    },
    include: {
      section: true
    }
  });

  return { installations };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const name = formData.get("name");
  let page_url = formData.get("page_url") || "/";
  const original_id = formData.get("original_id");
  const variant_filename = formData.get("variant_filename");
  const traffic_split = parseInt(formData.get("traffic_split"), 10) || 50;
  
  // If user selected a template type like "index", "product", map it to a reasonable URL
  // We save the page_type for the URL, but actually the embed script currently checks window.location.pathname
  const page_type = formData.get("page_type");
  if (page_type === "index") page_url = "/";
  else if (page_type === "product") page_url = "/products/"; // This is a prefix match in embed
  else if (page_type === "collection") page_url = "/collections/";

  const variant_existing_id = formData.get("variant_existing_id");
  const variant_method = formData.get("variant_method") || "new";

  if (!name || !original_id || (!variant_filename && variant_method === "new")) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Generate unique ID for the new variant section if creating new
  let variantKey = "";
  if (variant_method === "new") {
    variantKey = "ab_variant_" + Math.random().toString(36).substr(2, 9);
  } else {
    variantKey = variant_existing_id;
  }

  if (variant_method === "new") {
    try {
      // 1. Get Main Theme ID
      const themeResponse = await admin.graphql(`
        query {
          themes(roles: [MAIN], first: 1) {
            nodes {
              id
            }
          }
        }
      `);
      const themeData = await themeResponse.json();
      const mainTheme = themeData.data.themes.nodes[0];
      
      if (!mainTheme) {
        throw new Error("No main theme found.");
      }
      
      const themeId = mainTheme.id.split("/").pop();

      // 2. Fetch the requested JSON template
      const assetResponse = await fetch(`https://${session.shop}/admin/api/2024-01/themes/${themeId}/assets.json?asset[key]=templates/${page_type}.json`, {
        headers: {
          'X-Shopify-Access-Token': session.accessToken,
          'Content-Type': 'application/json'
        }
      });
      
      if (!assetResponse.ok) {
        throw new Error(`Template ${page_type}.json not found or could not be read.`);
      }
      
      const assetData = await assetResponse.json();
      const templateJson = JSON.parse(assetData.asset.value);

      // 3. Add the section to the JSON and insert into order
      if (!templateJson.sections) {
        templateJson.sections = {};
      }
      
      templateJson.sections[variantKey] = {
        type: variant_filename.replace('sections/', ''), // Remove 'sections/' prefix if present
        settings: {}
      };

      if (templateJson.order && Array.isArray(templateJson.order)) {
        const originalIndex = templateJson.order.indexOf(original_id);
        if (originalIndex !== -1) {
          // Insert right after original
          templateJson.order.splice(originalIndex + 1, 0, variantKey);
        } else {
          templateJson.order.push(variantKey);
        }
      } else {
        if (!templateJson.order) templateJson.order = [];
        templateJson.order.push(variantKey);
      }

      // 4. Save the modified JSON back to the theme
      const putResponse = await fetch(`https://${session.shop}/admin/api/2024-01/themes/${themeId}/assets.json`, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': session.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          asset: {
            key: `templates/${page_type}.json`,
            value: JSON.stringify(templateJson, null, 2)
          }
        })
      });

      if (!putResponse.ok) {
         const errData = await putResponse.text();
         console.error("Failed to update theme:", errData);
         throw new Error(`Failed to inject section into theme: ${errData}`);
      }

    } catch (err) {
      console.error("Theme injection error:", err);
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  const test = await db.aBTest.create({
    data: {
      shop_domain: session.shop,
      name,
      page_url,
      original_id,
      variant_id: variantKey,
      traffic_split,
      status: "ACTIVE"
    }
  });

  return redirect(`/app/ab-testing/${test.id}`);
};

export default function NewABTest() {
  const { installations } = useLoaderData();
  const submit = useSubmit();
  const navigate = useNavigate();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";
  const fetcher = useFetcher();

  const [name, setName] = useState("");
  const [pageType, setPageType] = useState("index");
  const [originalId, setOriginalId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [variantSource, setVariantSource] = useState("section_lift"); // 'section_lift' or 'theme_section'
  const [variantThemeSectionId, setVariantThemeSectionId] = useState("");
  const [variantMethod, setVariantMethod] = useState("new");
  const [variantExistingId, setVariantExistingId] = useState("");
  const [split, setSplit] = useState("50");

  // Fetch sections when page type changes
  useEffect(() => {
    fetcher.load(`/api/theme/sections?page=${pageType}`);
  }, [pageType]);

  const themeSections = fetcher.data?.sections || [];
  const isLoadingSections = fetcher.state === "loading";

  // When sections load, auto-select the first one if empty
  useEffect(() => {
    if (themeSections.length > 0 && !originalId) {
      setOriginalId(themeSections[0].id);
    }
  }, [themeSections]);

  // Auto-select first variant if empty
  useEffect(() => {
    if (installations.length > 0 && !variantId) {
      const filename = installations[0].filename.replace('.liquid', '');
      setVariantId(filename);
    }
  }, [installations]);

  const existingVariants = themeSections.filter(s => s.type === variantId);

  // Auto-select first existing variant if available and method is existing
  useEffect(() => {
    if (existingVariants.length > 0 && !variantExistingId) {
      setVariantExistingId(existingVariants[0].id);
    }
  }, [existingVariants, variantExistingId]);

  // Auto-select first theme section for variant if available
  useEffect(() => {
    const availableThemeSections = themeSections.filter(s => s.id !== originalId);
    if (availableThemeSections.length > 0 && !variantThemeSectionId) {
      setVariantThemeSectionId(availableThemeSections[0].id);
    }
  }, [themeSections, originalId, variantThemeSectionId]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const finalVariantMethod = variantSource === "theme_section" ? "existing" : variantMethod;
    const finalVariantExistingId = variantSource === "theme_section" ? variantThemeSectionId : (variantMethod === "existing" ? variantExistingId : "");
    const finalVariantFilename = variantSource === "theme_section" ? "theme_section" : variantId;

    submit(
      { 
        name, 
        page_type: pageType, 
        original_id: originalId, 
        variant_filename: finalVariantFilename, 
        variant_method: finalVariantMethod,
        variant_existing_id: finalVariantExistingId,
        traffic_split: split 
      },
      { method: "post" }
    );
  };

  return (
    <div className="efx-flex efx-flex-col efx-gap-xl" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
      <div className="efx-flex efx-items-center efx-gap-md">
        <button 
          onClick={() => navigate("/app/ab-testing")}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px', borderRadius: '4px' }}
          className="efx-button-secondary"
        >
          &larr; Back
        </button>
        <h1 className="efx-heading-xl" style={{margin: 0}}>Create New A/B Test</h1>
      </div>

      <div className="efx-solid-card">
        <form onSubmit={handleSubmit} className="efx-flex efx-flex-col efx-gap-lg">
          
          <div className="efx-flex efx-flex-col efx-gap-xs">
            <label style={{ fontWeight: 600, fontSize: '14px' }}>Test Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--efx-border-solid)', borderRadius: '6px', fontSize: '14px' }}
              placeholder="e.g. Homepage Hero Banner Test"
            />
          </div>

          <div className="efx-flex efx-flex-col efx-gap-xs">
            <label style={{ fontWeight: 600, fontSize: '14px' }}>Page Type</label>
            <select 
              value={pageType} 
              onChange={e => {
                setPageType(e.target.value);
                setOriginalId(""); // Reset original ID
              }}
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--efx-border-solid)', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white' }}
            >
              <option value="index">Homepage</option>
              <option value="product">Product Page</option>
              <option value="collection">Collection Page</option>
              <option value="cart">Cart Page</option>
            </select>
            <span className="efx-text-subdued" style={{ fontSize: '12px' }}>Which page template does this test run on?</span>
          </div>

          <div style={{ padding: '20px', background: '#f9fafb', borderRadius: '8px', border: '1px solid var(--efx-border-subdued)' }}>
            <h3 className="efx-heading-md efx-mb-sm" style={{ margin: 0, marginBottom: '12px' }}>Original Section</h3>
            <div className="efx-flex efx-flex-col efx-gap-xs">
              <label style={{ fontWeight: 600, fontSize: '14px' }}>Select section to test against</label>
              <select 
                value={originalId} 
                onChange={e => setOriginalId(e.target.value)} 
                required
                disabled={isLoadingSections}
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--efx-border-solid)', borderRadius: '6px', fontSize: '14px', backgroundColor: isLoadingSections ? '#f3f4f6' : 'white' }}
              >
                {isLoadingSections ? (
                  <option value="">Detecting sections...</option>
                ) : themeSections.length === 0 ? (
                  <option value="">No sections found</option>
                ) : (
                  themeSections.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.id.replace(/[-_]/g, ' ')} ({s.type})
                    </option>
                  ))
                )}
              </select>
              {fetcher.data?.error && (
                <span style={{ color: '#ef4444', fontSize: '12px' }}>{fetcher.data.error}</span>
              )}
            </div>
          </div>

          <div style={{ padding: '20px', background: '#f9fafb', borderRadius: '8px', border: '1px solid var(--efx-border-subdued)' }}>
            <div className="efx-flex efx-justify-between efx-items-center efx-mb-sm" style={{ marginBottom: '12px' }}>
              <h3 className="efx-heading-md" style={{ margin: 0 }}>Variant Section (B)</h3>
              <select 
                value={variantSource} 
                onChange={e => setVariantSource(e.target.value)}
                style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', backgroundColor: 'white' }}
              >
                <option value="section_lift">Use Section Lift App Section</option>
                <option value="theme_section">Use an existing theme section</option>
              </select>
            </div>

            {variantSource === "section_lift" ? (
              <div className="efx-flex efx-flex-col efx-gap-xs">
                <label style={{ fontWeight: 600, fontSize: '14px' }}>Select your replacement section</label>
                <select 
                  value={variantId} 
                  onChange={e => {
                    setVariantId(e.target.value);
                    setVariantMethod("new"); // reset method on change
                    setVariantExistingId("");
                  }} 
                  required={variantSource === "section_lift"}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--efx-border-solid)', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white' }}
                >
                  {installations.length === 0 ? (
                    <option value="">No Section Lift sections installed</option>
                  ) : (
                    installations.map(inst => {
                      const filename = inst.filename.replace('.liquid', '');
                      return (
                        <option key={inst.id} value={filename}>
                          {inst.section.name}
                        </option>
                      )
                    })
                  )}
                </select>
                
                {existingVariants.length > 0 && (
                  <div style={{ marginTop: '12px', padding: '12px', background: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                    <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#065f46', fontWeight: 500 }}>
                      This section is already added to your {pageType} page.
                    </p>
                    
                    <div className="efx-flex efx-flex-col efx-gap-sm">
                      <label className="efx-flex efx-items-center efx-gap-xs" style={{ cursor: 'pointer', fontSize: '14px' }}>
                        <input 
                          type="radio" 
                          name="variant_method" 
                          value="new" 
                          checked={variantMethod === "new"} 
                          onChange={() => setVariantMethod("new")} 
                        />
                        Add a new instance of this section
                      </label>
                      <label className="efx-flex efx-items-center efx-gap-xs" style={{ cursor: 'pointer', fontSize: '14px' }}>
                        <input 
                          type="radio" 
                          name="variant_method" 
                          value="existing" 
                          checked={variantMethod === "existing"} 
                          onChange={() => setVariantMethod("existing")} 
                        />
                        Use an existing instance on the page
                      </label>
                    </div>

                    {variantMethod === "existing" && (
                      <div style={{ marginTop: '12px' }}>
                        <label style={{ fontWeight: 600, fontSize: '13px', display: 'block', marginBottom: '6px' }}>Select which instance to use:</label>
                        <select 
                          value={variantExistingId} 
                          onChange={e => setVariantExistingId(e.target.value)} 
                          required={variantSource === "section_lift" && variantMethod === "existing"}
                          style={{ width: '100%', padding: '8px', border: '1px solid #6ee7b7', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white' }}
                        >
                          <option value="">-- Choose an instance --</option>
                          {existingVariants.map((s, index) => (
                            <option key={s.id} value={s.id}>
                              Instance {index + 1} ({s.id.replace(/[-_]/g, ' ')})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {variantMethod === "new" && (
                  <span className="efx-text-subdued" style={{ fontSize: '12px', color: '#10b981' }}>This section will be automatically added to your live theme!</span>
                )}
              </div>
            ) : (
              <div className="efx-flex efx-flex-col efx-gap-xs">
                <label style={{ fontWeight: 600, fontSize: '14px' }}>Select an existing theme section to test against the original</label>
                <select 
                  value={variantThemeSectionId} 
                  onChange={e => setVariantThemeSectionId(e.target.value)} 
                  required={variantSource === "theme_section"}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--efx-border-solid)', borderRadius: '6px', fontSize: '14px', backgroundColor: 'white' }}
                >
                  <option value="">-- Choose a section --</option>
                  {themeSections.filter(s => s.id !== originalId).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.id.replace(/[-_]/g, ' ')} ({s.type})
                    </option>
                  ))}
                </select>
                <span className="efx-text-subdued" style={{ fontSize: '12px' }}>This section is already on your page. We will A/B test it against the original.</span>
              </div>
            )}
          </div>

          <div className="efx-flex efx-flex-col efx-gap-xs">
            <label style={{ fontWeight: 600, fontSize: '14px' }}>Traffic to Variant (%)</label>
            <input 
              type="number" 
              value={split} 
              onChange={e => setSplit(e.target.value)} 
              required
              min="1"
              max="99"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--efx-border-solid)', borderRadius: '6px', fontSize: '14px' }}
            />
            <span className="efx-text-subdued" style={{ fontSize: '12px' }}>Percentage of visitors who will see the Variant section.</span>
          </div>

          {actionData?.error && (
            <div style={{ color: '#ef4444', padding: '12px', background: '#fef2f2', borderRadius: '6px', fontSize: '14px' }}>
              {actionData.error}
            </div>
          )}

          <div style={{ marginTop: '16px' }}>
            <button 
              type="submit" 
              disabled={isSaving || themeSections.length === 0 || installations.length === 0}
              className="efx-button efx-button-primary"
              style={{ width: '100%', padding: '12px', opacity: (isSaving || themeSections.length === 0 || installations.length === 0) ? 0.5 : 1 }}
            >
              {isSaving ? 'Saving...' : 'Save & Launch Test'}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
