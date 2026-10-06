import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  console.log(`\n\n[SectionLift Webhook] 🔔 RECEIVED orders/create Webhook`);
  const { shop, payload } = await authenticate.webhook(request);
  const orderId = payload.id?.toString() || payload.token || "unknown";
  const revenue = payload.total_price ? parseFloat(payload.total_price) : 0;

  console.log(`[SectionLift Webhook] Shop: ${shop}, Order ID: ${orderId}, Total: ${revenue}`);
  console.log(`[SectionLift Webhook] Note Attributes:`, JSON.stringify(payload.note_attributes));
  console.log(`[SectionLift Webhook] Line Items:`, JSON.stringify((payload.line_items || []).map(i => ({ handle: i.handle, price: i.price, qty: i.quantity }))));

  // Cart attributes set via /cart/update.js become note_attributes on the order.
  // This is the fallback purchase tracking path (primary path is the Web Pixel).
  const attrs = payload.note_attributes || [];

  // Check if any A/B test attributes exist at all
  const abAttrs = attrs.filter(a => a.name?.startsWith("_ab_test_"));
  if (abAttrs.length === 0) {
    console.log(`[SectionLift Webhook] No A/B test attributes on this order. Cart attribute tracking may not be set up or customer cleared cart.`);
    return new Response("OK", { status: 200 });
  }

  console.log(`[SectionLift Webhook] Found ${abAttrs.length} A/B test attribute(s):`, abAttrs.map(a => `${a.name}=${a.value}`).join(', '));

  for (const attr of abAttrs) {
    const testId = attr.name.replace("_ab_test_", "").trim();
    const variant = (attr.value || "").trim();
    if (!testId || !variant) continue;

    try {
      const test = await db.aBTest.findFirst({ where: { id: testId, shop_domain: shop } });
      if (!test) {
        console.warn(`[SectionLift Webhook] Test not found: ${testId}`);
        continue;
      }

      // Get the real visitor_id that was stored in cart attributes by ab_tracker.liquid
      const visitorIdAttr = attrs.find(a => a.name === '_sectify_vid');
      const realVisitorId = visitorIdAttr?.value || orderId; // fall back to orderId if not set

      // Deduplicate: check by order_id first
      const existingByOrderId = await db.aBTestEvent.findFirst({
        where: { test_id: testId, order_id: orderId, event_type: "PURCHASE" }
      });
      if (existingByOrderId) {
        console.log(`[SectionLift Webhook] Skipping duplicate — order ${orderId} already tracked for test ${testId}`);
        continue;
      }

      // Also dedup by visitor_id within 3 minutes (catches pixel-tracked purchases for same order)
      const existingByVisitor = await db.aBTestEvent.findFirst({
        where: {
          test_id: testId,
          visitor_id: realVisitorId,
          event_type: "PURCHASE",
          created_at: { gte: new Date(Date.now() - 3 * 60 * 1000) }
        }
      });
      if (existingByVisitor) {
        console.log(`[SectionLift Webhook] Skipping duplicate — visitor ${realVisitorId} already has a PURCHASE for test ${testId} within 3 mins (pixel already tracked it)`);
        continue;
      }

      // Get the product attributes for this test if available
      const productHandleAttr = attrs.find(a => a.name === `_sectify_ph_${testId}`);
      const productHandle = productHandleAttr?.value || null;
      const productIdAttr = attrs.find(a => a.name === `_sectify_pid_${testId}`);
      const targetProductId = productIdAttr?.value ? String(productIdAttr.value) : null;
      const productTitleAttr = attrs.find(a => a.name === `_sectify_pt_${testId}`);
      const targetProductTitle = productTitleAttr?.value ? productTitleAttr.value.toLowerCase().trim() : null;

      // Compute revenue: sum line items matching product ID, title, or handle
      let eventRevenue = revenue; // fallback to full order total
      if ((targetProductId || targetProductTitle || productHandle) && payload.line_items?.length > 0) {
        const matchedItems = payload.line_items.filter(item => {
          const idMatch = targetProductId && String(item.product_id) === targetProductId;
          const titleMatch = targetProductTitle && item.title?.toLowerCase().trim() === targetProductTitle;
          const handleMatch = productHandle && item.handle === productHandle;
          return idMatch || titleMatch || handleMatch;
        });

        if (matchedItems.length > 0) {
          eventRevenue = matchedItems.reduce((sum, item) => {
            return sum + parseFloat(item.price) * (item.quantity || 1);
          }, 0);
          console.log(`[SectionLift Webhook] Filtered revenue for product (id=${targetProductId}, handle=${productHandle}): ${eventRevenue} (order total was ${revenue})`);
        } else {
          console.warn(`[SectionLift Webhook] No line items matched product filter — using full order total`);
        }
      }

      await db.aBTestEvent.create({
        data: {
          test_id: testId,
          shop_domain: shop,
          visitor_id: realVisitorId,  // use the real visitor ID from cart attributes
          variant,
          event_type: "PURCHASE",
          revenue: eventRevenue,
          order_id: orderId,          // explicit order_id for cross-path dedup
        }
      });

      console.log(`[SectionLift Webhook] ✅ PURCHASE tracked: test=${testId} variant=${variant} order=${orderId} revenue=${eventRevenue} product=${productHandle || 'all'}`);
    } catch (err) {
      console.error(`[SectionLift Webhook] Error for test ${testId}:`, err);
    }
  }

  return new Response("OK", { status: 200 });
};
