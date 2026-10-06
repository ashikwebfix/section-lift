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

    // 2. Fetch the list of all assets
    const assetsResponse = await fetch(`https://${session.shop}/admin/api/2026-10/themes/${themeId}/assets.json`, {
      headers: {
        'X-Shopify-Access-Token': session.accessToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (!assetsResponse.ok) {
      return Response.json({ error: `Failed to fetch theme assets` }, { status: 500 });
    }
    
    const assetsData = await assetsResponse.json();
    
    // Find all JSON templates that start with the requested page type (e.g., templates/product.json, templates/product.alternate.json)
    // Avoid matching "templates/product_something.json" (must be exact match or have a dot suffix).
    // The pattern is: `templates/${page}.json` OR `templates/${page}.*.json`
    const matchingAssets = assetsData.assets.filter(a => {
      if (!a.key.startsWith('templates/')) return false;
      if (!a.key.endsWith('.json')) return false;
      const basename = a.key.replace('templates/', '').replace('.json', '');
      return basename === page || basename.startsWith(`${page}.`);
    });

    if (matchingAssets.length === 0) {
      return Response.json({ templates: [] });
    }

    // 3. Fetch the content for each matching template concurrently
    const templates = await Promise.all(matchingAssets.map(async (asset) => {
      const res = await fetch(`https://${session.shop}/admin/api/2026-10/themes/${themeId}/assets.json?asset[key]=${asset.key}`, {
        headers: {
          'X-Shopify-Access-Token': session.accessToken,
          'Content-Type': 'application/json'
        }
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.asset || !data.asset.value) return null;
      
      const templateJson = JSON.parse(data.asset.value);
      const sections = [];
      if (templateJson.sections) {
        for (const [key, section] of Object.entries(templateJson.sections)) {
          sections.push({
            id: key,
            type: section.type
          });
        }
      }
      
      const templateName = asset.key.replace('templates/', '').replace('.json', ''); // e.g. "product.alternate"
      
      return {
        name: templateName,
        sections
      };
    }));

    // Filter out nulls and templates with no sections
    const validTemplates = templates.filter(t => t !== null && t.sections.length > 0);

    // To remain somewhat backwards compatible if the UI hasn't fully updated yet,
    // we return the first template's sections at the root, AND the new `templates` array.
    const defaultTemplate = validTemplates.find(t => t.name === page) || validTemplates[0];
    const sections = defaultTemplate ? defaultTemplate.sections : [];

    return Response.json({ sections, templates: validTemplates });
  } catch (error) {
    console.error("Error fetching theme sections:", error);
    return Response.json({ error: "Failed to fetch sections" }, { status: 500 });
  }
};
