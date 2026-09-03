
import db from "../db.server";
import crypto from "crypto";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  const shopDomain = url.searchParams.get("shop");
  const pageUrl = url.searchParams.get("url") || "/";
  const visitorId = url.searchParams.get("vid");

  // Basic CORS headers to allow storefront requests
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!shopDomain) {
    return Response.json({ error: "Missing shop parameter" }, { status: 400, headers: corsHeaders });
  }

  // Find ALL active tests for this shop
  const allActiveTests = await db.aBTest.findMany({
    where: {
      shop_domain: shopDomain,
      status: "ACTIVE"
    }
  });

  // Filter tests by pageUrl in JavaScript to support prefix matching (e.g. /products/)
  const activeTests = allActiveTests.filter(test => {
    if (!test.page_url || test.page_url === "") return true; // Global tests
    if (test.page_url === "/") return pageUrl === "/" || pageUrl.length <= 3; // Homepage (allowing for locale like /en)
    return pageUrl.startsWith(test.page_url);
  });

  if (activeTests.length === 0) {
    return Response.json({ tests: [] }, { headers: corsHeaders });
  }

  // Determine split for the visitor for each active test
  // A consistent way is to hash the visitorId + testId to determine the split
  const assignedTests = activeTests.map(test => {
    // Generate a pseudo-random number based on visitorId and testId
    const hash = crypto.createHash("md5").update(`${visitorId}-${test.id}`).digest("hex");
    const hashInt = parseInt(hash.substring(0, 8), 16);
    const randomPercentage = hashInt % 100; // 0-99
    
    // Example: if traffic_split is 50, then < 50 is Variant B, >= 50 is Variant A (Original)
    // Wait, variant_id is usually Variant B. So if random < traffic_split -> B, else A.
    const assignedVariant = randomPercentage < test.traffic_split ? 'B' : 'A';
    
    return {
      id: test.id,
      name: test.name,
      original_id: test.original_id,
      variant_id: test.variant_id,
      assigned_variant: assignedVariant
    };
  });

  return Response.json({ tests: assignedTests }, { headers: corsHeaders });
};

// Also support POST if they send it via POST
export const action = async ({ request }) => {
  return loader({ request });
};
