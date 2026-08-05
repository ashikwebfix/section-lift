import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async () => {
  return new Response("Method not allowed", { status: 405 });
};

export const action = async ({ request }) => {
  try {
    const { payload, session, topic, shop } = await authenticate.webhook(request);
    console.log(`Received ${topic} webhook for ${shop}`);
    const current = payload.current;

    if (session) {
      await db.session.update({
        where: { id: session.id },
        data: { scope: current.toString() },
      });
    }

    return new Response(null, { status: 200 });
  } catch (error) {
    // If HMAC verification fails, authenticate.webhook throws a Response
    if (error instanceof Response) {
      return error;
    }
    console.error("Webhook error (app/scopes_update):", error);
    return new Response("Internal Server Error", { status: 500 });
  }
};
