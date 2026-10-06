import { redirect } from "react-router";
import { useSubmit, useNavigate, useActionData, useNavigation, useLoaderData, useFetcher } from "react-router";
import { useState, useEffect } from "react";
import { authenticate } from "../shopify.server";
import db from "../db.server";
import { syncWebPixel } from "../pixel.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  await syncWebPixel(admin, request);
  const installations = await db.installation.findMany({
    where: { shop_domain: session.shop, status: "ACTIVE" },
    include: { section: true }
  });
  return { installations };
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  
  const name = formData.get("name");
  let page_url = "/";
  const original_id = formData.get("original_id");
  
  const page_type = formData.get("page_type");
  const template_suffix = formData.get("template_suffix");
  
  // Always use TEMPLATE: format for non-homepage pages.
  // The API matches by template name (e.g. TEMPLATE:product, TEMPLATE:product.alternate).
  // Homepage stays as "/" since it has no template suffix in most themes.
  if (page_type === "index" && !template_suffix) {
    page_url = "/";
  } else if (template_suffix && template_suffix !== page_type) {
    // A specific template variant was chosen (e.g. product.alternate)
    page_url = `TEMPLATE:${template_suffix}`;
  } else {
    // Default template for this page type — still use TEMPLATE: so API can match by template name
    page_url = page_type === "index" ? "/" : `TEMPLATE:${page_type}`;
  }
  const utm_campaign = formData.get("utm_campaign") || null;
  const target_device = formData.get("target_device") || "ALL";
  const target_visitor_type = formData.get("target_visitor_type") || "ALL";

  const start_date_raw = formData.get("start_date");
  const end_date_raw = formData.get("end_date");
  const start_date = start_date_raw ? new Date(start_date_raw) : null;
  const end_date = end_date_raw ? new Date(end_date_raw) : null;

  const auto_winner_enabled = formData.get("auto_winner_enabled") === "true";
  const auto_winner_metric = formData.get("auto_winner_metric") || "CONVERSION_RATE";
  const auto_winner_threshold_days = parseInt(formData.get("auto_winner_threshold_days"), 10) || 7;
  
  const variantsDataRaw = formData.get("variants_data");
  let variants = [];
  try {
    variants = JSON.parse(variantsDataRaw);
  } catch(e) {
    return Response.json({ error: "Invalid variants data" }, { status: 400 });
  }

  if (!name || !original_id || variants.length === 0) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  for (let v of variants) {
    if (v.method === "new") {
      v.key = "ab_variant_" + Math.random().toString(36).substr(2, 9);
    } else {
      v.key = v.existing_id;
    }
  }

  const newVariants = variants.filter(v => v.method === "new");
  if (newVariants.length > 0) {
    try {
      const themeResponse = await admin.graphql(`
        query { themes(roles: [MAIN], first: 1) { nodes { id } } }
      `);
      const themeData = await themeResponse.json();
      const mainTheme = themeData.data.themes.nodes[0];
      if (!mainTheme) throw new Error("No main theme found.");
      
      const themeId = mainTheme.id.split("/").pop();
      const templateFileName = template_suffix || page_type;
      
      const assetResponse = await fetch(`https://${session.shop}/admin/api/2024-01/themes/${themeId}/assets.json?asset[key]=templates/${templateFileName}.json`, {
        headers: {
          'X-Shopify-Access-Token': session.accessToken,
          'Content-Type': 'application/json'
        }
      });
      if (!assetResponse.ok) throw new Error(`Template ${templateFileName}.json not found or could not be read.`);
      
      const assetData = await assetResponse.json();
      const templateJson = JSON.parse(assetData.asset.value);

      if (!templateJson.sections) templateJson.sections = {};
      if (!templateJson.order) templateJson.order = [];

      for (let v of newVariants) {
        templateJson.sections[v.key] = {
          type: v.filename.replace('sections/', ''),
          settings: {}
        };
        const originalIndex = templateJson.order.indexOf(original_id);
        if (originalIndex !== -1) {
          templateJson.order.splice(originalIndex + 1, 0, v.key);
        } else {
          templateJson.order.push(v.key);
        }
      }

      const putResponse = await fetch(`https://${session.shop}/admin/api/2024-01/themes/${themeId}/assets.json`, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': session.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          asset: {
            key: `templates/${templateFileName}.json`,
            value: JSON.stringify(templateJson, null, 2)
          }
        })
      });

      if (!putResponse.ok) {
         const errData = await putResponse.text();
         throw new Error(`Failed to inject section into theme: ${errData}`);
      }
    } catch (err) {
      return Response.json({ error: err.message }, { status: 500 });
    }
  }

  const test = await db.aBTest.create({
    data: {
      shop_domain: session.shop,
      name,
      page_url,
      original_id,
      utm_campaign,
      target_device,
      target_visitor_type,
      start_date,
      end_date,
      auto_winner_enabled,
      auto_winner_metric,
      auto_winner_threshold_days,
      variant_id: variants[0].key,
      traffic_split: variants[0].split,
      variant_c_id: variants[1] ? variants[1].key : null,
      traffic_split_c: variants[1] ? variants[1].split : null,
      variant_d_id: variants[2] ? variants[2].key : null,
      traffic_split_d: variants[2] ? variants[2].split : null,
      status: "ACTIVE"
    }
  });

  await syncWebPixel(admin, request);

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
  const [templateSuffix, setTemplateSuffix] = useState("");
  const [originalId, setOriginalId] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");
  const [targetDevice, setTargetDevice] = useState("ALL");
  const [targetVisitorType, setTargetVisitorType] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [autoWinnerEnabled, setAutoWinnerEnabled] = useState(false);
  const [autoWinnerMetric, setAutoWinnerMetric] = useState("CONVERSION_RATE");
  const [autoWinnerThresholdDays, setAutoWinnerThresholdDays] = useState(7);
  
  const defaultVariant = {
    id: Date.now(),
    letter: 'B',
    source: "section_lift",
    sectionId: "", 
    themeSectionId: "", 
    method: "new",
    existingId: "", 
    split: 50
  };
  
  const [variants, setVariants] = useState([defaultVariant]);

  useEffect(() => {
    fetcher.load(`/api/theme/sections?page=${pageType}`);
    setTemplateSuffix("");
  }, [pageType]);

  const themeTemplates = fetcher.data?.templates || [];
  
  useEffect(() => {
    if (themeTemplates.length > 0) {
      const isValid = themeTemplates.some(t => t.name === templateSuffix);
      if (!templateSuffix || !isValid) {
        const baseTemplate = themeTemplates.find(t => t.name === pageType);
        setTemplateSuffix(baseTemplate ? baseTemplate.name : themeTemplates[0].name);
      }
    }
  }, [themeTemplates, templateSuffix, pageType]);

  const activeTemplateObj = themeTemplates.find(t => t.name === templateSuffix) || themeTemplates[0];
  const themeSections = activeTemplateObj ? activeTemplateObj.sections : (fetcher.data?.sections || []);
  const isLoadingSections = fetcher.state === "loading";

  useEffect(() => {
    if (themeSections.length > 0 && !originalId) {
      setOriginalId(themeSections[0].id);
    }
  }, [themeSections]);

  useEffect(() => {
    setVariants(prev => prev.map(v => {
      let needsUpdate = false;
      const updated = { ...v };

      if (installations.length > 0 && !v.sectionId) {
        updated.sectionId = installations[0].filename.replace('.liquid', '');
        needsUpdate = true;
      }

      const existingInstances = themeSections.filter(s => s.type === updated.sectionId);
      if (existingInstances.length > 0 && !v.existingId) {
        updated.existingId = existingInstances[0].id;
        needsUpdate = true;
      }

      const availableThemeSections = themeSections.filter(s => s.id !== originalId);
      if (availableThemeSections.length > 0 && !v.themeSectionId) {
        updated.themeSectionId = availableThemeSections[0].id;
        needsUpdate = true;
      }

      return needsUpdate ? updated : v;
    }));
  }, [installations, themeSections, originalId]);

  const addVariant = () => {
    if (variants.length >= 3) return;
    const nextLetter = variants.length === 1 ? 'C' : 'D';
    setVariants([...variants, { ...defaultVariant, id: Date.now(), letter: nextLetter, split: 20 }]);
  };

  const removeVariant = (id) => {
    setVariants(variants.filter(v => v.id !== id));
  };

  const updateVariant = (id, field, value) => {
    setVariants(prev => prev.map(v => {
      if (v.id !== id) return v;
      if (typeof field === 'object') return { ...v, ...field };
      return { ...v, [field]: value };
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const variantsPayload = variants.map(v => {
      const isTheme = v.source === "theme_section";
      return {
        letter: v.letter,
        filename: isTheme ? "theme_section" : v.sectionId,
        method: isTheme ? "existing" : v.method,
        existing_id: isTheme ? v.themeSectionId : (v.method === "existing" ? v.existingId : ""),
        split: parseInt(v.split, 10) || 0
      };
    });

    submit(
      { 
        name, 
        page_type: pageType, 
        template_suffix: templateSuffix,
        original_id: originalId,
        utm_campaign: utmCampaign,
        target_device: targetDevice,
        target_visitor_type: targetVisitorType,
        start_date: startDate,
        end_date: endDate,
        auto_winner_enabled: autoWinnerEnabled.toString(),
        auto_winner_metric: autoWinnerMetric,
        auto_winner_threshold_days: autoWinnerThresholdDays,
        variants_data: JSON.stringify(variantsPayload)
      },
      { method: "post" }
    );
  };

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "24px", maxWidth: "800px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <button 
          onClick={() => navigate("/app/ab-testing")}
          className="sl-btn sl-btn-ghost sl-btn-sm"
        >
          &larr; Back
        </button>
        <h1 className="sl-page-title" style={{ margin: 0 }}>Create New A/B Test</h1>
      </div>

      <div className="sl-card sl-card-body">
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <div className="sl-field">
            <label className="sl-label-text">Test Name</label>
            <input 
              type="text" 
              value={name} 
              onChange={e => setName(e.target.value)} 
              required
              className="sl-input"
              placeholder="e.g. Homepage Hero Banner Test"
            />
          </div>

          <div style={{ display: "flex", gap: "16px", background: "var(--sl-surface-sunken)", padding: "16px", borderRadius: "var(--sl-radius-md)" }}>
            <div className="sl-field" style={{ flex: 1 }}>
              <label className="sl-label-text">Page Type</label>
              <select 
                value={pageType} 
                onChange={e => { setPageType(e.target.value); setOriginalId(""); }}
                className="sl-select"
              >
                <option value="index">Homepage</option>
                <option value="product">Product Page</option>
                <option value="collection">Collection Page</option>
                <option value="cart">Cart Page</option>
              </select>
            </div>

            {themeTemplates.length > 0 && (
              <div className="sl-field" style={{ flex: 1 }}>
                <label className="sl-label-text">Specific Template</label>
                <select 
                  value={templateSuffix} 
                  onChange={e => { setTemplateSuffix(e.target.value); setOriginalId(""); }}
                  className="sl-select"
                >
                  {themeTemplates.map(t => (
                    <option key={t.name} value={t.name}>
                      {t.name === pageType ? `Default ${pageType}` : t.name} ({t.sections.length} sections)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "16px" }}>
            <div className="sl-field" style={{ flex: 1 }}>
              <label className="sl-label-text">Device Targeting</label>
              <select 
                value={targetDevice} 
                onChange={e => setTargetDevice(e.target.value)} 
                className="sl-select"
              >
                <option value="ALL">All Devices</option>
                <option value="DESKTOP">Desktop Only</option>
                <option value="MOBILE">Mobile Only (iOS & Android)</option>
                <option value="IOS">iOS Only</option>
                <option value="ANDROID">Android Only</option>
              </select>
            </div>
            
            <div className="sl-field" style={{ flex: 1 }}>
              <label className="sl-label-text">Visitor Targeting</label>
              <select 
                value={targetVisitorType} 
                onChange={e => setTargetVisitorType(e.target.value)} 
                className="sl-select"
              >
                <option value="ALL">All Visitors</option>
                <option value="NEW">New Visitors Only</option>
                <option value="RETURNING">Returning Visitors Only</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", gap: "16px" }}>
            <div className="sl-field" style={{ flex: 1 }}>
              <label className="sl-label-text">Start Date (Optional)</label>
              <input 
                type="datetime-local" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)} 
                className="sl-input"
              />
            </div>
            <div className="sl-field" style={{ flex: 1 }}>
              <label className="sl-label-text">End Date (Optional)</label>
              <input 
                type="datetime-local" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)} 
                min={startDate}
                className="sl-input"
              />
            </div>
          </div>
          
          <div className="sl-field">
            <label className="sl-label-text">UTM Campaign Targeting (Optional)</label>
            <input 
              type="text" 
              value={utmCampaign} 
              onChange={e => setUtmCampaign(e.target.value)} 
              className="sl-input"
              placeholder="e.g. summer_sale"
            />
            <span className="sl-caption sl-mt-1">Only visitors landing with <code>?utm_campaign={utmCampaign || '...'}</code> will enter the test.</span>
          </div>

          <hr className="sl-divider" />

          <div style={{ background: "var(--sl-surface-sunken)", padding: "16px", borderRadius: "var(--sl-radius-md)", border: "1px solid var(--sl-border)" }}>
            <h3 className="sl-card-title sl-mb-3">Original Section (A)</h3>
            <div className="sl-field">
              <label className="sl-label-text">Select section to test against</label>
              <select 
                value={originalId} 
                onChange={e => setOriginalId(e.target.value)} 
                required
                disabled={isLoadingSections}
                className="sl-select"
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
                <span style={{ color: "var(--sl-error)", fontSize: "12px", marginTop: "4px" }}>{fetcher.data.error}</span>
              )}
            </div>
          </div>

          {variants.map((v, index) => {
            const existingInstances = themeSections.filter(s => s.type === v.sectionId);
            return (
              <div key={v.id} style={{ background: "var(--sl-surface)", padding: "16px", borderRadius: "var(--sl-radius-md)", border: "1px solid var(--sl-border-strong)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 className="sl-card-title" style={{ margin: 0 }}>Variant Section ({v.letter})</h3>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                    <select 
                      value={v.source} 
                      onChange={e => updateVariant(v.id, "source", e.target.value)}
                      className="sl-select"
                      style={{ padding: "4px 8px", fontSize: "12px" }}
                    >
                      <option value="section_lift">Use Section Lift App Section</option>
                      <option value="theme_section">Use an existing theme section</option>
                    </select>
                    {index > 0 && (
                      <button type="button" onClick={() => removeVariant(v.id)} className="sl-btn sl-btn-ghost sl-btn-sm" style={{ color: "var(--sl-error)" }}>Remove</button>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", gap: "16px" }}>
                  <div className="sl-field" style={{ flex: 2 }}>
                    {v.source === "section_lift" ? (
                      <>
                        <label className="sl-label-text">Select replacement section</label>
                        <select 
                          value={v.sectionId} 
                          onChange={e => updateVariant(v.id, { sectionId: e.target.value, method: "new", existingId: "" })} 
                          required={v.source === "section_lift"}
                          className="sl-select"
                        >
                          {installations.length === 0 ? (
                            <option value="">No Section Lift sections installed</option>
                          ) : (
                            installations.map(inst => (
                              <option key={inst.id} value={inst.filename.replace('.liquid', '')}>
                                {inst.section.name}
                              </option>
                            ))
                          )}
                        </select>
                        
                        {existingInstances.length > 0 && (
                          <div style={{ marginTop: "12px", padding: "12px", background: "var(--sl-surface-sunken)", borderRadius: "var(--sl-radius-sm)" }}>
                            <p className="sl-body" style={{ margin: "0 0 8px 0", fontWeight: 500 }}>
                              This section is already added to your {pageType} page.
                            </p>
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                                <input type="radio" value="new" checked={v.method === "new"} onChange={() => updateVariant(v.id, "method", "new")} />
                                Add a new instance
                              </label>
                              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", cursor: "pointer" }}>
                                <input type="radio" value="existing" checked={v.method === "existing"} onChange={() => updateVariant(v.id, "method", "existing")} />
                                Use existing instance
                              </label>
                            </div>

                            {v.method === "existing" && (
                              <div style={{ marginTop: "12px" }}>
                                <select 
                                  value={v.existingId} 
                                  onChange={e => updateVariant(v.id, "existingId", e.target.value)} 
                                  required={v.source === "section_lift" && v.method === "existing"}
                                  className="sl-select"
                                >
                                  <option value="">-- Choose an instance --</option>
                                  {existingInstances.map((s, idx) => (
                                    <option key={s.id} value={s.id}>
                                      Instance {idx + 1} ({s.id.replace(/[-_]/g, ' ')})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <label className="sl-label-text">Select existing theme section</label>
                        <select 
                          value={v.themeSectionId} 
                          onChange={e => updateVariant(v.id, "themeSectionId", e.target.value)} 
                          required={v.source === "theme_section"}
                          className="sl-select"
                        >
                          <option value="">-- Choose a section --</option>
                          {themeSections.filter(s => s.id !== originalId).map(s => (
                            <option key={s.id} value={s.id}>
                              {s.id.replace(/[-_]/g, ' ')} ({s.type})
                            </option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                  
                  <div className="sl-field" style={{ flex: 1 }}>
                    <label className="sl-label-text">Traffic to Variant {v.letter} (%)</label>
                    <input 
                      type="number" 
                      value={v.split} 
                      onChange={e => updateVariant(v.id, "split", e.target.value)} 
                      required min="1" max="99"
                      className="sl-input"
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {variants.length < 3 && (
            <button 
              type="button" 
              onClick={addVariant}
              className="sl-btn sl-btn-secondary sl-w-full"
              style={{ borderStyle: "dashed", background: "transparent" }}
            >
              + Add Another Variant (Multivariate Test)
            </button>
          )}

          <div style={{ padding: "16px", background: "var(--sl-surface-sunken)", borderRadius: "var(--sl-radius-md)", textAlign: "center" }}>
            <span style={{ fontSize: "14px", fontWeight: 600 }}>
              Total Variant Traffic: {variants.reduce((acc, v) => acc + (parseInt(v.split, 10) || 0), 0)}% 
              (Original A gets {100 - variants.reduce((acc, v) => acc + (parseInt(v.split, 10) || 0), 0)}%)
            </span>
          </div>

          <hr className="sl-divider" />

          <div style={{ background: "var(--sl-surface-sunken)", padding: "16px", borderRadius: "var(--sl-radius-md)", border: "1px solid var(--sl-border)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "15px", fontWeight: 600 }}>Automatic Winner Selection</h4>
                <p className="sl-caption sl-mt-1">Automatically pick the best performing variant and serve it to 100% of traffic.</p>
              </div>
              <label style={{ position: "relative", display: "inline-flex", cursor: "pointer" }}>
                <input type="checkbox" checked={autoWinnerEnabled} onChange={e => setAutoWinnerEnabled(e.target.checked)} style={{ opacity: 0, width: 0, height: 0 }} />
                <div style={{ width: "40px", height: "24px", background: autoWinnerEnabled ? "var(--sl-brand)" : "var(--sl-border-strong)", borderRadius: "99px", transition: "0.2s", position: "relative" }}>
                  <div style={{ width: "18px", height: "18px", background: "white", borderRadius: "50%", position: "absolute", top: "3px", left: autoWinnerEnabled ? "19px" : "3px", transition: "0.2s" }} />
                </div>
              </label>
            </div>
            
            {autoWinnerEnabled && (
              <div style={{ display: "flex", gap: "16px", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--sl-border)" }}>
                <div className="sl-field" style={{ flex: 1 }}>
                  <label className="sl-label-text">Winning Metric</label>
                  <select value={autoWinnerMetric} onChange={e => setAutoWinnerMetric(e.target.value)} className="sl-select">
                    <option value="CONVERSION_RATE">Conversion Rate</option>
                    <option value="CLICK_THROUGH_RATE">Click-Through Rate</option>
                  </select>
                </div>
                <div className="sl-field" style={{ flex: 1 }}>
                  <label className="sl-label-text">Decide Winner After</label>
                  <select value={autoWinnerThresholdDays} onChange={e => setAutoWinnerThresholdDays(parseInt(e.target.value, 10))} className="sl-select">
                    <option value={7}>7 Days</option>
                    <option value={14}>14 Days</option>
                    <option value={30}>30 Days</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {actionData?.error && (
            <div className="sl-alert sl-alert-error">
              {actionData.error}
            </div>
          )}

          <div style={{ marginTop: "16px" }}>
            <button 
              type="submit" 
              disabled={isSaving || themeSections.length === 0 || installations.length === 0}
              className="sl-btn sl-btn-primary sl-w-full"
              style={{ padding: "12px", fontSize: "15px" }}
            >
              {isSaving ? "Saving..." : "Save & Launch Test"}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
