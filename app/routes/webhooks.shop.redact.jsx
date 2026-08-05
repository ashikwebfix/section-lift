import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async () => {
  return new Response("Method not allowed", { status: 405 });
};

export const action = async ({ request }) => {
  try {
    const { shop, topic } = await authenticate.webhook(request);

    console.log(`Received ${topic} webhook for ${shop}`);

    await db.$transaction([
      db.session.deleteMany({ where: { shop } }),
      db.entitlement.deleteMany({ where: { shop_domain: shop } }),
      db.installation.deleteMany({ where: { shop_domain: shop } }),
      db.shop.deleteMany({ where: { shop_domain: shop } }),
    ]);

    return new Response(null, { status: 200 });
  } catch (error) {
    // If HMAC verification fails, authenticate.webhook throws a Response
    if (error instanceof Response) {
      return error;
    }
    console.error("Webhook error (shop/redact):", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
