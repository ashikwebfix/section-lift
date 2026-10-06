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
    await billing.request({ plan: MONTHLY_PLAN, isTest: true });
  }

  if (intent === "cancel") {
    const billingCheck = await billing.check({ plans: [MONTHLY_PLAN], isTest: true });
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

const Check = ({ muted = false }) => (
  <svg
    width="16" height="16" viewBox="0 0 24 24" fill="none"
    stroke={muted ? "currentColor" : "currentColor"}
    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
    style={{ flexShrink: 0, opacity: muted ? 0.3 : 1 }}
  >
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const features = {
  free: [
    { text: "Access to all free sections & pages", included: true },
    { text: "One-time purchase of premium sections", included: true },
    { text: "Own purchased sections forever", included: true },
    { text: "Monthly claim credits", included: false },
    { text: "Huge savings vs individual purchases", included: false },
  ],
  pro: [
    { text: "Access to all free sections & pages", included: true },
    { text: "One-time purchase of premium sections", included: true },
    { text: "Own claimed sections forever", included: true },
    { text: "10 premium claim credits / month", included: true, highlight: true },
    { text: "Huge savings vs individual purchases", included: true },
  ],
};

export default function Pricing() {
  const { hasActivePayment } = useLoaderData();
  const fetcher = useFetcher();

  const isSubscribing = fetcher.state === "submitting" && fetcher.formData?.get("intent") === "subscribe";
  const isCancelling = fetcher.state === "submitting" && fetcher.formData?.get("intent") === "cancel";

  return (
    <div style={{ padding: "48px 32px", maxWidth: "860px" }}>

      {/* Header */}
      <div style={{ marginBottom: "40px" }}>
        <h1 className="sl-page-title" style={{ fontSize: "26px" }}>Plans &amp; Pricing</h1>
        <p className="sl-body sl-mt-2">
          Start for free. Upgrade when you need more.
        </p>
      </div>

      {/* Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "20px", alignItems: "start" }}>

        {/* Free / Starter */}
        <div className="sl-pricing-card">
          <div style={{ marginBottom: "24px" }}>
            <div className="sl-label sl-mb-2">Starter</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "8px" }}>
              <span className="sl-pricing-price">$0</span>
              <span className="sl-caption">/&nbsp;forever</span>
            </div>
            <p className="sl-caption">Pay as you go. Perfect for new stores.</p>
          </div>

          <hr className="sl-divider" style={{ marginBottom: "24px" }} />

          <div style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1, marginBottom: "32px" }}>
            {features.free.map((f, i) => (
              <div key={i} className="sl-pricing-feature" style={{ color: f.included ? "var(--sl-text-primary)" : "var(--sl-text-tertiary)" }}>
                <Check muted={!f.included} />
                <span style={{ fontSize: "13px", fontWeight: f.included ? 500 : 400 }}>{f.text}</span>
              </div>
            ))}
          </div>

          {!hasActivePayment ? (
            <div
              className="sl-btn sl-btn-secondary sl-w-full"
              style={{ cursor: "default", justifyContent: "center", gap: "8px" }}
            >
              <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "var(--sl-success)", flexShrink: 0 }}></span>
              Current Plan
            </div>
          ) : (
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="cancel" />
              <button
                type="submit"
                className="sl-btn sl-btn-secondary sl-w-full"
                disabled={isCancelling}
              >
                {isCancelling ? "Downgrading..." : "Downgrade to Free"}
              </button>
            </fetcher.Form>
          )}
        </div>

        {/* Pro */}
        <div style={{ position: "relative" }}>
          <div style={{
            position: "absolute", top: "-12px", left: "50%", transform: "translateX(-50%)",
            background: "var(--sl-text-primary)", color: "white",
            padding: "4px 14px", borderRadius: "99px",
            fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
            whiteSpace: "nowrap", zIndex: 10,
          }}>
            MOST POPULAR
          </div>

          <div className="sl-pricing-card sl-pricing-card-featured" style={{ color: "white" }}>
            <div style={{ marginBottom: "24px" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", opacity: 0.6, marginBottom: "8px" }}>Pro</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "8px" }}>
                <span className="sl-pricing-price" style={{ color: "white" }}>$20</span>
                <span style={{ fontSize: "12px", opacity: 0.6 }}>/&nbsp;month</span>
              </div>
              <p style={{ fontSize: "12px", opacity: 0.65 }}>For growing stores that need high-converting designs.</p>
            </div>

            <hr style={{ borderColor: "rgba(255,255,255,0.15)", marginBottom: "24px" }} />

            <div style={{ display: "flex", flexDirection: "column", gap: "14px", flex: 1, marginBottom: "32px" }}>
              {features.pro.map((f, i) => (
                <div key={i} className="sl-pricing-feature" style={{ color: "rgba(255,255,255,0.9)" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={f.highlight ? "#fbbf24" : "rgba(255,255,255,0.7)"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  <span style={{ fontSize: "13px", fontWeight: f.highlight ? 600 : 500, color: f.highlight ? "#fef3c7" : "inherit" }}>
                    {f.text}
                  </span>
                </div>
              ))}
            </div>

            {hasActivePayment ? (
              <div
                className="sl-btn sl-w-full"
                style={{ cursor: "default", background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.2)", justifyContent: "center", gap: "8px" }}
              >
                <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#34d399", flexShrink: 0 }}></span>
                Active Subscription
              </div>
            ) : (
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="subscribe" />
                <button
                  type="submit"
                  className="sl-btn sl-w-full"
                  style={{
                    background: "white", color: "var(--sl-brand)",
                    fontWeight: 700, fontSize: "14px",
                    border: "none", justifyContent: "center",
                    padding: "12px 20px",
                  }}
                  disabled={isSubscribing}
                >
                  {isSubscribing ? "Processing..." : "Upgrade to Pro →"}
                </button>
              </fetcher.Form>
            )}
          </div>
        </div>
      </div>

      {/* Fine print */}
      <p className="sl-caption sl-mt-6" style={{ maxWidth: "480px" }}>
        All plans include access to free sections with no time limit. Pro subscriptions renew monthly and can be cancelled at any time with prorated refund.
      </p>
    </div>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
