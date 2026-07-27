import { useLoaderData, useFetcher } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate, MONTHLY_PLAN } from "../shopify.server";

export const loader = async ({ request }) => {
  const { billing } = await authenticate.admin(request);

  const { hasActivePayment, appSubscriptions } = await billing.check({
    plans: [MONTHLY_PLAN],
    isTest: true,
  });

  return { hasActivePayment, appSubscriptions };
};

export const action = async ({ request }) => {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "subscribe") {
    await billing.request({
      plan: MONTHLY_PLAN,
      isTest: true,
    });
  }

  if (intent === "cancel") {
    const billingCheck = await billing.check({
      plans: [MONTHLY_PLAN],
      isTest: true,
    });

    if (billingCheck.hasActivePayment && billingCheck.appSubscriptions.length > 0) {
      await billing.cancel({
        subscriptionId: billingCheck.appSubscriptions[0].id,
        isTest: true,
        prorate: true,
      });
    }
    return { success: true };
  }

  return {};
};

const Checkmark = ({ color = "#059669" }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

export default function Pricing() {
  const { hasActivePayment } = useLoaderData();
  const fetcher = useFetcher();

  const isSubscribing = fetcher.state === "submitting" && fetcher.formData?.get("intent") === "subscribe";
  const isCancelling = fetcher.state === "submitting" && fetcher.formData?.get("intent") === "cancel";

  return (
    <div className="efx-flex efx-flex-col efx-items-center" style={{ padding: '64px 24px', maxWidth: '1000px', margin: '0 auto' }}>
      
      {/* Hero Section */}
      <div className="efx-flex efx-flex-col efx-items-center efx-text-center efx-gap-md efx-mb-xl">
        <h1 className="efx-heading-xl" style={{ margin: 0, fontSize: '3rem' }}>Simple, transparent pricing</h1>
        <p className="efx-text-body efx-text-subdued" style={{ fontSize: '1.15rem', maxWidth: '600px' }}>
          Choose the plan that's right for your store. Upgrade anytime to unlock premium designs.
        </p>
      </div>

      <div className="efx-grid-2" style={{ width: '100%', gap: '48px', alignItems: 'stretch' }}>
        
        {/* Free Plan / Single Purchase */}
        <div className="efx-glass-card efx-flex efx-flex-col efx-gap-lg" style={{ height: '100%', padding: '40px', position: 'relative' }}>
          <div className="efx-flex efx-flex-col efx-gap-md">
            <h2 className="efx-heading-lg" style={{ margin: 0 }}>Pay As You Go</h2>
            <div>
              <span className="efx-heading-xl" style={{ fontSize: '3rem' }}>$0</span>
              <span className="efx-text-subdued" style={{ fontWeight: 600 }}> / month</span>
            </div>
            <p className="efx-text-body efx-text-subdued">For stores getting started with custom sections.</p>
          </div>
          
          <div style={{ height: '1px', background: 'var(--efx-border-solid)', margin: '8px 0' }}></div>
          
          <div className="efx-flex efx-flex-col efx-gap-md" style={{ flexGrow: 1 }}>
            <div className="efx-flex efx-gap-sm efx-items-start"><Checkmark /> <span className="efx-text-body">Access to all free sections</span></div>
            <div className="efx-flex efx-gap-sm efx-items-start"><Checkmark /> <span className="efx-text-body">Purchase sections for a one-time fee</span></div>
            <div className="efx-flex efx-gap-sm efx-items-start"><Checkmark /> <span className="efx-text-body">Keep purchased sections forever</span></div>
            <div className="efx-flex efx-gap-sm efx-items-start"><Checkmark /> <span className="efx-text-body">100% Native Liquid Code</span></div>
          </div>
          
          <div className="efx-mt-lg">
            {!hasActivePayment ? (
              <div className="efx-button efx-button-secondary" style={{ width: '100%', pointerEvents: 'none', background: '#f3f4f6', color: '#9ca3af', borderColor: 'transparent' }}>
                Current Plan
              </div>
            ) : (
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="cancel" />
                <button type="submit" className="efx-button efx-button-secondary" style={{ width: '100%' }} disabled={isCancelling}>
                  {isCancelling ? 'Downgrading...' : 'Downgrade to Free'}
                </button>
              </fetcher.Form>
            )}
          </div>
        </div>

        {/* Subscription Plan */}
        <div className="efx-premium-card" style={{ height: '100%' }}>
          <div className="efx-flex efx-flex-col efx-gap-lg" style={{ padding: '40px', height: '100%', position: 'relative', zIndex: 2 }}>
            <div style={{ position: 'absolute', top: '16px', right: '16px', background: 'rgba(255, 215, 0, 0.15)', border: '1px solid rgba(255, 215, 0, 0.3)', color: '#d4af37', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em' }}>
              RECOMMENDED
            </div>
            
            <div className="efx-flex efx-flex-col efx-gap-md">
              <h2 className="efx-heading-lg" style={{ margin: 0 }}>Section Lift Pro</h2>
              <div>
                <span className="efx-heading-xl" style={{ fontSize: '3rem' }}>$20</span>
                <span className="efx-text-subdued" style={{ fontWeight: 600 }}> / month</span>
              </div>
              <p className="efx-text-body efx-text-subdued">For growing stores that need high-converting designs.</p>
            </div>
            
            <div style={{ height: '1px', background: 'var(--efx-border-solid)', margin: '8px 0' }}></div>
            
            <div className="efx-flex efx-flex-col efx-gap-md" style={{ flexGrow: 1 }}>
              <div className="efx-flex efx-gap-sm efx-items-start"><Checkmark color="#d4af37" /> <span className="efx-text-body">Access to all free sections</span></div>
              <div className="efx-flex efx-gap-sm efx-items-start"><Checkmark color="#d4af37" /> <span className="efx-text-body">Claim up to <strong>10 Paid Sections</strong> / month</span></div>
              <div className="efx-flex efx-gap-sm efx-items-start"><Checkmark color="#d4af37" /> <span className="efx-text-body">Keep claimed sections forever</span></div>
              <div className="efx-flex efx-gap-sm efx-items-start"><Checkmark color="#d4af37" /> <span className="efx-text-body">Huge savings vs single purchases</span></div>
            </div>
            
            <div className="efx-mt-lg">
              {hasActivePayment ? (
                <div className="efx-button efx-button-primary" style={{ width: '100%', pointerEvents: 'none', background: '#059669', boxShadow: 'none' }}>
                  ✓ Active Subscription
                </div>
              ) : (
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="subscribe" />
                  <button type="submit" className="efx-button efx-button-primary efx-button-premium" style={{ width: '100%' }} disabled={isSubscribing}>
                    {isSubscribing ? 'Processing...' : 'Subscribe to Pro'}
                  </button>
                </fetcher.Form>
              )}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
