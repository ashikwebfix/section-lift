import { authenticate } from "../shopify.server";

export const loader = async () => {
  return new Response("Method not allowed", { status: 405 });
};

export const action = async ({ request }) => {
  try {
    const { payload, shop, topic } = await authenticate.webhook(request);

    // The app doesn't persist customer records. A successful authenticated
    // response acknowledges that there is no customer data left to redact.
    console.log(`Received ${topic} webhook for ${shop}`, {
      customerId: payload.customer?.id,
    });

    return new Response(null, { status: 200 });
  } catch (error) {
    // If HMAC verification fails, authenticate.webhook throws a Response
    if (error instanceof Response) {
      return error;
    }
    console.error("Webhook error (customers/redact):", error);
    return new Response("Unauthorized", { status: 401 });
  }
};
