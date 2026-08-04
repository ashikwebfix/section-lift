import { useEffect } from "react";
import { useLoaderData, useFetcher, useNavigate, Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { useAppBridge } from "@shopify/app-bridge-react";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request, params }) => {
  const { session, billing } = await authenticate.admin(request);
  const { handle } = params;

  const section = await prisma.section.findUnique({
    where: { handle },
    include: { category: true },
  });

  if (!section) {
    throw new Response("Section Not Found", { status: 404 });
  }

  const entitlement = await prisma.entitlement.findFirst({
    where: {
      shop_domain: session.shop,
      section_id: section.id,
      status: "ACTIVE",
    },
  });

  const { hasActivePayment } = await billing.check({
    plans: [MONTHLY_PLAN],
    isTest: true,
  });

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const claimsThisMonth = await prisma.entitlement.count({
    where: {
      shop_domain: session.shop,
      source_type: "SUBSCRIPTION",
      granted_at: {
        gte: startOfMonth,
      }
    }
  });

  const SUBSCRIPTION_LIMIT = process.env.SUBSCRIPTION_LIMIT ? parseInt(process.env.SUBSCRIPTION_LIMIT) : 10;

  return { 
    section, 
    isOwned: !!entitlement,
    apiKey: process.env.SHOPIFY_API_KEY,
    hasSubscription: hasActivePayment,
    claimsThisMonth,
    subscriptionLimit: SUBSCRIPTION_LIMIT
  };
};

export const action = async ({ request, params }) => {
  const { session, admin, billing } = await authenticate.admin(request);
  const { handle } = params;
  const formData = await request.formData();
  const intent = formData.get("intent");
  const section = await prisma.section.findUnique({ where: { handle } });

  if (!section) return { success: false, error: "Section not found" };

  if (intent === "claim_free") {
    if (!section.is_free) return { success: false, error: "Invalid claim request" };

    const existing = await prisma.entitlement.findFirst({
      where: { shop_domain: session.shop, section_id: section.id },
    });

    if (!existing) {
      await prisma.entitlement.create({
        data: {
          shop_domain: session.shop,
          section_id: section.id,
          source_type: "FREE",
          status: "ACTIVE",
        },
      });
    }

    return { success: true, action: "claimed" };
  }

  if (intent === "claim_subscription") {
    if (section.is_free || section.is_exclusive) return { success: false, error: "Invalid claim request" };
    
    const { hasActivePayment } = await billing.check({ plans: [MONTHLY_PLAN], isTest: true });
    if (!hasActivePayment) return { success: false, error: "No active subscription" };

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const claimsThisMonth = await prisma.entitlement.count({
      where: {
        shop_domain: session.shop,
        source_type: "SUBSCRIPTION",
        granted_at: { gte: startOfMonth }
      }
    });

    const SUBSCRIPTION_LIMIT = process.env.SUBSCRIPTION_LIMIT ? parseInt(process.env.SUBSCRIPTION_LIMIT) : 10;
    if (claimsThisMonth >= SUBSCRIPTION_LIMIT) {
       return { success: false, error: "Monthly limit reached" };
    }

    const existing = await prisma.entitlement.findFirst({
      where: { shop_domain: session.shop, section_id: section.id },
    });

    if (!existing) {
      await prisma.entitlement.create({
        data: {
          shop_domain: session.shop,
          section_id: section.id,
          source_type: "SUBSCRIPTION",
          status: "ACTIVE",
        },
      });
    }

    return { success: true, action: "claimed" };
  }

  if (intent === "purchase") {
    if (section.is_free) return { success: false, error: "Section is free" };

    const returnUrl = `https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app/purchase-callback?section_id=${section.id}`;
    const chargeName = `EFX_SECTION_${section.handle}`;
    
    const response = await admin.graphql(
      `#graphql
      mutation appPurchaseOneTimeCreate($name: String!, $price: MoneyInput!, $returnUrl: URL!, $test: Boolean!) {
        appPurchaseOneTimeCreate(name: $name, price: $price, returnUrl: $returnUrl, test: $test) {
          userErrors {
            field
            message
          }
          confirmationUrl
        }
      }`,
      {
        variables: {
          name: chargeName,
          price: { amount: section.price, currencyCode: "USD" },
          returnUrl: returnUrl,
          test: true
        },
      }
    );
    
    const responseJson = await response.json();
    const data = responseJson.data.appPurchaseOneTimeCreate;

    if (data.userErrors.length > 0) {
      return { success: false, error: data.userErrors[0].message };
    }

    return { success: true, action: "purchase_redirect", confirmationUrl: data.confirmationUrl };
  }

  return { success: false };
};

export default function SectionDetail() {
  const { section, isOwned, hasSubscription, claimsThisMonth, subscriptionLimit } = useLoaderData();
  const fetcher = useFetcher();
  const shopify = useAppBridge();
  const navigate = useNavigate();

  const isClaiming = fetcher.state === "submitting" && fetcher.formData?.get("intent") === "claim_free";
  const isClaimingSub = fetcher.state === "submitting" && fetcher.formData?.get("intent") === "claim_subscription";
  const isPurchasing = fetcher.state === "submitting" && fetcher.formData?.get("intent") === "purchase";

  useEffect(() => {
    if (fetcher.data?.success) {
      if (fetcher.data.action === "claimed") {
        shopify.toast.show("Section claimed successfully!");
      } else if (fetcher.data.action === "purchase_redirect") {
        open(fetcher.data.confirmationUrl, "_top");
      }
    } else if (fetcher.data?.error) {
      shopify.toast.show(fetcher.data.error, { isError: true });
    }
  }, [fetcher.data, shopify]);

  const handleClaim = () => {
    fetcher.submit({ intent: "claim_free" }, { method: "POST" });
  };

  const handleClaimSub = () => {
    fetcher.submit({ intent: "claim_subscription" }, { method: "POST" });
  };

  const handlePurchase = () => {
    fetcher.submit({ intent: "purchase" }, { method: "POST" });
  };

  const currentlyOwned = isOwned || (fetcher.data?.success && fetcher.data?.action === "claimed");

  return (
    <div className="efx-flex efx-flex-col efx-gap-lg" style={{ padding: '32px' }}>
      <button 
        onClick={() => navigate("/app/discover")}
        className="efx-button efx-button-secondary"
        style={{ alignSelf: 'flex-start', padding: '6px 12px' }}
      >
        &larr; Back to Discover
      </button>

      <div className="efx-flex efx-flex-col efx-gap-sm efx-mb-md">
        <span className="efx-text-subdued" style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {section.category?.name}
        </span>
        <h1 className="efx-heading-xl" style={{ margin: 0 }}>{section.name}</h1>
      </div>

      <div className="efx-grid-2">
        <div className={`efx-glass-card ${section.is_exclusive ? 'efx-premium-card' : ''}`} style={{ padding: section.is_exclusive ? '2px' : 0 }}>
           {section.preview_image_url ? (
             <img src={section.preview_image_url} alt={section.name} style={{ width: '100%', height: '100%', objectFit: 'cover', minHeight: '300px', display: 'block' }} />
           ) : (
             <div style={{ height: '100%', minHeight: '300px', backgroundColor: '#e4e5e7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
               <span className="efx-text-subdued">Section Preview</span>
             </div>
           )}
        </div>

        <div className="efx-flex efx-flex-col efx-gap-md">
          <div className="efx-solid-card efx-flex efx-flex-col efx-gap-md">
            <h2 className="efx-heading-lg">{section.is_free ? "Free" : `$${section.price.toFixed(2)}`}</h2>
            <p className="efx-text-body">{section.full_description}</p>
            
            <div className="efx-mt-sm">
              {currentlyOwned ? (
                <Link to="/app/my-sections" className="efx-button efx-button-primary" style={{ textDecoration: 'none' }}>
                  Go to My Sections
                </Link>
              ) : section.is_free ? (
                <button className="efx-button efx-button-primary" onClick={handleClaim} disabled={isClaiming}>
                  {isClaiming ? 'Claiming...' : 'Claim Free Section'}
                </button>
              ) : section.is_exclusive ? (
                <button className="efx-button efx-button-primary efx-button-premium" onClick={handlePurchase} disabled={isPurchasing}>
                  {isPurchasing ? 'Processing...' : 'Purchase Section (Premium)'}
                </button>
              ) : hasSubscription ? (
                claimsThisMonth < subscriptionLimit ? (
                  <button className="efx-button efx-button-primary" onClick={handleClaimSub} disabled={isClaimingSub}>
                    {isClaimingSub ? 'Claiming...' : `Claim with Subscription (${subscriptionLimit - claimsThisMonth} left)`}
                  </button>
                ) : (
                  <div className="efx-flex efx-flex-col efx-gap-sm">
                    <button className="efx-button efx-button-primary" onClick={handlePurchase} disabled={isPurchasing}>
                      {isPurchasing ? 'Processing...' : 'Purchase Section'}
                    </button>
                    <p className="efx-text-subdued efx-text-sm" style={{ margin: 0 }}>You have reached your monthly subscription limit.</p>
                  </div>
                )
              ) : (
                <div className="efx-flex efx-flex-col efx-gap-sm">
                  <button className="efx-button efx-button-primary" onClick={handlePurchase} disabled={isPurchasing}>
                    {isPurchasing ? 'Processing...' : 'Purchase Section (One-Time)'}
                  </button>
                  <Link to="/app/pricing" className="efx-button efx-button-secondary" style={{ textDecoration: 'none', textAlign: 'center' }}>
                    Subscribe to Claim Sections
                  </Link>
                </div>
              )}
            </div>
          </div>
          
          <div className="efx-solid-card">
            <h3 className="efx-heading-md">Features</h3>
            <ul style={{ paddingLeft: '20px', margin: 0 }} className="efx-text-body efx-text-subdued">
              <li>100% Native Liquid Code</li>
              <li>No external app dependencies</li>
              <li>Installs directly into your theme</li>
              <li>One-time purchase (keep forever)</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
