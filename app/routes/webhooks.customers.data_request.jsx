import { authenticate } from "../shopify.server";

export const loader = async () => {
  throw new Response("Method not allowed", { status: 405 });
};

export const action = async ({ request }) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  // The app doesn't store customer records, so there is no customer data to
  // export. Authentication above verifies the raw body and HMAC signature.
  console.log(`Received ${topic} webhook for ${shop}`, {
    customerId: payload.customer?.id,
  });

  return new Response();
};
