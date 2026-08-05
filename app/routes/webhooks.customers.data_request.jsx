import { authenticate } from "../shopify.server";

export const loader = async () => {
  return new Response("Method not allowed", { status: 405 });
};

export const action = async ({ request }) => {
  try {
    const { payload, shop, topic } = await authenticate.webhook(request);

    // The app doesn't store customer records, so there is no customer data to
    // export. Authentication above verifies the raw body and HMAC signature.
    console.log(`Received ${topic} webhook for ${shop}`, {
      customerId: payload.customer?.id,
    });

    return new Response(null, { status: 200 });
  } catch (error) {
    // If HMAC verification fails, authenticate.webhook throws a Response
    if (error instanceof Response) {
      return error;
    }
    console.error("Webhook error (customers/data_request):", error);
    return new Response("Unauthorized", { status: 401 });
  }
};
