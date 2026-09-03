
import db from "../db.server";

export const action = async ({ request }) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const data = await request.json();
    const { test_id, shop_domain, visitor_id, variant, event_type } = data;

    if (!test_id || !shop_domain || !visitor_id || !variant || !event_type) {
      return Response.json({ error: "Missing required fields" }, { status: 400, headers: corsHeaders });
    }

    // Verify test exists and is active
    const test = await db.aBTest.findUnique({
      where: { id: test_id }
    });

    if (!test || test.status !== "ACTIVE") {
      return Response.json({ error: "Test not found or inactive" }, { status: 404, headers: corsHeaders });
    }

    // Insert the event
    await db.aBTestEvent.create({
      data: {
        test_id,
        shop_domain,
        visitor_id,
        variant,
        event_type
      }
    });

    return Response.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("Failed to track AB test event:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500, headers: corsHeaders });
  }
};
