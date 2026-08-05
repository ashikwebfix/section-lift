
import { verifyHmac } from "../hmac-verify.server";
import db from "../db.server";

export const loader = async () => {
  throw new Response("Method not allowed", { status: 405 });
};

export const action = async ({ request }) => {
  const clonedReq = request.clone();
  const isValidHmac = await verifyHmac(request);
  if (!isValidHmac) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const payload = await clonedReq.json();
    const shop = payload.shop_domain;
    if (shop) {
      console.log(`Received shop/redact webhook for ${shop}`);
      await db.session.deleteMany({ where: { shop } });
      await db.shop.deleteMany({ where: { shop_domain: shop } });
    }
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
};
