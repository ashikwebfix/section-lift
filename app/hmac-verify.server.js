import crypto from 'crypto';

export async function verifyHmac(request) {
  const clonedRequest = request.clone();
  const hmac = clonedRequest.headers.get("x-shopify-hmac-sha256");
  const body = await clonedRequest.text();
  
  if (!hmac) return false;

  const secret = process.env.SHOPIFY_API_SECRET || "";
  const hash = crypto
    .createHmac("sha256", secret)
    .update(body, "utf8")
    .digest("base64");
    
  try {
    return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmac));
  } catch (e) {
    // Fails if hmac and hash are of different lengths
    return false;
  }
}
