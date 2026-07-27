import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);
  return null;
};

export default function Support() {
  return (
    <div className="efx-flex efx-flex-col efx-gap-lg" style={{ padding: '32px' }}>
      <h1 className="efx-heading-xl">Support &amp; FAQs</h1>
      
      <div className="efx-grid-2">
        <div className="efx-glass-card">
          <h2 className="efx-heading-lg">Frequently Asked Questions</h2>
          
          <div className="efx-mt-lg">
            <h3 className="efx-heading-md">How do I edit a section after installing it?</h3>
            <p className="efx-text-body">
              Go to your Shopify Admin, click "Online Store" &gt; "Themes", and click "Customize" on the theme you installed the section into. You will find the section available in your Theme Editor just like any native section.
            </p>
          </div>

          <div className="efx-mt-lg">
            <h3 className="efx-heading-md">What happens if I uninstall the app?</h3>
            <p className="efx-text-body">
              Any section you have installed will remain in your theme permanently. Our sections are 100% native Liquid code without hidden dependencies.
            </p>
          </div>

          <div className="efx-mt-lg">
            <h3 className="efx-heading-md">Can I install a section on multiple themes?</h3>
            <p className="efx-text-body">
              Yes! Once you own a section, you can install it on as many themes as you want within this specific Shopify store.
            </p>
          </div>
        </div>

        <div className="efx-glass-card">
          <h2 className="efx-heading-lg">Contact Support</h2>
          <p className="efx-text-body">Need help? Send us a message and our team will get back to you within 24 hours.</p>
          
          <div className="efx-mt-lg">
            <div className="efx-flex efx-flex-col efx-gap-md">
              <div>
                <div className="efx-text-subdued efx-mb-sm" style={{fontWeight: 600}}>Subject</div>
                <input type="text" className="efx-input" placeholder="How can we help?" />
              </div>
              <div>
                <div className="efx-text-subdued efx-mb-sm" style={{fontWeight: 600}}>Message</div>
                <textarea rows={4} className="efx-input" placeholder="Describe your issue..." />
              </div>
              <button className="efx-button efx-button-primary" disabled style={{width: '100%'}}>Send Message</button>
              <p className="efx-text-subdued" style={{fontSize: '0.75rem', textAlign: 'center'}}>* Contact form is a mockup for MVP phase.</p>
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
