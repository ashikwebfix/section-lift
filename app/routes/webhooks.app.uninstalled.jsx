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
    const { shop, session, topic } = await authenticate.webhook(request);
    console.log(`Received ${topic} webhook for ${shop}`);

    if (session) {
      await db.session.deleteMany({ where: { shop } });
    }

    await db.shop.update({
      where: { shop_domain: shop },
      data: {
        status: "UNINSTALLED",
        uninstalled_at: new Date()
      }
    });

    return new Response();
  } catch (err) {
    if (err instanceof Response || (err && typeof err.status === 'number')) {
      return new Response(null, { status: 401 });
    }
    console.error("Webhook processing error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
};
