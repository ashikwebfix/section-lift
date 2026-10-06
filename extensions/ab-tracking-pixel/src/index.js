import { register } from "@shopify/web-pixels-extension";

register(({ analytics, browser, settings, init }) => {

  // ─────────────────────────────────────────────────────────────────
  // Track URL resolution
  // Priority:
  //   1. settings.trackUrl  — injected directly by the app server at pixel install/update
  //   2. Per-test track_url  — stored in browser.localStorage from custom_sectify_ab_test
  //   3. _sectify_track_url  — cart attribute written by ab_tracker.liquid
  //
  // NOTE: Web Pixels CANNOT POST to the store domain directly.
  //       They MUST POST to the direct app server URL (not via App Proxy).
  // ─────────────────────────────────────────────────────────────────
  const SETTINGS_TRACK_URL = (settings?.trackUrl || '').trim() || null;

  const normalizeTrackUrl = (url) => {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed || trimmed.startsWith('/')) return null; // reject relative URLs
    if (trimmed.endsWith('/api/ab-tests/track')) return trimmed;
    return trimmed.replace(/\/$/, '') + '/api/ab-tests/track';
  };

  // Live app URL takes priority because settings are updated by the server on each run
  const resolveTrackUrl = (perTestUrl) => {
    return SETTINGS_TRACK_URL || normalizeTrackUrl(perTestUrl);
  };

  // ─────────────────────────────────────────────────────────────────
  // Step 1: Receive test assignment from the storefront script.
  // Shopify.analytics.publish('custom_sectify_ab_test', data) in ab_tracker.liquid
  // sends data into this pixel sandbox, which stores it in browser.localStorage.
  // ─────────────────────────────────────────────────────────────────
  analytics.subscribe('custom_sectify_ab_test', (event) => {
    const d = event.customData;
    if (!d || !d.test_id || !d.variant || !d.visitor_id || !d.shop_domain) {
      console.warn('[SectionLift Pixel] custom_sectify_ab_test: incomplete data', JSON.stringify(d));
      return;
    }

    browser.localStorage.getItem('sectify_tests').then((raw) => {
      let tests = [];
      try { if (raw) tests = JSON.parse(raw); } catch (e) { }
      tests = tests.filter(t => t.test_id !== d.test_id);

      const resolvedTrackUrl = resolveTrackUrl(d.track_url);

      tests.push({
        test_id: d.test_id,
        variant: d.variant,
        visitor_id: d.visitor_id,
        visitor_source: d.visitor_source || null,
        shop_domain: d.shop_domain,
        track_url: resolvedTrackUrl,
        product_handle: d.product_handle || null,
        product_id: d.product_id || null,
        product_title: d.product_title || null
      });
      browser.localStorage.setItem('sectify_tests', JSON.stringify(tests));
      console.log('[SectionLift Pixel] ✅ Stored assignment:', d.test_id, '→', d.variant, '| trackUrl:', resolvedTrackUrl || 'MISSING');
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // Step 2a: checkout_completed — fires on the order confirmation page.
  // Step 2b: order_placed — alias used in some Shopify checkout versions.
  // We subscribe to BOTH and deduplicate by order_id in browser.localStorage.
  // ─────────────────────────────────────────────────────────────────

  function handlePurchaseEvent(event) {
    const checkout = event.data?.checkout;
    if (!checkout) {
      console.warn('[SectionLift Pixel] Purchase event fired but no checkout data found.');
      return;
    }

    // Shopify sets checkout.order.id after payment. checkout.token is always present.
    const orderId = String(checkout?.order?.id || checkout?.token || Date.now());

    console.log('[SectionLift Pixel] 🛒 Purchase event received.',
      '| orderId:', orderId,
      '| lineItems:', checkout?.lineItems?.length ?? 0,
      '| total:', checkout?.totalPrice?.amount,
      '| settingsTrackUrl:', SETTINGS_TRACK_URL || 'NOT SET'
    );

    // Deduplicate: avoid firing twice if both checkout_completed and order_placed fire
    browser.localStorage.getItem('sectify_fired_orders').then((raw) => {
      let firedOrders = [];
      try { if (raw) firedOrders = JSON.parse(raw); } catch (e) { }

      if (firedOrders.includes(orderId)) {
        console.log('[SectionLift Pixel] Order', orderId, 'already tracked. Skipping duplicate.');
        return;
      }

      // Mark this order as fired immediately to block duplicates
      firedOrders.push(orderId);
      if (firedOrders.length > 50) firedOrders = firedOrders.slice(-50);
      browser.localStorage.setItem('sectify_fired_orders', JSON.stringify(firedOrders));

      // Read test assignments from browser.localStorage (primary) 
      // AND from checkout.customAttributes (always as fallback/supplement)
      browser.localStorage.getItem('sectify_tests').then((raw2) => {
        let storedTests = [];
        try { if (raw2) storedTests = JSON.parse(raw2); } catch (e) { }

        console.log('[SectionLift Pixel] browser.localStorage tests:', storedTests.length);

        // Always read customAttributes too — support both key and name
        const customAttrs = checkout?.customAttributes || [];
        console.log('[SectionLift Pixel] checkout.customAttributes count:', customAttrs.length, JSON.stringify(customAttrs));

        const getAttr = (key) => customAttrs.find(a => (a.key === key || a.name === key))?.value || null;
        const caVisitorId  = getAttr('_sectify_vid');
        const caShopDomain = getAttr('_sectify_shop');
        const caVisitorSrc = getAttr('_sectify_src');
        const caTrackUrl   = normalizeTrackUrl(getAttr('_sectify_track_url'));

        const fallbackShop = caShopDomain || (init?.data?.shop?.myshopifyDomain) || (init?.data?.shop?.domain);

        // Build a map of testId → variant from customAttributes
        const caTestMap = {};
        customAttrs
          .filter(a => (a.key || a.name || '').startsWith('_ab_test_'))
          .forEach(a => {
            const k = a.key || a.name;
            const tid = k.replace('_ab_test_', '');
            caTestMap[tid] = {
              test_id: tid,
              variant: a.value,
              visitor_id: caVisitorId || orderId,
              visitor_source: caVisitorSrc,
              shop_domain: fallbackShop,
              track_url: resolveTrackUrl(caTrackUrl),
              product_handle: getAttr('_sectify_ph_' + tid) || null,
              product_id: getAttr('_sectify_pid_' + tid) || null,
              product_title: getAttr('_sectify_pt_' + tid) || null
            };
          });

        console.log('[SectionLift Pixel] customAttributes test IDs found:', Object.keys(caTestMap).join(', ') || 'none');

        // Merge: prefer storedTests, supplement with caTestMap for any missing
        const mergedMap = {};

        storedTests.forEach(t => {
          mergedMap[t.test_id] = {
            ...t,
            track_url: resolveTrackUrl(t.track_url || caTrackUrl),
            shop_domain: t.shop_domain || fallbackShop
          };
        });

        // Add/override with customAttribute tests
        Object.values(caTestMap).forEach(t => {
          if (!mergedMap[t.test_id]) {
            mergedMap[t.test_id] = t;
          } else {
            if (!mergedMap[t.test_id].track_url) mergedMap[t.test_id].track_url = t.track_url;
            if (!mergedMap[t.test_id].visitor_id) mergedMap[t.test_id].visitor_id = t.visitor_id;
            if (!mergedMap[t.test_id].product_id) mergedMap[t.test_id].product_id = t.product_id;
            if (!mergedMap[t.test_id].product_title) mergedMap[t.test_id].product_title = t.product_title;
            if (!mergedMap[t.test_id].product_handle) mergedMap[t.test_id].product_handle = t.product_handle;
          }
        });

        const finalTests = Object.values(mergedMap).filter(t =>
          t.test_id && t.variant && (t.shop_domain || fallbackShop) && (t.track_url || SETTINGS_TRACK_URL)
        );

        console.log('[SectionLift Pixel] Final tests to track:', finalTests.length);

        if (finalTests.length === 0) {
          console.error('[SectionLift Pixel] ❌ No test data found in either localStorage or customAttributes. Purchase NOT tracked.');
          return;
        }

        sendPurchaseEvents(finalTests, checkout, orderId, fallbackShop);
      });
    });
  }

  analytics.subscribe('checkout_completed', handlePurchaseEvent);
  analytics.subscribe('order_placed', handlePurchaseEvent);

  // ─────────────────────────────────────────────────────────────────
  // Helper: Compute revenue for a test with multi-attribute matching.
  // ─────────────────────────────────────────────────────────────────
  function computeRevenue(checkout, testData) {
    const orderTotal = parseFloat(checkout?.totalPrice?.amount ?? '0') || 0;
    const targetHandle = testData.product_handle;
    const targetId = testData.product_id ? String(testData.product_id).replace('gid://shopify/Product/', '') : null;
    const targetTitle = testData.product_title ? testData.product_title.toLowerCase().trim() : null;

    // If test is not product-scoped (e.g. homepage, collection), use order total
    if (!targetHandle && !targetId && !targetTitle) return orderTotal;

    const lineItems = checkout?.lineItems || [];
    let filtered = 0;
    let matched = false;

    lineItems.forEach(item => {
      // 1. Match by product ID
      const pId = item.variant?.product?.id ? String(item.variant.product.id).replace('gid://shopify/Product/', '') : '';
      const idMatch = targetId && pId && pId === targetId;

      // 2. Match by product title
      const pTitle = item.variant?.product?.title ? item.variant.product.title.toLowerCase().trim() : '';
      const titleMatch = targetTitle && pTitle && pTitle === targetTitle;

      // 3. Match by product URL / handle
      const productUrl = item.variant?.product?.url || '';
      const itemHandle = productUrl.split('/products/')[1]?.split('?')[0]?.split('/')[0] || '';
      const handleMatch = targetHandle && itemHandle && itemHandle === targetHandle;

      if (idMatch || titleMatch || handleMatch) {
        matched = true;
        const lineTotal = item.finalLinePrice?.amount != null
          ? parseFloat(item.finalLinePrice.amount)
          : (parseFloat(item.variant?.price?.amount ?? '0') * (item.quantity || 1));
        filtered += lineTotal || 0;
      }
    });

    if (!matched) {
      console.warn('[SectionLift Pixel] No line items matched product filter — using full order total');
      return orderTotal;
    }
    return filtered;
  }

  // ─────────────────────────────────────────────────────────────────
  // Helper: POST PURCHASE events to the app server
  // ─────────────────────────────────────────────────────────────────
  function sendPurchaseEvents(tests, checkout, orderId, fallbackShop) {
    tests.forEach(testData => {
      const shopDomain = testData.shop_domain || fallbackShop;
      if (!testData.test_id || !testData.variant || !shopDomain) {
        console.warn('[SectionLift Pixel] Skipping incomplete test data:', JSON.stringify(testData));
        return;
      }

      const trackUrl = resolveTrackUrl(testData.track_url);
      if (!trackUrl) {
        console.error('[SectionLift Pixel] ❌ No track URL for test:', testData.test_id);
        return;
      }

      const revenue = computeRevenue(checkout, testData);
      const visitorId = testData.visitor_id || orderId;

      const payload = {
        test_id:        testData.test_id,
        shop_domain:    shopDomain,
        visitor_id:     visitorId,
        variant:        testData.variant,
        event_type:     'PURCHASE',
        visitor_source: testData.visitor_source || null,
        revenue:        revenue,
        order_id:       orderId
      };

      console.log('[SectionLift Pixel] ▶ Sending PURCHASE →', trackUrl,
        '| test:', testData.test_id, '| variant:', testData.variant,
        '| revenue:', revenue, '| order:', orderId);

      fetch(trackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload),
        keepalive: true
      })
        .then(r => r.json())
        .then(result => {
          if (result.skipped) {
            console.log('[SectionLift Pixel] ℹ️ PURCHASE skipped (already tracked):', testData.test_id, result.reason);
          } else {
            console.log('[SectionLift Pixel] ✅ PURCHASE tracked:', testData.test_id, result);
          }
        })
        .catch(e => console.error('[SectionLift Pixel] ❌ PURCHASE fetch failed:', e.message, '| URL:', trackUrl));
    });
  }
});
