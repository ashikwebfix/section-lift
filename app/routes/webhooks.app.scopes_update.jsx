import { authenticate } from "../shopify.server";
import db from "../db.server";

export const loader = async () => {
  throw new Response("Method not allowed", { status: 405 });
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

    return new Response();
  } catch (err) {
    if (err instanceof Response || (err && typeof err.status === 'number')) {
      return new Response(null, { status: 401 });
    }
    console.error("Webhook processing error:", err);
    return new Response("Internal Server Error", { status: 500 });
  }
};
