import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with 10 designs...');

  await prisma.installation.deleteMany();
  await prisma.entitlement.deleteMany();
  await prisma.sectionVersion.deleteMany();
  await prisma.section.deleteMany();
  await prisma.category.deleteMany();

  // 1. Create Categories
  const categoryHero = await prisma.category.upsert({
    where: { slug: 'hero-banners' },
    update: {},
    create: { name: 'Hero Banners', slug: 'hero-banners', sort_order: 1 },
  });

  const categoryAnnouncement = await prisma.category.upsert({
    where: { slug: 'announcement-bars' },
    update: {},
    create: { name: 'Announcement Bars', slug: 'announcement-bars', sort_order: 2 },
  });

  const categoryFeatures = await prisma.category.upsert({
    where: { slug: 'features' },
    update: {},
    create: { name: 'Features & Benefits', slug: 'features', sort_order: 3 },
  });

  const categoryTrust = await prisma.category.upsert({
    where: { slug: 'trust-signals' },
    update: {},
    create: { name: 'Trust Signals', slug: 'trust-signals', sort_order: 4 },
  });

  const categoryProducts = await prisma.category.upsert({
    where: { slug: 'product-displays' },
    update: {},
    create: { name: 'Product Displays', slug: 'product-displays', sort_order: 5 },
  });

  // Data for 10 Sections
  const sectionsData = [
    {
      sku: 'EFX-HERO-001',
      name: 'Modern Hero Split',
      handle: 'efx-hero-split-01',
      category_id: categoryHero.id,
      short_description: 'A split-layout hero section.',
      full_description: 'A beautiful split-screen hero section perfect for landing pages.',
      price: 0.0,
      is_free: true,
      preview_image_url: '/thumbnails/hero.png',
      liquid_content: `<div style="display: flex; flex-wrap: wrap; align-items: center; background: {{ section.settings.bg_color }};">
  <div style="flex: 1 1 300px; padding: 40px;">
    <h2>{{ section.settings.heading }}</h2>
    <p>{{ section.settings.text }}</p>
    {% if section.settings.button_link %}
      <a href="{{ section.settings.button_link }}" style="display: inline-block; padding: 10px 20px; background: #000; color: #fff; text-decoration: none;">{{ section.settings.button_label }}</a>
    {% endif %}
  </div>
  <div style="flex: 1 1 300px; background: #ccc; min-height: 400px; display: flex; align-items: center; justify-content: center;">
    {% if section.settings.image %}
      <img src="{{ section.settings.image | img_url: 'master' }}" alt="" style="width: 100%; height: auto; object-fit: cover; min-height: 400px;"/>
    {% else %}
      <span>Image Placeholder</span>
    {% endif %}
  </div>
</div>
{% schema %}
{
  "name": "EFX - Split Hero",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "Welcome to our store" },
    { "type": "textarea", "id": "text", "label": "Text", "default": "Discover our amazing products." },
    { "type": "text", "id": "button_label", "label": "Button Label", "default": "Shop Now" },
    { "type": "url", "id": "button_link", "label": "Button Link" },
    { "type": "color", "id": "bg_color", "label": "Background Color", "default": "#f4f4f4" },
    { "type": "image_picker", "id": "image", "label": "Image" }
  ],
  "presets": [ { "name": "EFX - Split Hero" } ]
}
{% endschema %}`
    },
    {
      sku: 'EFX-ANN-001',
      name: 'Trust Announcement Bar',
      handle: 'efx-trust-announcement-01',
      category_id: categoryAnnouncement.id,
      short_description: 'Highlight your top selling points.',
      full_description: 'Display free shipping, returns, and support trust signals directly at the top of your page.',
      price: 9.0,
      is_free: false,
      preview_image_url: '/thumbnails/trust.png',
      liquid_content: `<div style="background: {{ section.settings.bg_color }}; color: {{ section.settings.text_color }}; padding: 10px; text-align: center; display: flex; justify-content: space-around; flex-wrap: wrap;">
  {% for block in section.blocks %}
    <div style="padding: 5px;">
      {% if block.settings.icon != blank %}<span>{{ block.settings.icon }}</span>{% endif %}
      <span style="font-weight: bold;">{{ block.settings.text }}</span>
    </div>
  {% endfor %}
</div>
{% schema %}
{
  "name": "EFX - Trust Bar",
  "settings": [
    { "type": "color", "id": "bg_color", "label": "Background Color", "default": "#000000" },
    { "type": "color", "id": "text_color", "label": "Text Color", "default": "#ffffff" }
  ],
  "blocks": [
    {
      "type": "trust_item",
      "name": "Trust Signal",
      "settings": [
        { "type": "text", "id": "icon", "label": "Emoji Icon (optional)" },
        { "type": "text", "id": "text", "label": "Text", "default": "Free Shipping" }
      ]
    }
  ],
  "presets": [ { "name": "EFX - Trust Bar" } ]
}
{% endschema %}`
    },
    {
      sku: 'EFX-FEAT-001',
      name: 'Icon Features Grid',
      handle: 'efx-icon-features-01',
      category_id: categoryFeatures.id,
      short_description: 'Grid of features with icons.',
      full_description: 'Showcase your product benefits using a sleek 3-column grid with customizable icons.',
      price: 0.0,
      is_free: true,
      preview_image_url: '/thumbnails/features.png',
      liquid_content: `<div style="padding: 40px 20px; background: {{ section.settings.bg_color }}; text-align: center;">
  <h2 style="margin-bottom: 30px;">{{ section.settings.title }}</h2>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px;">
    {% for block in section.blocks %}
      <div style="padding: 20px; background: #fff; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        {% if block.settings.image %}
          <img src="{{ block.settings.image | img_url: '100x' }}" style="margin-bottom: 15px;" />
        {% else %}
          <div style="width: 50px; height: 50px; background: #eee; margin: 0 auto 15px; border-radius: 50%;"></div>
        {% endif %}
        <h3>{{ block.settings.title }}</h3>
        <p>{{ block.settings.text }}</p>
      </div>
    {% endfor %}
  </div>
</div>
{% schema %}
{
  "name": "EFX - Icon Grid",
  "settings": [
    { "type": "text", "id": "title", "label": "Heading", "default": "Why Choose Us" },
    { "type": "color", "id": "bg_color", "label": "Background", "default": "#f9f9f9" }
  ],
  "blocks": [
    {
      "type": "feature",
      "name": "Feature",
      "settings": [
        { "type": "image_picker", "id": "image", "label": "Icon" },
        { "type": "text", "id": "title", "label": "Title", "default": "Premium Quality" },
        { "type": "textarea", "id": "text", "label": "Text", "default": "We use only the best materials." }
      ]
    }
  ],
  "presets": [ { "name": "EFX - Icon Grid" } ]
}
{% endschema %}`
    },
    {
      sku: 'EFX-TEST-001',
      name: 'Customer Testimonial Slider',
      handle: 'efx-testimonial-01',
      category_id: categoryTrust.id,
      short_description: 'Build trust with real reviews.',
      full_description: 'A beautiful scrolling testimonial section to showcase your happy customers.',
      price: 19.0,
      is_free: false,
      preview_image_url: '/thumbnails/trust.png',
      liquid_content: `<div style="padding: 50px 20px; text-align: center; background: {{ section.settings.bg_color }};">
  <h2>{{ section.settings.heading }}</h2>
  <div style="display: flex; overflow-x: auto; gap: 20px; padding: 20px 0; scroll-snap-type: x mandatory;">
    {% for block in section.blocks %}
      <div style="min-width: 300px; scroll-snap-align: center; background: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
        <p style="font-size: 1.1em; font-style: italic;">"{{ block.settings.quote }}"</p>
        <h4 style="margin-top: 15px;">- {{ block.settings.author }}</h4>
        <span style="color: gold;">★★★★★</span>
      </div>
    {% endfor %}
  </div>
</div>
{% schema %}
{
  "name": "EFX - Testimonials",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "What Our Customers Say" },
    { "type": "color", "id": "bg_color", "label": "Background", "default": "#fafafa" }
  ],
  "blocks": [
    {
      "type": "review",
      "name": "Review",
      "settings": [
        { "type": "textarea", "id": "quote", "label": "Quote", "default": "This product changed my life!" },
        { "type": "text", "id": "author", "label": "Author", "default": "Jane Doe" }
      ]
    }
  ],
  "presets": [ { "name": "EFX - Testimonials" } ]
}
{% endschema %}`
    },
    {
      sku: 'EFX-HERO-002',
      name: 'Video Background Hero',
      handle: 'efx-hero-video-01',
      category_id: categoryHero.id,
      short_description: 'Captivate with a background video.',
      full_description: 'A stunning hero section that plays an MP4 video in the background.',
      price: 29.0,
      is_free: false,
      preview_image_url: '/thumbnails/hero.png',
      liquid_content: `<div style="position: relative; min-height: 600px; display: flex; align-items: center; justify-content: center; overflow: hidden; color: #fff;">
  {% if section.settings.video_url %}
    <video autoplay loop muted playsinline style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: -2;">
      <source src="{{ section.settings.video_url }}" type="video/mp4">
    </video>
  {% else %}
    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: #333; z-index: -2;"></div>
  {% endif %}
  <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,{{ section.settings.overlay_opacity }}); z-index: -1;"></div>
  <div style="text-align: center; padding: 20px; z-index: 1;">
    <h1 style="font-size: 3em; margin-bottom: 20px;">{{ section.settings.heading }}</h1>
    <p style="font-size: 1.2em; margin-bottom: 30px;">{{ section.settings.text }}</p>
    {% if section.settings.button_link %}
      <a href="{{ section.settings.button_link }}" style="display: inline-block; padding: 15px 30px; background: {{ section.settings.button_color }}; color: #fff; text-decoration: none; border-radius: 4px; font-weight: bold;">{{ section.settings.button_label }}</a>
    {% endif %}
  </div>
</div>
{% schema %}
{
  "name": "EFX - Video Hero",
  "settings": [
    { "type": "url", "id": "video_url", "label": "MP4 Video URL" },
    { "type": "range", "id": "overlay_opacity", "min": 0, "max": 1, "step": 0.1, "label": "Overlay Opacity", "default": 0.5 },
    { "type": "text", "id": "heading", "label": "Heading", "default": "Experience the Best" },
    { "type": "textarea", "id": "text", "label": "Text", "default": "Watch our brand in action." },
    { "type": "text", "id": "button_label", "label": "Button Label", "default": "Shop Collection" },
    { "type": "url", "id": "button_link", "label": "Button Link" },
    { "type": "color", "id": "button_color", "label": "Button Color", "default": "#000000" }
  ],
  "presets": [ { "name": "EFX - Video Hero" } ]
}
{% endschema %}`
    },
    {
      sku: 'EFX-FEAT-002',
      name: 'Before & After Slider',
      handle: 'efx-before-after-01',
      category_id: categoryFeatures.id,
      short_description: 'Interactive image comparison.',
      full_description: 'Let customers drag a slider to see the before and after effects of your product.',
      price: 24.0,
      is_free: false,
      preview_image_url: '/thumbnails/features.png',
      liquid_content: `<div style="padding: 40px 20px; text-align: center;">
  <h2>{{ section.settings.heading }}</h2>
  <div style="position: relative; max-width: 800px; margin: 20px auto; overflow: hidden; border-radius: 8px;">
    {% if section.settings.image_before and section.settings.image_after %}
      <img src="{{ section.settings.image_after | img_url: 'master' }}" style="width: 100%; display: block;" />
      <div style="position: absolute; top: 0; left: 0; width: 50%; height: 100%; overflow: hidden; border-right: 4px solid #fff;">
        <img src="{{ section.settings.image_before | img_url: 'master' }}" style="width: 800px; max-width: none; height: 100%; object-fit: cover;" />
      </div>
      <div style="position: absolute; top: 50%; left: 50%; width: 40px; height: 40px; background: #fff; border-radius: 50%; transform: translate(-50%, -50%); display: flex; align-items: center; justify-content: center; font-weight: bold; cursor: ew-resize; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">&lt;&gt;</div>
    {% else %}
      <div style="background: #ddd; padding: 100px;">Please select Before and After images.</div>
    {% endif %}
  </div>
</div>
{% schema %}
{
  "name": "EFX - Before/After",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "See the Difference" },
    { "type": "image_picker", "id": "image_before", "label": "Before Image" },
    { "type": "image_picker", "id": "image_after", "label": "After Image" }
  ],
  "presets": [ { "name": "EFX - Before/After" } ]
}
{% endschema %}`
    },
    {
      sku: 'EFX-FAQ-001',
      name: 'Clean FAQ Accordion',
      handle: 'efx-faq-accordion-01',
      category_id: categoryTrust.id,
      short_description: 'Answer common questions.',
      full_description: 'An elegant accordion section to display frequently asked questions without cluttering the page.',
      price: 0.0,
      is_free: true,
      preview_image_url: '/thumbnails/trust.png',
      liquid_content: `<div style="padding: 50px 20px; max-width: 800px; margin: 0 auto;">
  <h2 style="text-align: center; margin-bottom: 30px;">{{ section.settings.heading }}</h2>
  {% for block in section.blocks %}
    <details style="margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px; padding: 15px; background: #fff;">
      <summary style="font-weight: bold; cursor: pointer; outline: none;">{{ block.settings.question }}</summary>
      <div style="margin-top: 10px; color: #555;">{{ block.settings.answer }}</div>
    </details>
  {% endfor %}
</div>
{% schema %}
{
  "name": "EFX - FAQ Accordion",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "Frequently Asked Questions" }
  ],
  "blocks": [
    {
      "type": "faq",
      "name": "Question",
      "settings": [
        { "type": "text", "id": "question", "label": "Question", "default": "What is your return policy?" },
        { "type": "richtext", "id": "answer", "label": "Answer", "default": "<p>We offer a 30-day money back guarantee.</p>" }
      ]
    }
  ],
  "presets": [ { "name": "EFX - FAQ Accordion" } ]
}
{% endschema %}`
    },
    {
      sku: 'EFX-LOGO-001',
      name: 'Logo Trust Strip',
      handle: 'efx-logo-strip-01',
      category_id: categoryTrust.id,
      short_description: 'Showcase "As Seen In" logos.',
      full_description: 'A scrolling or static strip of logos to build instant credibility.',
      price: 0.0,
      is_free: true,
      preview_image_url: '/thumbnails/trust.png',
      liquid_content: `<div style="padding: 30px 20px; background: {{ section.settings.bg_color }}; text-align: center;">
  {% if section.settings.heading != blank %}
    <h3 style="margin-bottom: 20px; font-size: 1em; color: #666; text-transform: uppercase; letter-spacing: 1px;">{{ section.settings.heading }}</h3>
  {% endif %}
  <div style="display: flex; justify-content: center; align-items: center; gap: 40px; flex-wrap: wrap;">
    {% for block in section.blocks %}
      {% if block.settings.image %}
        <img src="{{ block.settings.image | img_url: '200x' }}" style="max-height: 40px; object-fit: contain; filter: grayscale(100%); opacity: 0.6;" />
      {% else %}
        <div style="width: 100px; height: 30px; background: #ccc;"></div>
      {% endif %}
    {% endfor %}
  </div>
</div>
{% schema %}
{
  "name": "EFX - Logo Strip",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "As Featured In" },
    { "type": "color", "id": "bg_color", "label": "Background", "default": "#ffffff" }
  ],
  "blocks": [
    {
      "type": "logo",
      "name": "Logo",
      "settings": [
        { "type": "image_picker", "id": "image", "label": "Logo Image" }
      ]
    }
  ],
  "presets": [ { "name": "EFX - Logo Strip" } ]
}
{% endschema %}`
    },
    {
      sku: 'EFX-CTA-001',
      name: 'Newsletter Call to Action',
      handle: 'efx-newsletter-cta-01',
      category_id: categoryFeatures.id,
      short_description: 'Collect emails beautifully.',
      full_description: 'A focused section to drive newsletter signups or account creations.',
      price: 14.0,
      is_free: false,
      preview_image_url: '/thumbnails/cta.png',
      liquid_content: `<div style="padding: 60px 20px; background: {{ section.settings.bg_color }}; color: {{ section.settings.text_color }}; text-align: center;">
  <h2 style="margin-bottom: 15px;">{{ section.settings.heading }}</h2>
  <p style="margin-bottom: 30px; max-width: 500px; margin-left: auto; margin-right: auto;">{{ section.settings.text }}</p>
  <form style="display: flex; max-width: 400px; margin: 0 auto; gap: 10px;">
    <input type="email" placeholder="Enter your email" style="flex: 1; padding: 12px; border: 1px solid #ccc; border-radius: 4px;" required />
    <button type="submit" style="padding: 12px 24px; background: #000; color: #fff; border: none; border-radius: 4px; cursor: pointer;">Subscribe</button>
  </form>
</div>
{% schema %}
{
  "name": "EFX - Newsletter CTA",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "Join the Club" },
    { "type": "textarea", "id": "text", "label": "Text", "default": "Sign up for exclusive offers and news." },
    { "type": "color", "id": "bg_color", "label": "Background Color", "default": "#f4f4f4" },
    { "type": "color", "id": "text_color", "label": "Text Color", "default": "#000000" }
  ],
  "presets": [ { "name": "EFX - Newsletter CTA" } ]
}
{% endschema %}`
    },
    {
      sku: 'EFX-HERO-003',
      name: 'Countdown Launch Hero',
      handle: 'efx-countdown-hero-01',
      category_id: categoryHero.id,
      short_description: 'Drive urgency for a launch.',
      full_description: 'A hero section with a built-in countdown timer for sales and drops.',
      price: 19.0,
      is_free: false,
      preview_image_url: '/thumbnails/hero.png',
      liquid_content: `<div style="padding: 80px 20px; background: #000; color: #fff; text-align: center;">
  <h1 style="margin-bottom: 20px;">{{ section.settings.heading }}</h1>
  <p style="margin-bottom: 40px; font-size: 1.2em;">{{ section.settings.text }}</p>
  <div style="display: flex; justify-content: center; gap: 20px; font-size: 2em; font-weight: bold; margin-bottom: 40px;">
    <div style="background: #333; padding: 20px; border-radius: 8px; min-width: 100px;">03<br><span style="font-size: 0.4em; font-weight: normal;">DAYS</span></div>
    <div style="background: #333; padding: 20px; border-radius: 8px; min-width: 100px;">14<br><span style="font-size: 0.4em; font-weight: normal;">HOURS</span></div>
    <div style="background: #333; padding: 20px; border-radius: 8px; min-width: 100px;">45<br><span style="font-size: 0.4em; font-weight: normal;">MINS</span></div>
  </div>
  {% if section.settings.button_link %}
    <a href="{{ section.settings.button_link }}" style="display: inline-block; padding: 15px 40px; background: #fff; color: #000; text-decoration: none; font-weight: bold; border-radius: 4px;">{{ section.settings.button_label }}</a>
  {% endif %}
</div>
{% schema %}
{
  "name": "EFX - Countdown Hero",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "Summer Sale Ends Soon" },
    { "type": "textarea", "id": "text", "label": "Text", "default": "Don't miss out on 50% off sitewide." },
    { "type": "text", "id": "button_label", "label": "Button Label", "default": "Shop the Sale" },
    { "type": "url", "id": "button_link", "label": "Button Link" }
  ],
  "presets": [ { "name": "EFX - Countdown Hero" } ]
}
{% endschema %}`
    },
    {
      sku: 'EFX-PROD-001',
      name: 'Modern Product Grid',
      handle: 'efx-product-grid-01',
      category_id: categoryProducts.id,
      short_description: 'Display a beautiful grid of products.',
      full_description: 'Showcase your best selling products in a clean, responsive grid layout.',
      price: 15.0,
      is_free: false,
      preview_image_url: '/thumbnails/products.png',
      liquid_content: `<div style="padding: 60px 20px; max-width: 1200px; margin: 0 auto; background: {{ section.settings.bg_color }};">
  <h2 style="text-align: center; margin-bottom: 40px; color: {{ section.settings.text_color }};">{{ section.settings.title }}</h2>
  <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 30px;">
    {% for product in collections[section.settings.collection].products limit: section.settings.limit %}
      <div style="text-align: center; border: 1px solid #eee; border-radius: 8px; padding: 15px; background: #fff; transition: transform 0.3s ease;">
        <a href="{{ product.url }}" style="text-decoration: none; color: inherit;">
          <img src="{{ product.featured_image | img_url: '400x400', crop: 'center' }}" alt="{{ product.title | escape }}" style="width: 100%; height: auto; border-radius: 4px; margin-bottom: 15px;">
          <h3 style="font-size: 1.1em; margin-bottom: 10px;">{{ product.title }}</h3>
          <p style="font-weight: bold; color: {{ section.settings.text_color }};">{{ product.price | money }}</p>
        </a>
      </div>
    {% else %}
      <p style="text-align: center; width: 100%; grid-column: 1 / -1;">Please select a collection with products.</p>
    {% endfor %}
  </div>
</div>
{% schema %}
{
  "name": "EFX - Product Grid",
  "settings": [
    { "type": "text", "id": "title", "label": "Heading", "default": "Featured Products" },
    { "type": "collection", "id": "collection", "label": "Collection" },
    { "type": "range", "id": "limit", "min": 2, "max": 12, "step": 1, "label": "Number of products", "default": 4 },
    { "type": "color", "id": "bg_color", "label": "Background Color", "default": "#ffffff" },
    { "type": "color", "id": "text_color", "label": "Text Color", "default": "#000000" }
  ],
  "presets": [ { "name": "EFX - Product Grid" } ]
}
{% endschema %}`
    },
    {
      sku: 'EFX-IMGTXT-001',
      name: 'Split Image & Text',
      handle: 'efx-image-text-01',
      category_id: categoryFeatures.id,
      short_description: 'Classic side-by-side layout.',
      full_description: 'An elegant layout putting an image alongside text, perfect for brand storytelling.',
      price: 0.0,
      is_free: true,
      preview_image_url: '/thumbnails/features.png',
      liquid_content: `<div style="display: flex; flex-wrap: wrap; background: {{ section.settings.bg_color }}; {% if section.settings.layout == 'right' %}flex-direction: row-reverse;{% endif %}">
  <div style="flex: 1 1 400px; min-height: 400px; background: #eee;">
    {% if section.settings.image %}
      <img src="{{ section.settings.image | img_url: 'master' }}" alt="{{ section.settings.image.alt | escape }}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />
    {% else %}
      <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #ddd; min-height: 400px;">
        <span>Select Image</span>
      </div>
    {% endif %}
  </div>
  <div style="flex: 1 1 400px; padding: 60px 40px; display: flex; align-items: center; justify-content: center;">
    <div style="max-width: 500px; color: {{ section.settings.text_color }};">
      <h2 style="margin-bottom: 20px; font-size: 2.5em;">{{ section.settings.heading }}</h2>
      <div style="margin-bottom: 30px; line-height: 1.6; font-size: 1.1em;">{{ section.settings.text }}</div>
      {% if section.settings.button_label != blank %}
        <a href="{{ section.settings.button_link }}" style="display: inline-block; padding: 14px 28px; background: {{ section.settings.button_bg_color }}; color: {{ section.settings.button_text_color }}; text-decoration: none; border-radius: 4px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">{{ section.settings.button_label }}</a>
      {% endif %}
    </div>
  </div>
</div>
{% schema %}
{
  "name": "EFX - Image with Text",
  "settings": [
    { "type": "image_picker", "id": "image", "label": "Image" },
    { "type": "select", "id": "layout", "label": "Image Alignment", "options": [ { "value": "left", "label": "Left" }, { "value": "right", "label": "Right" } ], "default": "left" },
    { "type": "text", "id": "heading", "label": "Heading", "default": "Tell your brand story" },
    { "type": "richtext", "id": "text", "label": "Text", "default": "<p>Pair text with an image to focus on your chosen product, collection, or blog post. Add details on availability, style, or even provide a review.</p>" },
    { "type": "text", "id": "button_label", "label": "Button Label", "default": "Read More" },
    { "type": "url", "id": "button_link", "label": "Button Link" },
    { "type": "color", "id": "bg_color", "label": "Background Color", "default": "#ffffff" },
    { "type": "color", "id": "text_color", "label": "Text Color", "default": "#333333" },
    { "type": "color", "id": "button_bg_color", "label": "Button Background Color", "default": "#000000" },
    { "type": "color", "id": "button_text_color", "label": "Button Text Color", "default": "#ffffff" }
  ],
  "presets": [ { "name": "EFX - Image with Text" } ]
}
{% endschema %}`
    },
    {
      sku: 'EFX-BRAND-001',
      name: 'Dynamic Brand Carousel',
      handle: 'efx-brand-carousel-01',
      category_id: categoryTrust.id,
      short_description: 'A scrolling carousel of brand logos.',
      full_description: 'Build trust by showcasing partner brands or featured publishers in a smooth sliding carousel.',
      price: 12.0,
      is_free: false,
      preview_image_url: '/thumbnails/trust.png',
      liquid_content: `<div style="padding: 50px 20px; background: {{ section.settings.bg_color }}; overflow: hidden;">
  <h2 style="text-align: center; margin-bottom: 40px; color: {{ section.settings.text_color }};">{{ section.settings.title }}</h2>
  <div style="display: flex; gap: 40px; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: 20px; scrollbar-width: none;">
    {% for block in section.blocks %}
      <div style="flex: 0 0 auto; scroll-snap-align: center; display: flex; align-items: center; justify-content: center; min-width: 150px; height: 80px;">
        {% if block.settings.logo %}
          <img src="{{ block.settings.logo | img_url: '300x' }}" alt="{{ block.settings.logo.alt | escape }}" style="max-height: 100%; max-width: 100%; object-fit: contain; filter: grayscale(100%); opacity: 0.7; transition: all 0.3s ease;" onmouseover="this.style.filter='grayscale(0%)'; this.style.opacity='1'" onmouseout="this.style.filter='grayscale(100%)'; this.style.opacity='0.7'">
        {% else %}
          <div style="width: 150px; height: 50px; background: #e0e0e0; display: flex; align-items: center; justify-content: center; color: #888; font-size: 0.8em; border-radius: 4px;">Logo Placeholder</div>
        {% endif %}
      </div>
    {% endfor %}
  </div>
  <style>
    div::-webkit-scrollbar { display: none; }
  </style>
</div>
{% schema %}
{
  "name": "EFX - Brand Carousel",
  "settings": [
    { "type": "text", "id": "title", "label": "Heading", "default": "Brands We Love" },
    { "type": "color", "id": "bg_color", "label": "Background Color", "default": "#fafafa" },
    { "type": "color", "id": "text_color", "label": "Text Color", "default": "#222222" }
  ],
  "blocks": [
    {
      "type": "brand",
      "name": "Brand Logo",
      "settings": [
        { "type": "image_picker", "id": "logo", "label": "Brand Logo" }
      ]
    }
  ],
  "presets": [ { "name": "EFX - Brand Carousel", "blocks": [{ "type": "brand" }, { "type": "brand" }, { "type": "brand" }, { "type": "brand" }] } ]
}
{% endschema %}`
    },
    {
      sku: 'EFX-FEATCOL-001',
      name: 'Featured Collection Banner',
      handle: 'efx-featured-collection-01',
      category_id: categoryProducts.id,
      short_description: 'Highlight a specific collection.',
      full_description: 'Draw attention to a new or best-selling collection with a bold header and product previews.',
      price: 20.0,
      is_free: false,
      preview_image_url: '/thumbnails/products.png',
      liquid_content: `<div style="padding: 80px 20px; background: {{ section.settings.bg_color }}; color: {{ section.settings.text_color }};">
  <div style="max-width: 1200px; margin: 0 auto; display: flex; flex-wrap: wrap; gap: 40px; align-items: center;">
    <div style="flex: 1 1 300px;">
      <h2 style="font-size: 2.8em; margin-bottom: 20px; font-weight: 800;">{{ section.settings.heading }}</h2>
      <p style="font-size: 1.1em; margin-bottom: 30px; opacity: 0.8;">{{ section.settings.subheading }}</p>
      {% if section.settings.collection != blank %}
        <a href="{{ collections[section.settings.collection].url }}" style="display: inline-block; padding: 15px 35px; background: {{ section.settings.text_color }}; color: {{ section.settings.bg_color }}; text-decoration: none; font-weight: bold; border-radius: 4px; text-transform: uppercase;">{{ section.settings.button_label }}</a>
      {% endif %}
    </div>
    <div style="flex: 2 1 500px;">
      <div style="display: flex; gap: 20px; overflow-x: auto; padding-bottom: 20px; scrollbar-width: none; scroll-snap-type: x mandatory;">
        {% for product in collections[section.settings.collection].products limit: 4 %}
          <div style="flex: 0 0 250px; scroll-snap-align: start; background: #fff; padding: 15px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
            <a href="{{ product.url }}" style="text-decoration: none; color: inherit;">
              <img src="{{ product.featured_image | img_url: '400x400', crop: 'center' }}" alt="{{ product.title | escape }}" style="width: 100%; height: 250px; object-fit: cover; border-radius: 4px; margin-bottom: 15px;">
              <h4 style="margin: 0 0 5px 0; color: #333; font-size: 1.1em;">{{ product.title }}</h4>
              <p style="margin: 0; color: #666; font-weight: bold;">{{ product.price | money }}</p>
            </a>
          </div>
        {% else %}
          <div style="flex: 1; padding: 40px; background: rgba(255,255,255,0.1); border-radius: 8px; text-align: center;">
            <p>Please select a collection to display products.</p>
          </div>
        {% endfor %}
      </div>
    </div>
  </div>
</div>
{% schema %}
{
  "name": "EFX - Featured Collection",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "New Arrivals" },
    { "type": "text", "id": "subheading", "label": "Subheading", "default": "Discover the latest additions to our store." },
    { "type": "text", "id": "button_label", "label": "Button Label", "default": "Shop All" },
    { "type": "collection", "id": "collection", "label": "Collection to Feature" },
    { "type": "color", "id": "bg_color", "label": "Background Color", "default": "#1a1a1a" },
    { "type": "color", "id": "text_color", "label": "Text Color", "default": "#ffffff" }
  ],
  "presets": [ { "name": "EFX - Featured Collection" } ]
}
{% endschema %}`
    },
    {
      sku: 'EFX-FAQ-002',
      name: 'Grid FAQ Layout',
      handle: 'efx-faq-grid-01',
      category_id: categoryTrust.id,
      short_description: 'Display FAQs in a grid format.',
      full_description: 'A beautiful grid layout for frequently asked questions, making them easy to scan.',
      price: 0.0,
      is_free: true,
      preview_image_url: '/thumbnails/trust.png',
      liquid_content: `<div style="padding: 60px 20px; background: {{ section.settings.bg_color }}; color: {{ section.settings.text_color }};">
  <div style="max-width: 1200px; margin: 0 auto;">
    <h2 style="text-align: center; margin-bottom: 50px; font-size: 2.5em;">{{ section.settings.heading }}</h2>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 40px;">
      {% for block in section.blocks %}
        <div style="padding: 25px; border-left: 4px solid {{ section.settings.accent_color }}; background: rgba(255,255,255,0.05); border-radius: 0 8px 8px 0;">
          <h3 style="margin-top: 0; margin-bottom: 15px; font-size: 1.2em; font-weight: 600;">{{ block.settings.question }}</h3>
          <div style="line-height: 1.6; opacity: 0.9;">{{ block.settings.answer }}</div>
        </div>
      {% endfor %}
    </div>
  </div>
</div>
{% schema %}
{
  "name": "EFX - Grid FAQ",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "Common Questions" },
    { "type": "color", "id": "bg_color", "label": "Background Color", "default": "#f9f9f9" },
    { "type": "color", "id": "text_color", "label": "Text Color", "default": "#111111" },
    { "type": "color", "id": "accent_color", "label": "Accent Color", "default": "#000000" }
  ],
  "blocks": [
    {
      "type": "faq_item",
      "name": "Question",
      "settings": [
        { "type": "text", "id": "question", "label": "Question", "default": "How long does shipping take?" },
        { "type": "richtext", "id": "answer", "label": "Answer", "default": "<p>Standard shipping takes 3-5 business days.</p>" }
      ]
    }
  ],
  "presets": [ 
    { 
      "name": "EFX - Grid FAQ",
      "blocks": [
        { "type": "faq_item" }, { "type": "faq_item" }, { "type": "faq_item" }, { "type": "faq_item" }
      ]
    } 
  ]
}
{% endschema %}`
    }
  ];

  for (const s of sectionsData) {
    const section = await prisma.section.upsert({
      where: { sku: s.sku },
      update: {
        price: s.price,
        is_free: s.is_free,
        short_description: s.short_description,
        full_description: s.full_description,
        preview_image_url: s.preview_image_url,
      },
      create: {
        sku: s.sku,
        name: s.name,
        handle: s.handle,
        category_id: s.category_id,
        short_description: s.short_description,
        full_description: s.full_description,
        price: s.price,
        is_free: s.is_free,
        status: 'PUBLISHED',
        preview_image_url: s.preview_image_url,
      },
    });

    // Create the version with the liquid content
    await prisma.sectionVersion.create({
      data: {
        section_id: section.id,
        version: '1.0.0',
        liquid_content: s.liquid_content,
        is_breaking: false,
      },
    });
  }

  console.log('Database seeded successfully with 10 sections.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
