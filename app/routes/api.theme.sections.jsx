import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const page = url.searchParams.get("page") || "index"; // e.g. "index", "product", "collection"

  try {
    // 1. Get the MAIN theme ID
    const themeResponse = await admin.graphql(`
      query {
        themes(roles: [MAIN], first: 1) {
          nodes {
            id
          }
        }
      }
    `);
    const themeData = await themeResponse.json();
    const mainTheme = themeData.data.themes.nodes[0];
    
    if (!mainTheme) {
      return Response.json({ error: "No main theme found" }, { status: 404 });
    }
    
    // Extract numeric ID from "gid://shopify/Theme/123456789"
    const themeId = mainTheme.id.split("/").pop();

    // 2. Fetch the requested JSON template using standard fetch
    const response = await fetch(`https://${session.shop}/admin/api/2026-10/themes/${themeId}/assets.json?asset[key]=templates/${page}.json`, {
      headers: {
        'X-Shopify-Access-Token': session.accessToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      return Response.json({ error: `Template ${page}.json not found` }, { status: 404 });
    }
    
    const data = await response.json();
    const templateAsset = data.asset;
    
    if (!templateAsset || !templateAsset.value) {
      return Response.json({ error: `Template ${page}.json is empty` }, { status: 404 });
    }

    const templateJson = JSON.parse(templateAsset.value);
    
    // 3. Extract sections
    const sections = [];
    if (templateJson.sections) {
      for (const [key, section] of Object.entries(templateJson.sections)) {
        sections.push({
          id: key, // e.g. "16453789-23423-abcd" or "main"
          type: section.type // e.g. "image-banner"
        });
      }
    }

    return Response.json({ sections });
  } catch (error) {
    console.error("Error fetching theme sections:", error);
    return Response.json({ error: "Failed to fetch sections" }, { status: 500 });
  }
};
