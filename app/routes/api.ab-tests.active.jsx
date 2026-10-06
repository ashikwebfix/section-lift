
import db from "../db.server";
import crypto from "crypto";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop");
  const pageUrl = url.searchParams.get("url") || "/";
  const visitorId = url.searchParams.get("vid");
  const utmCampaign = url.searchParams.get("utm_campaign") || "";
  const deviceType = url.searchParams.get("device_type") || "DESKTOP";
  const visitorType = url.searchParams.get("visitor_type") || "RETURNING";
  const templateName = url.searchParams.get("template") || "";

  // Basic CORS headers to allow storefront requests
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!shopDomain) {
    return Response.json({ error: "Missing shop parameter" }, { status: 400, headers: corsHeaders });
  }

  const now = new Date();

  // Resolve the app server's direct URL so it's always available
  const reqUrl = new URL(request.url);
  const appUrl = (process.env.SHOPIFY_APP_URL || process.env.APP_URL || process.env.HOST || `${reqUrl.protocol}//${reqUrl.host}`).replace(/\/$/, '');
  const pixelTrackUrl = `${appUrl}/api/ab-tests/track`;

  // Find ALL active tests for this shop
  const allActiveTests = await db.aBTest.findMany({
    where: {
      shop_domain: shopDomain,
      status: "ACTIVE"
    },
    include: {
      events: true // Needed for lazy auto-winner evaluation
    }
  });

  // Filter tests by pageUrl in JavaScript to support prefix matching (e.g. /products/)
  const activeTests = [];
  
  for (const test of allActiveTests) {
    if (test.utm_campaign && test.utm_campaign !== utmCampaign) {
      continue; // UTM targeting mismatch
    }
    
    // Device Targeting
    if (test.target_device && test.target_device !== "ALL") {
      if (test.target_device === "DESKTOP" && deviceType !== "DESKTOP") continue;
      if (test.target_device === "MOBILE" && (deviceType === "DESKTOP")) continue; // Mobile includes iOS/Android
      if (test.target_device === "IOS" && deviceType !== "IOS") continue;
      if (test.target_device === "ANDROID" && deviceType !== "ANDROID") continue;
    }
    
    // Visitor Type Targeting
    if (test.target_visitor_type && test.target_visitor_type !== "ALL") {
      if (test.target_visitor_type === "NEW" && visitorType !== "NEW") continue;
      if (test.target_visitor_type === "RETURNING" && visitorType !== "RETURNING") continue;
    }
    
    // Schedule Targeting
    if (test.start_date && now < new Date(test.start_date)) continue;
    if (test.end_date && now > new Date(test.end_date)) continue;

    if (test.page_url && test.page_url !== "") {
       if (test.page_url.startsWith("TEMPLATE:")) {
          // Template-based matching
          const targetTemplate = test.page_url.replace("TEMPLATE:", "").trim();
          const currentTemplateName = templateName.trim();
          
          // Exact match (e.g. TEMPLATE:product matches template=product)
          if (currentTemplateName === targetTemplate) {
            // match — keep test
          }
          // Base template match: TEMPLATE:product matches product.alternate etc.
          else if (currentTemplateName && currentTemplateName.split('.')[0] === targetTemplate) {
            // match — keep test
          }
          // Fallback URL pattern match if templateName was missing/empty
          else if (targetTemplate === "product" && pageUrl.startsWith("/products/")) {
            // match — keep test on product pages
          }
          else if (targetTemplate === "collection" && pageUrl.startsWith("/collections/")) {
            // match — keep test on collection pages
          }
          else {
            continue; // no match
          }
       } else if (test.page_url === "/") {
          // Strict homepage matching
          if (pageUrl !== "/" && pageUrl.length > 3) continue;
       } else {
          // Legacy URL prefix matching (e.g. /products/, /collections/)
          if (!pageUrl.startsWith(test.page_url)) continue;
       }
    }

    // Auto-Winner Logic
    if (test.auto_winner_enabled && !test.winning_variant_id) {
       const thresholdDate = new Date(test.created_at);
       thresholdDate.setDate(thresholdDate.getDate() + (test.auto_winner_threshold_days || 7));
       
       if (now > thresholdDate) {
         // Calculate winner
         const stats = {
           A: { views: 0, clicks: 0, purchases: 0 },
           B: { views: 0, clicks: 0, purchases: 0 },
           C: { views: 0, clicks: 0, purchases: 0 },
           D: { views: 0, clicks: 0, purchases: 0 }
         };
         
         test.events.forEach(e => {
            if (stats[e.variant]) {
               if (e.event_type === 'VIEW') stats[e.variant].views++;
               if (e.event_type === 'CLICK') stats[e.variant].clicks++;
               if (e.event_type === 'PURCHASE') stats[e.variant].purchases++;
            }
         });
         
         let bestVariant = 'A';
         let bestScore = -1;
         
         ['A', 'B', 'C', 'D'].forEach(v => {
            if (v === 'B' && !test.variant_id) return;
            if (v === 'C' && !test.variant_c_id) return;
            if (v === 'D' && !test.variant_d_id) return;
            
            const views = stats[v].views;
            if (views === 0) return;
            
            const score = test.auto_winner_metric === 'CONVERSION_RATE' 
              ? (stats[v].purchases / views)
              : (stats[v].clicks / views);
              
            if (score > bestScore) {
               bestScore = score;
               bestVariant = v;
            }
         });
         
         // Save winner to DB
         await db.aBTest.update({
            where: { id: test.id },
            data: { winning_variant_id: bestVariant }
         });
         
         test.winning_variant_id = bestVariant;
       }
    }

    activeTests.push(test);
  }

  if (activeTests.length === 0) {
    return Response.json({ tests: [], pixel_track_url: pixelTrackUrl }, { headers: corsHeaders });
  }

  // Determine split for the visitor for each active test
  const assignedTests = activeTests.map(test => {
    // Keep a short-lived cache to handle race conditions (where a user is assigned a variant, refreshes immediately, and track hasn't saved to DB yet)
    const cacheKey = `${visitorId}-${test.id}`;
    if (global._abTestCache && global._abTestCache[cacheKey]) {
    // If it's been in cache for less than 5 minutes, use it
    if (Date.now() - global._abTestCache[cacheKey].timestamp < 300000) {
      const cachedVariant = global._abTestCache[cacheKey].variant;
      let activeVariantId = null;
      if (cachedVariant === 'B') activeVariantId = test.variant_id;
      if (cachedVariant === 'C') activeVariantId = test.variant_c_id;
      if (cachedVariant === 'D') activeVariantId = test.variant_d_id;
      
      return {
        id: test.id,
        name: test.name,
        original_id: test.original_id,
        variant_id: test.variant_id,
        variant_c_id: test.variant_c_id,
        variant_d_id: test.variant_d_id,
        assigned_variant: cachedVariant,
        active_variant_id: activeVariantId
      };
    }
  }

  // Count unique visitors per variant
  const counts = { A: 0, B: 0, C: 0, D: 0 };
  const seen = new Set();
  let userExistingVariant = null;

  test.events.forEach(e => {
    if (e.visitor_id === visitorId && !userExistingVariant) {
      userExistingVariant = e.variant;
    }
    if (!seen.has(e.visitor_id)) {
      seen.add(e.visitor_id);
      counts[e.variant] = (counts[e.variant] || 0) + 1;
    }
  });

  let assignedVariant = 'A';

  if (test.winning_variant_id) {
    assignedVariant = test.winning_variant_id;
  } else if (userExistingVariant) {
    assignedVariant = userExistingVariant;
  } else {
    // Balanced Assignment Logic
    const totalUnique = seen.size;
    const splitB = test.traffic_split || 0;
    const splitC = test.traffic_split_c || 0;
    const splitD = test.traffic_split_d || 0;
    const splitA = 100 - (splitB + splitC + splitD);
    
    const targets = { A: splitA, B: splitB, C: splitC, D: splitD };
    
    if (totalUnique === 0) {
      // First visitor gets the variant with the highest split
      let maxTarget = -1;
      for (const v of ['A', 'B', 'C', 'D']) {
        if (targets[v] > maxTarget) {
          maxTarget = targets[v];
          assignedVariant = v;
        }
      }
    } else {
      let maxDeficit = -Infinity;
      for (const v of ['A', 'B', 'C', 'D']) {
        if (targets[v] === 0) continue;
        const currentPct = (counts[v] / totalUnique) * 100;
        const deficit = targets[v] - currentPct; // Positive means it needs more traffic
        if (deficit > maxDeficit) {
          maxDeficit = deficit;
          assignedVariant = v;
        }
      }
    }
  }

  // Save to memory cache
  if (!global._abTestCache) global._abTestCache = {};
  global._abTestCache[cacheKey] = { variant: assignedVariant, timestamp: Date.now() };

  let activeVariantId = null;
  if (assignedVariant === 'B') activeVariantId = test.variant_id;
  if (assignedVariant === 'C') activeVariantId = test.variant_c_id;
  if (assignedVariant === 'D') activeVariantId = test.variant_d_id;
  
  return {
    id: test.id,
    name: test.name,
    original_id: test.original_id,
    variant_id: test.variant_id,
    variant_c_id: test.variant_c_id,
    variant_d_id: test.variant_d_id,
    assigned_variant: assignedVariant,
    active_variant_id: activeVariantId
  };
});

  return Response.json({ tests: assignedTests, pixel_track_url: pixelTrackUrl }, { headers: corsHeaders });
};

// Also support POST if they send it via POST
export const action = async ({ request }) => {
  return loader({ request });
};
