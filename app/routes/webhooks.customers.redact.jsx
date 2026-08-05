
import { verifyHmac } from "../hmac-verify.server";

export const loader = async () => {
  throw new Response("Method not allowed", { status: 405 });
};

export const action = async ({ request }) => {
  const isValidHmac = await verifyHmac(request);
  if (!isValidHmac) {
    return new Response("Unauthorized", { status: 401 });
  }

  console.log("Received customers/redact webhook");
  return new Response("OK", { status: 200 });
};
