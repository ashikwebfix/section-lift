import db from "../db.server";

// Handle OPTIONS preflight for CORS (pixel sandbox sends preflight for non-simple requests)
export const loader = async ({ request }) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  return new Response(null, { status: 204, headers: corsHeaders });
};

export const action = async ({ request }) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (request.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    // Web Pixels send Content-Type: text/plain to avoid CORS preflight.
    // Regular storefront requests send application/json.
    // Both carry a valid JSON body.
    const contentType = request.headers.get("content-type") || "";
    const rawText = await request.text();
    console.log(`\n\n[SectionLift Track API] 📥 Received POST. Content-Type: ${contentType}`);
    console.log(`[SectionLift Track API] Body length: ${rawText.length}`);
    console.log(`[SectionLift Track API] Raw body: ${rawText.substring(0, 500)}`);

    let body;
    try {
      body = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("[SectionLift Track API] Failed to parse JSON body:", parseErr);
      return Response.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
    }

    console.log(`[SectionLift Track API] Parsed Payload:`, JSON.stringify(body));

    const { test_id, shop_domain, visitor_id, variant, event_type, visitor_source, revenue, order_id } = body;

    if (!test_id || !shop_domain || !visitor_id || !variant || !event_type) {
      console.error("[SectionLift Track API] Missing required fields:", { test_id, shop_domain, visitor_id: !!visitor_id, variant, event_type });
      return Response.json({ error: "Missing required fields", received: { test_id, shop_domain, variant, event_type } }, { status: 400, headers: corsHeaders });
    }

    const test = await db.aBTest.findUnique({ where: { id: test_id } });
    if (!test) {
      console.error("[SectionLift Track API] Test not found:", test_id);
      return Response.json({ error: "Test not found", test_id }, { status: 404, headers: corsHeaders });
    }

    // Only allow PURCHASE events on completed tests (late-arriving orders).
    // Reject VIEW/CLICK events for inactive tests.
    if (event_type !== "PURCHASE" && test.status !== "ACTIVE") {
      console.log("[SectionLift Track API] Skipped - test not active:", test_id, test.status);
      return Response.json({ skipped: true, reason: "test_not_active" }, { headers: corsHeaders });
    }

    // ── Deduplication for PURCHASE events ──
    // The pixel fires with checkout.token as order_id (a string like 'a1b2c3').
    // The webhook fires with payload.id as order_id (a numeric string like '12345').
    // They're different values for the same order, so we need to dedup by visitor_id too.
    if (event_type === "PURCHASE") {
      // Check by order_id if provided (handles same-path duplicates)
      if (order_id) {
        const existingByOrderId = await db.aBTestEvent.findFirst({
          where: { test_id, order_id: String(order_id), event_type: "PURCHASE" }
        });
        if (existingByOrderId) {
          console.log("[SectionLift Track API] Skipping duplicate PURCHASE (matched order_id):", order_id);
          return Response.json({ skipped: true, reason: "duplicate_order" }, { headers: corsHeaders });
        }
      }

      // Also dedup by visitor_id: if this visitor already has a PURCHASE for this test
      // within the last 3 minutes, it's a cross-path duplicate (pixel vs webhook for the same checkout).
      const recentPurchase = await db.aBTestEvent.findFirst({
        where: {
          test_id,
          visitor_id,
          event_type: "PURCHASE",
          created_at: { gte: new Date(Date.now() - 3 * 60 * 1000) }
        }
      });
      if (recentPurchase) {
        console.log("[SectionLift Track API] Skipping duplicate PURCHASE (same visitor purchase within 3 mins):", visitor_id);
        return Response.json({ skipped: true, reason: "duplicate_visitor_purchase" }, { headers: corsHeaders });
      }
    }

    await db.aBTestEvent.create({
      data: {
        test_id,
        shop_domain: test.shop_domain || shop_domain,
        visitor_id,
        variant,
        event_type,
        visitor_source: visitor_source || null,
        revenue: revenue != null ? parseFloat(revenue) : 0,
        order_id: order_id ? String(order_id) : null,
      }
    });

    console.log(`[SectionLift Track API] ✅ Event saved: ${event_type} | test=${test_id} | variant=${variant} | visitor=${visitor_id}`);
    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (err) {
    console.error("[SectionLift] Track API error:", err);
    return Response.json({ error: "Internal Server Error", message: err.message }, { status: 500, headers: corsHeaders });
  }
};
