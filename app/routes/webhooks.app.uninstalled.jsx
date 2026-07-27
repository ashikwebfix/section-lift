import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // Webhook requests can trigger multiple times and after an app has already been uninstalled.
  // If this webhook already ran, the session may have been deleted previously.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  try {
    await db.shop.update({
      where: { shop_domain: shop },
      data: {
        status: "UNINSTALLED",
        uninstalled_at: new Date()
      }
    });
  } catch (e) {
    console.log(`Failed to update Shop record for ${shop}:`, e);
  }

  return new Response();
};
