import db from "./db.server";

export async function syncWebPixel(admin, request) {
  try {
    let appUrl = (process.env.SHOPIFY_APP_URL || process.env.APP_URL || process.env.HOST || '').replace(/\/$/, '');
    if (!appUrl && request) {
      const u = new URL(request.url);
      appUrl = `${u.protocol}//${u.host}`.replace(/\/$/, '');
    }
    if (!appUrl) {
      console.warn("[SectionLift] Cannot sync Web Pixel: appUrl could not be determined");
      return;
    }

    const trackUrl = `${appUrl}/api/ab-tests/track`;
    const pixelSettings = JSON.stringify({ accountID: "section-lift", trackUrl });

    console.log("[SectionLift] Syncing Web Pixel. trackUrl:", trackUrl);

    // Look up existing pixel
    const pixelRes = await admin.graphql(`{ webPixel { id settings } }`);
    const pixelData = await pixelRes.json();
    const pixelId = pixelData.data?.webPixel?.id;
    const currentSettings = pixelData.data?.webPixel?.settings;

    if (pixelId) {
      // Check if update is needed
      if (currentSettings !== pixelSettings) {
        const updateRes = await admin.graphql(
          `mutation UpdatePixel($id: ID!, $s: JSON!) {
            webPixelUpdate(id: $id, webPixel: { settings: $s }) {
              userErrors { message field }
              webPixel { id settings }
            }
          }`,
          { variables: { id: pixelId, s: pixelSettings } }
        );
        const updateData = await updateRes.json();
        const errs = updateData.data?.webPixelUpdate?.userErrors;
        if (errs?.length) {
          console.warn("[SectionLift] webPixelUpdate errors:", JSON.stringify(errs));
        } else {
          console.log("[SectionLift] ✅ Web Pixel updated with trackUrl:", trackUrl);
        }
      } else {
        console.log("[SectionLift] Web Pixel already up-to-date with trackUrl:", trackUrl);
      }
    } else {
      const createRes = await admin.graphql(
        `mutation CreatePixel($s: JSON!) {
          webPixelCreate(webPixel: { settings: $s }) {
            userErrors { message field }
            webPixel { id settings }
          }
        }`,
        { variables: { s: pixelSettings } }
      );
      const createData = await createRes.json();
      const errs = createData.data?.webPixelCreate?.userErrors;
      if (errs?.length) {
        console.warn("[SectionLift] webPixelCreate errors:", JSON.stringify(errs));
      } else {
        console.log("[SectionLift] ✅ Web Pixel created with trackUrl:", trackUrl);
      }
    }
  } catch (err) {
    console.warn("[SectionLift] Web Pixel sync error (non-fatal):", err.message);
  }
}
