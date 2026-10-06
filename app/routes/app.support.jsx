import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Support() {
  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: "32px", maxWidth: "1000px" }}>
      <div>
        <h1 className="sl-page-title">Support &amp; FAQs</h1>
        <p className="sl-body sl-mt-1">Find answers to common questions or reach out to our team.</p>
      </div>
      
      <div className="sl-grid-2">
        <div className="sl-card sl-card-body" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 className="sl-section-title">Frequently Asked Questions</h2>
          
          <div>
            <h3 className="sl-card-title">How do I edit a section after installing it?</h3>
            <p className="sl-body sl-mt-2">
              Go to your Shopify Admin, click "Online Store" &gt; "Themes", and click "Customize" on the theme you installed the section into. You will find the section available in your Theme Editor just like any native section.
            </p>
          </div>

          <hr className="sl-divider" />

          <div>
            <h3 className="sl-card-title">What happens if I uninstall the app?</h3>
            <p className="sl-body sl-mt-2">
              Any section you have installed will remain in your theme permanently. Our sections are 100% native Liquid code without hidden dependencies.
            </p>
          </div>

          <hr className="sl-divider" />

          <div>
            <h3 className="sl-card-title">Can I install a section on multiple themes?</h3>
            <p className="sl-body sl-mt-2">
              Yes! Once you own a section, you can install it on as many themes as you want within this specific Shopify store.
            </p>
          </div>
        </div>

        <div className="sl-card sl-card-body">
          <h2 className="sl-section-title">Contact Support</h2>
          <p className="sl-body sl-mt-2 sl-mb-6">Need help? Send us a message and our team will get back to you within 24 hours.</p>
          
          <div className="sl-field sl-mb-4">
            <label className="sl-label-text">Subject</label>
            <input type="text" className="sl-input" placeholder="How can we help?" />
          </div>
          
          <div className="sl-field sl-mb-6">
            <label className="sl-label-text">Message</label>
            <textarea className="sl-input sl-textarea" placeholder="Describe your issue in detail..." />
          </div>
          
          <button className="sl-btn sl-btn-primary sl-w-full" disabled>
            Send Message
          </button>
          
          <p className="sl-caption sl-mt-4 sl-text-center">
            * Contact form is a mockup for MVP phase.
          </p>
        </div>
      </div>
    </div>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
