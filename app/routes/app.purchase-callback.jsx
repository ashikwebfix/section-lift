import { useEffect } from "react";
import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session, admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const charge_id = url.searchParams.get("charge_id");
  const section_id = url.searchParams.get("section_id");

  if (!charge_id || !section_id) {
    return { success: false, error: "Missing required parameters." };
  }

  // Fetch the charge status
  const response = await admin.graphql(
    `#graphql
    query getPurchase($id: ID!) {
      node(id: $id) {
        ... on AppPurchaseOneTime {
          status
        }
      }
    }`,
    {
      variables: {
        id: `gid://shopify/AppPurchaseOneTime/${charge_id}`
      }
    }
  );
  
  const responseJson = await response.json();
  const status = responseJson.data?.node?.status;

  if (status === "ACTIVE") {
    // Charge was approved. Grant entitlement.
    const existing = await prisma.entitlement.findFirst({
      where: { shop_domain: session.shop, section_id },
    });

    if (!existing) {
      await prisma.entitlement.create({
        data: {
          shop_domain: session.shop,
          section_id: section_id,
          source_type: "PAID",
          status: "ACTIVE",
        },
      });
    }

    return { success: true };
  }

  return { success: false, error: "Purchase was not completed or was declined." };
};

export default function PurchaseCallback() {
  const { success, error } = useLoaderData();
  const navigate = useNavigate();

  useEffect(() => {
    // Automatically redirect back to My Sections after a short delay
    const timer = setTimeout(() => {
      navigate("/app/my-sections");
    }, 3000);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <s-page>
      <s-box padding="loose" textAlign="center">
        {success ? (
          <s-stack direction="block" alignment="center" gap="base">
            <s-heading>Purchase Successful!</s-heading>
            <s-paragraph>Your section has been added to your library.</s-paragraph>
            <s-text color="subdued">Redirecting to My Sections...</s-text>
          </s-stack>
        ) : (
          <s-stack direction="block" alignment="center" gap="base">
            <s-heading>Purchase Incomplete</s-heading>
            <s-paragraph>{error}</s-paragraph>
            <s-button href="/app/discover">Back to Discover</s-button>
          </s-stack>
        )}
      </s-box>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
