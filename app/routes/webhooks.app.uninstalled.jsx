import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async () => {
  return new Response("Method not allowed", { status: 405 });
};

export const action = async ({ request }) => {
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
        uninstalled_at: new Date(),
      },
    });

    return new Response(null, { status: 200 });
  } catch (error) {
    // If HMAC verification fails, authenticate.webhook throws a Response
    if (error instanceof Response) {
      return error;
    }
    console.error("Webhook error (app/uninstalled):", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
