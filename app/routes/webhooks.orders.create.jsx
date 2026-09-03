import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { topic, shop, session, admin, payload } = await authenticate.webhook(request);

  if (!admin) {
    // The admin context isn't available if the webhook is not authenticated
    return new Response();
  }

  // The payload contains the order data
  // We need to look for cart attributes that indicate an A/B test assignment
  // e.g. _ab_test_{id} = "A" or "B"
  
  if (payload.note_attributes) {
    for (const attr of payload.note_attributes) {
      if (attr.name.startsWith('_ab_test_')) {
        const testId = attr.name.replace('_ab_test_', '');
        const variant = attr.value;
        
        // Find if test is active
        const test = await db.aBTest.findFirst({
          where: { id: testId, shop_domain: shop }
        });
        
        if (test && test.status === 'ACTIVE') {
          // Log purchase event
          await db.aBTestEvent.create({
            data: {
              test_id: testId,
              shop_domain: shop,
              visitor_id: payload.customer?.id?.toString() || payload.token || "unknown", // Fallback visitor id for purchase
              variant: variant,
              event_type: 'PURCHASE'
            }
          });
        }
      }
    }
  }

  return new Response("OK", { status: 200 });
};
