import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async () => {
  throw new Response("Method not allowed", { status: 405 });
};

export const action = async ({ request }) => {
  const { shop, topic } = await authenticate.webhook(request);

  try {
    console.log(`Received ${topic} webhook for ${shop}`);

    await db.$transaction([
      db.session.deleteMany({ where: { shop } }),
      db.entitlement.deleteMany({ where: { shop_domain: shop } }),
      db.installation.deleteMany({ where: { shop_domain: shop } }),
      db.shop.deleteMany({ where: { shop_domain: shop } }),
    ]);

    return new Response();
  } catch (err) {
    console.error("Webhook processing error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
};
