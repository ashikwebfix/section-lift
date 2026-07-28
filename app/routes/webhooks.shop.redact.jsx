import { authenticate } from "../shopify.server";
import { verifyHmac } from "../hmac-verify.server";
import db from "../db.server";

export const loader = async () => {
  throw new Response("Method not allowed", { status: 405 });
};

export const action = async ({ request }) => {
  const isValidHmac = await verifyHmac(request);
  if (!isValidHmac) {
    return new Response(null, { status: 401 });
  }

  try {
    const { shop, topic, payload } = await authenticate.webhook(request);
    console.log(`Received ${topic} webhook for ${shop}`);

    // Shopify sends this 48 hours after an app is uninstalled.
    // You must delete all shop data from your database.
    await db.session.deleteMany({ where: { shop } });
    await db.shop.deleteMany({ where: { shop_domain: shop } });

    return new Response();
  } catch (err) {
    if (err instanceof Response || (err && typeof err.status === 'number')) {
      return new Response(null, { status: 401 });
    }
    console.error("Webhook processing error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
};
