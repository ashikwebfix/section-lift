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

const Checkmark = ({ color = "#10b981" }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const Crossmark = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px', opacity: 0.5 }}>
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

export default function Pricing() {
  const { hasActivePayment } = useLoaderData();
  const fetcher = useFetcher();

  const isSubscribing = fetcher.state === "submitting" && fetcher.formData?.get("intent") === "subscribe";
  const isCancelling = fetcher.state === "submitting" && fetcher.formData?.get("intent") === "cancel";

  return (
    <div className="efx-flex efx-flex-col efx-items-center" style={{ padding: '80px 24px', maxWidth: '1100px', margin: '0 auto', position: 'relative' }}>
      
      {/* Background Glow */}
      <div style={{ position: 'absolute', top: '10%', left: '50%', transform: 'translate(-50%, -50%)', width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(212,175,55,0.1) 0%, rgba(255,255,255,0) 70%)', zIndex: -1, pointerEvents: 'none' }}></div>

      {/* Hero Section */}
      <div className="efx-flex efx-flex-col efx-items-center efx-text-center efx-gap-md efx-mb-xl">
        <span className="efx-badge" style={{ background: 'rgba(212, 175, 55, 0.1)', color: '#b8860b', boxShadow: 'inset 0 0 0 1px rgba(212, 175, 55, 0.2)' }}>Pricing Plans</span>
        <h1 className="efx-heading-xl" style={{ margin: 0, fontSize: '3.5rem', lineHeight: '1.1' }}>Level up your storefront.</h1>
        <p className="efx-text-body efx-text-subdued" style={{ fontSize: '1.25rem', maxWidth: '600px' }}>
          Start for free and upgrade when you need to supercharge your design process with premium sections.
        </p>
      </div>

      <div className="efx-grid-2" style={{ width: '100%', gap: '32px', alignItems: 'stretch' }}>
        
        {/* Free Plan */}
        <div className="efx-glass-card efx-flex efx-flex-col" style={{ padding: '48px', position: 'relative', border: '1px solid rgba(255,255,255,0.6)', background: 'linear-gradient(145deg, rgba(255,255,255,0.9), rgba(255,255,255,0.5))' }}>
          
          <div className="efx-flex efx-flex-col efx-gap-md efx-mb-lg">
            <h2 className="efx-heading-lg" style={{ margin: 0, color: '#4b5563' }}>Starter</h2>
            <div className="efx-flex efx-items-end efx-gap-xs">
              <span className="efx-heading-xl" style={{ fontSize: '3.5rem', margin: 0, lineHeight: 1 }}>$0</span>
              <span className="efx-text-subdued" style={{ fontWeight: 600, paddingBottom: '8px' }}>/ forever</span>
            </div>
            <p className="efx-text-body efx-text-subdued" style={{ margin: 0 }}>Pay as you go. Perfect for new stores.</p>
          </div>
          
          <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(0,0,0,0.1), transparent)', margin: '24px 0' }}></div>
          
          <div className="efx-flex efx-flex-col efx-gap-lg" style={{ flexGrow: 1 }}>
            <div className="efx-flex efx-gap-md efx-items-start"><Checkmark /> <span className="efx-text-body" style={{ margin: 0, fontWeight: 500 }}>Access to all free sections</span></div>
            <div className="efx-flex efx-gap-md efx-items-start"><Checkmark /> <span className="efx-text-body" style={{ margin: 0, fontWeight: 500 }}>Purchase premium sections for a flat fee</span></div>
            <div className="efx-flex efx-gap-md efx-items-start"><Checkmark /> <span className="efx-text-body" style={{ margin: 0, fontWeight: 500 }}>Keep purchased sections forever</span></div>
            <div className="efx-flex efx-gap-md efx-items-start"><Crossmark /> <span className="efx-text-subdued" style={{ margin: 0 }}>No monthly claim credits</span></div>
          </div>
          
          <div className="efx-mt-xl">
            {!hasActivePayment ? (
              <div className="efx-button" style={{ width: '100%', background: '#f3f4f6', color: '#374151', cursor: 'default', fontWeight: 700, border: '1px solid #e5e7eb', padding: '16px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981' }}></div>
                  Current Plan
                </span>
              </div>
            ) : (
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="cancel" />
                <button type="submit" className="efx-button efx-button-secondary" style={{ width: '100%', padding: '16px', fontSize: '1rem', fontWeight: 600 }} disabled={isCancelling}>
                  {isCancelling ? 'Downgrading...' : 'Downgrade to Free'}
                </button>
              </fetcher.Form>
            )}
          </div>
        </div>

        {/* Pro Plan */}
        <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
          
          <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', background: 'linear-gradient(90deg, #fbbf24, #f59e0b)', color: '#000', padding: '6px 20px', borderRadius: '20px', fontSize: '12px', fontWeight: 800, letterSpacing: '0.1em', boxShadow: '0 4px 10px rgba(245, 158, 11, 0.4)', zIndex: 10 }}>
            MOST POPULAR
          </div>

          <div className="efx-flex efx-flex-col" style={{ padding: '48px', height: '100%', position: 'relative', background: 'linear-gradient(145deg, #1f2937, #111827)', borderRadius: 'var(--efx-radius-lg)', border: '2px solid rgba(245, 158, 11, 0.5)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 20px rgba(245, 158, 11, 0.15)' }}>
            
            <div className="efx-flex efx-flex-col efx-gap-md efx-mb-lg">
              <h2 className="efx-heading-lg" style={{ margin: 0, color: '#f3f4f6' }}>Pro</h2>
              <div className="efx-flex efx-items-end efx-gap-xs">
                <span className="efx-heading-xl" style={{ fontSize: '3.5rem', margin: 0, lineHeight: 1, color: '#fff', background: 'none', WebkitTextFillColor: 'initial' }}>$20</span>
                <span style={{ color: '#9ca3af', fontWeight: 600, paddingBottom: '8px', fontSize: '0.95rem' }}>/ month</span>
              </div>
              <p className="efx-text-body" style={{ margin: 0, color: '#9ca3af' }}>For growing stores that need high-converting designs.</p>
            </div>
            
            <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)', margin: '24px 0' }}></div>
            
            <div className="efx-flex efx-flex-col efx-gap-lg" style={{ flexGrow: 1 }}>
              <div className="efx-flex efx-gap-md efx-items-start"><Checkmark color="#fbbf24" /> <span className="efx-text-body" style={{ margin: 0, color: '#e5e7eb', fontWeight: 500 }}>Access to all free sections</span></div>
              <div className="efx-flex efx-gap-md efx-items-start"><Checkmark color="#fbbf24" /> <span className="efx-text-body" style={{ margin: 0, color: '#e5e7eb', fontWeight: 500 }}>Claim up to <strong style={{ color: '#fbbf24' }}>10 Premium Sections</strong> / month</span></div>
              <div className="efx-flex efx-gap-md efx-items-start"><Checkmark color="#fbbf24" /> <span className="efx-text-body" style={{ margin: 0, color: '#e5e7eb', fontWeight: 500 }}>Keep claimed sections forever (even if you cancel)</span></div>
              <div className="efx-flex efx-gap-md efx-items-start"><Checkmark color="#fbbf24" /> <span className="efx-text-body" style={{ margin: 0, color: '#e5e7eb', fontWeight: 500 }}>Huge savings vs single purchases</span></div>
            </div>
            
            <div className="efx-mt-xl">
              {hasActivePayment ? (
                <div className="efx-button" style={{ width: '100%', background: 'rgba(16, 185, 129, 0.1)', color: '#34d399', cursor: 'default', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.2)', padding: '16px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#34d399', boxShadow: '0 0 10px #34d399' }}></div>
                    Active Subscription
                  </span>
                </div>
              ) : (
                <fetcher.Form method="post">
                  <input type="hidden" name="intent" value="subscribe" />
                  <button type="submit" className="efx-button" style={{ width: '100%', padding: '16px', fontSize: '1.05rem', fontWeight: 700, color: '#000', background: 'linear-gradient(90deg, #fbbf24, #f59e0b)', border: 'none', boxShadow: '0 4px 10px rgba(245, 158, 11, 0.3)' }} disabled={isSubscribing}>
                    {isSubscribing ? 'Processing...' : 'Upgrade to Pro'}
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
