import { authenticate } from "../shopify.server";

export const loader = async () => {
  throw new Response("Method not allowed", { status: 405 });
};

export const action = async ({ request }) => {
  const { payload, shop, topic } = await authenticate.webhook(request);

  // The app doesn't persist customer records. A successful authenticated
  // response acknowledges that there is no customer data left to redact.
  console.log(`Received ${topic} webhook for ${shop}`, {
    customerId: payload.customer?.id,
  });

  return new Response();
};
