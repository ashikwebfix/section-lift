import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with 5 CRO Optimized sections...');

  // Helper to ensure category exists
  async function getCategory(name, slug, sort_order) {
    return await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { name, slug, sort_order },
    });
  }

  const categoryCTA = await getCategory('Call to Action', 'cta', 10);
  const categoryFAQ = await getCategory('FAQ & Accordions', 'faq', 11);
  const categoryCompare = await getCategory('Comparison Tables', 'comparison', 12);
  const categoryTrust = await getCategory('Trust Signals', 'trust-signals', 13); // Reuse existing slug if possible, but upsert is safe
  const categoryBanner = await getCategory('Announcement Banners', 'banners', 14);

  const sectionsData = [
    {
      sku: 'CRO-CTA-001',
      name: 'High-Converting CTA Box',
      handle: 'cro-cta-001',
      category_id: categoryCTA.id,
      short_description: 'Drive immediate action with this high-contrast CTA block.',
      full_description: 'A beautifully structured Call To Action section designed to maximize click-through rates. Includes subheading for urgency and primary button.',
      price: 0.0,
      is_free: true,
      tag: 'CTA',
      liquid_content: `{%- style -%}
  .cro-cta-{{ section.id }} {
    padding: {{ section.settings.padding_y }}px {{ section.settings.padding_x }}px;
    background-color: {{ section.settings.bg_color }};
    color: {{ section.settings.text_color }};
    text-align: {{ section.settings.text_align }};
    border-radius: {{ section.settings.border_radius }}px;
    max-width: {{ section.settings.max_width }}px;
    margin: {{ section.settings.margin_top }}px auto {{ section.settings.margin_bottom }}px auto;
    box-shadow: 0 4px 15px rgba(0,0,0,0.05);
  }
  .cro-cta-{{ section.id }} h2 {
    color: {{ section.settings.text_color }};
    margin-top: 0;
    margin-bottom: 10px;
    font-size: {{ section.settings.heading_size }}px;
    font-weight: bold;
  }
  .cro-cta-{{ section.id }} p {
    color: {{ section.settings.text_color }};
    opacity: 0.9;
    margin-bottom: 20px;
    font-size: 16px;
  }
  .cro-cta-btn-{{ section.id }} {
    display: inline-block;
    background-color: {{ section.settings.btn_bg_color }};
    color: {{ section.settings.btn_text_color }};
    padding: 14px 28px;
    border-radius: {{ section.settings.btn_radius }}px;
    text-decoration: none;
    font-weight: bold;
    font-size: 16px;
    transition: all 0.3s ease;
    border: none;
    cursor: pointer;
  }
  .cro-cta-btn-{{ section.id }}:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px {{ section.settings.btn_bg_color }}66;
    opacity: 0.9;
  }
{%- endstyle -%}

<div class="cro-cta-{{ section.id }}">
  {% if section.settings.heading != blank %}
    <h2>{{ section.settings.heading | escape }}</h2>
  {% endif %}
  
  {% if section.settings.subtext != blank %}
    <p>{{ section.settings.subtext | escape }}</p>
  {% endif %}
  
  {% if section.settings.btn_link != blank and section.settings.btn_text != blank %}
    <a href="{{ section.settings.btn_link }}" class="cro-cta-btn-{{ section.id }}">
      {{ section.settings.btn_text | escape }}
    </a>
  {% endif %}
</div>

{% schema %}
{
  "name": "CRO - CTA Box",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "Ready to upgrade your store?" },
    { "type": "text", "id": "subtext", "label": "Subheading text", "default": "Join thousands of successful merchants today." },
    { "type": "text", "id": "btn_text", "label": "Button Text", "default": "Get Started Now" },
    { "type": "url", "id": "btn_link", "label": "Button Link" },
    { "type": "header", "content": "Colors" },
    { "type": "color", "id": "bg_color", "label": "Background Color", "default": "#ffffff" },
    { "type": "color", "id": "text_color", "label": "Text Color", "default": "#121212" },
    { "type": "color", "id": "btn_bg_color", "label": "Button Background", "default": "#000000" },
    { "type": "color", "id": "btn_text_color", "label": "Button Text Color", "default": "#ffffff" },
    { "type": "header", "content": "Layout & Styling" },
    { "type": "select", "id": "text_align", "label": "Text Alignment", "options": [
        { "value": "left", "label": "Left" },
        { "value": "center", "label": "Center" },
        { "value": "right", "label": "Right" }
      ], "default": "center" },
    { "type": "range", "id": "heading_size", "min": 20, "max": 60, "step": 2, "label": "Heading Size", "default": 32 },
    { "type": "range", "id": "max_width", "min": 400, "max": 1200, "step": 50, "label": "Max Width", "default": 800 },
    { "type": "range", "id": "border_radius", "min": 0, "max": 50, "step": 1, "label": "Container Border Radius", "default": 8 },
    { "type": "range", "id": "btn_radius", "min": 0, "max": 50, "step": 1, "label": "Button Border Radius", "default": 4 },
    { "type": "range", "id": "padding_y", "min": 20, "max": 100, "step": 5, "label": "Vertical Padding", "default": 60 },
    { "type": "range", "id": "padding_x", "min": 20, "max": 100, "step": 5, "label": "Horizontal Padding", "default": 40 },
    { "type": "range", "id": "margin_top", "min": 0, "max": 100, "step": 5, "label": "Top Margin", "default": 40 },
    { "type": "range", "id": "margin_bottom", "min": 0, "max": 100, "step": 5, "label": "Bottom Margin", "default": 40 }
  ],
  "presets": [
    {
      "name": "CRO - CTA Box",
      "category": "Call to Action"
    }
  ]
}
{% endschema %}`
    },
    {
      sku: 'CRO-FAQ-001',
      name: 'Interactive Accordion FAQ',
      handle: 'cro-faq-accordion-01',
      category_id: categoryFAQ.id,
      short_description: 'Reduce buyer friction by answering common questions.',
      full_description: 'An interactive, smoothly animated FAQ accordion that answers customer objections directly on product or landing pages.',
      price: 0.0,
      is_free: true,
      tag: 'FAQ',
      liquid_content: `{%- style -%}
  .cro-faq-{{ section.id }} {
    max-width: {{ section.settings.max_width }}px;
    margin: {{ section.settings.margin_top }}px auto {{ section.settings.margin_bottom }}px auto;
    padding: 0 {{ section.settings.padding_x }}px;
  }
  .cro-faq-title-{{ section.id }} {
    text-align: center;
    font-size: {{ section.settings.heading_size }}px;
    margin-bottom: 30px;
    color: {{ section.settings.heading_color }};
  }
  .cro-faq-item-{{ section.id }} {
    border-bottom: 1px solid {{ section.settings.border_color }};
  }
  .cro-faq-question-{{ section.id }} {
    width: 100%;
    text-align: left;
    background: none;
    border: none;
    padding: 20px 0;
    font-size: 18px;
    font-weight: bold;
    color: {{ section.settings.text_color }};
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .cro-faq-icon-{{ section.id }} {
    transition: transform 0.3s ease;
  }
  .cro-faq-question-{{ section.id }}.active .cro-faq-icon-{{ section.id }} {
    transform: rotate(180deg);
  }
  .cro-faq-answer-{{ section.id }} {
    max-height: 0;
    overflow: hidden;
    transition: max-height 0.3s ease;
    color: {{ section.settings.text_color }};
    opacity: 0.8;
  }
  .cro-faq-answer-inner-{{ section.id }} {
    padding-bottom: 20px;
    line-height: 1.6;
  }
{%- endstyle -%}

<div class="cro-faq-{{ section.id }}">
  {% if section.settings.heading != blank %}
    <h2 class="cro-faq-title-{{ section.id }}">{{ section.settings.heading | escape }}</h2>
  {% endif %}

  <div class="cro-faq-container-{{ section.id }}">
    {% for block in section.blocks %}
      <div class="cro-faq-item-{{ section.id }}" {{ block.shopify_attributes }}>
        <button class="cro-faq-question-{{ section.id }}" aria-expanded="false">
          {{ block.settings.question | escape }}
          <svg class="cro-faq-icon-{{ section.id }}" width="14" height="8" viewBox="0 0 14 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 1L7 7L13 1" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
        <div class="cro-faq-answer-{{ section.id }}">
          <div class="cro-faq-answer-inner-{{ section.id }}">
            {{ block.settings.answer }}
          </div>
        </div>
      </div>
    {% endfor %}
  </div>
</div>

<script>
  document.addEventListener("DOMContentLoaded", function() {
    const faqContainer = document.querySelector('.cro-faq-{{ section.id }}');
    if(!faqContainer) return;
    
    const questions = faqContainer.querySelectorAll('.cro-faq-question-{{ section.id }}');
    
    questions.forEach(question => {
      question.addEventListener('click', function() {
        const isActive = this.classList.contains('active');
        const answer = this.nextElementSibling;
        
        // Optional: Close all other accordions
        {% if section.settings.close_others %}
        questions.forEach(q => {
          q.classList.remove('active');
          q.setAttribute('aria-expanded', 'false');
          q.nextElementSibling.style.maxHeight = null;
        });
        {% endif %}
        
        if (!isActive) {
          this.classList.add('active');
          this.setAttribute('aria-expanded', 'true');
          answer.style.maxHeight = answer.scrollHeight + "px";
        } else {
          this.classList.remove('active');
          this.setAttribute('aria-expanded', 'false');
          answer.style.maxHeight = null;
        }
      });
    });
  });
</script>

{% schema %}
{
  "name": "CRO - FAQ Accordion",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "Frequently Asked Questions" },
    { "type": "checkbox", "id": "close_others", "label": "Close other panels when one is opened", "default": true },
    { "type": "header", "content": "Colors" },
    { "type": "color", "id": "heading_color", "label": "Heading Color", "default": "#121212" },
    { "type": "color", "id": "text_color", "label": "Text Color", "default": "#121212" },
    { "type": "color", "id": "border_color", "label": "Divider Color", "default": "#e5e5e5" },
    { "type": "header", "content": "Layout & Styling" },
    { "type": "range", "id": "heading_size", "min": 20, "max": 60, "step": 2, "label": "Heading Size", "default": 32 },
    { "type": "range", "id": "max_width", "min": 400, "max": 1200, "step": 50, "label": "Max Width", "default": 800 },
    { "type": "range", "id": "padding_x", "min": 0, "max": 100, "step": 5, "label": "Horizontal Padding", "default": 20 },
    { "type": "range", "id": "margin_top", "min": 0, "max": 100, "step": 5, "label": "Top Margin", "default": 40 },
    { "type": "range", "id": "margin_bottom", "min": 0, "max": 100, "step": 5, "label": "Bottom Margin", "default": 40 }
  ],
  "blocks": [
    {
      "type": "faq_item",
      "name": "FAQ Item",
      "settings": [
        { "type": "text", "id": "question", "label": "Question", "default": "What is your return policy?" },
        { "type": "richtext", "id": "answer", "label": "Answer", "default": "<p>We offer a 30-day money back guarantee on all purchases.</p>" }
      ]
    }
  ],
  "presets": [
    {
      "name": "CRO - FAQ Accordion",
      "category": "FAQ",
      "blocks": [
        { "type": "faq_item" },
        { "type": "faq_item" },
        { "type": "faq_item" }
      ]
    }
  ]
}
{% endschema %}`
    },
    {
      sku: 'CRO-CMP-001',
      name: 'Us vs Them Compare Table',
      handle: 'cro-compare-table-01',
      category_id: categoryCompare.id,
      short_description: 'Showcase why your product is superior.',
      full_description: 'A visually striking comparison table designed to position your product against competitors. Crucial for conversion optimization.',
      price: 0.0,
      is_free: true,
      tag: 'Comparison',
      liquid_content: `{%- style -%}
  .cro-compare-{{ section.id }} {
    max-width: {{ section.settings.max_width }}px;
    margin: {{ section.settings.margin_top }}px auto {{ section.settings.margin_bottom }}px auto;
    padding: 0 {{ section.settings.padding_x }}px;
    font-family: inherit;
  }
  .cro-compare-title-{{ section.id }} {
    text-align: center;
    font-size: {{ section.settings.heading_size }}px;
    margin-bottom: 40px;
    color: {{ section.settings.text_color }};
  }
  .cro-compare-grid-{{ section.id }} {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  }
  .cro-compare-header-{{ section.id }} {
    display: contents;
  }
  .cro-compare-cell-{{ section.id }} {
    padding: 20px;
    background: #ffffff;
    border-bottom: 1px solid #f0f0f0;
    display: flex;
    align-items: center;
    color: {{ section.settings.text_color }};
  }
  .cro-compare-cell-our-{{ section.id }} {
    background: {{ section.settings.our_bg_color }};
    justify-content: center;
  }
  .cro-compare-cell-their-{{ section.id }} {
    background: {{ section.settings.their_bg_color }};
    justify-content: center;
  }
  .cro-compare-header-cell-{{ section.id }} {
    font-weight: bold;
    font-size: 18px;
    padding: 24px 20px;
  }
  .cro-compare-header-our-{{ section.id }} {
    background: {{ section.settings.our_bg_color }};
    text-align: center;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }
  .cro-compare-header-their-{{ section.id }} {
    background: {{ section.settings.their_bg_color }};
    text-align: center;
  }
  .cro-icon-check { color: #10B981; width: 24px; height: 24px; }
  .cro-icon-cross { color: #EF4444; width: 24px; height: 24px; }
  @media (max-width: 768px) {
    .cro-compare-cell-{{ section.id }} { padding: 12px 10px; font-size: 14px; }
    .cro-compare-header-cell-{{ section.id }} { font-size: 16px; padding: 16px 10px; }
  }
{%- endstyle -%}

<div class="cro-compare-{{ section.id }}">
  {% if section.settings.heading != blank %}
    <h2 class="cro-compare-title-{{ section.id }}">{{ section.settings.heading | escape }}</h2>
  {% endif %}

  <div class="cro-compare-grid-{{ section.id }}">
    <div class="cro-compare-header-{{ section.id }}">
      <div class="cro-compare-cell-{{ section.id }} cro-compare-header-cell-{{ section.id }}" style="background: transparent; border-bottom: none;"></div>
      <div class="cro-compare-cell-{{ section.id }} cro-compare-header-our-{{ section.id }} cro-compare-header-cell-{{ section.id }}">{{ section.settings.our_brand | escape }}</div>
      <div class="cro-compare-cell-{{ section.id }} cro-compare-header-their-{{ section.id }} cro-compare-header-cell-{{ section.id }}">{{ section.settings.their_brand | escape }}</div>
    </div>

    {% for block in section.blocks %}
      <div class="cro-compare-cell-{{ section.id }}" style="font-weight: 500;">
        {{ block.settings.feature | escape }}
      </div>
      <div class="cro-compare-cell-{{ section.id }} cro-compare-cell-our-{{ section.id }}">
        {% if block.settings.our_status == 'check' %}
          <svg class="cro-icon-check" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
        {% else %}
          <svg class="cro-icon-cross" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
        {% endif %}
      </div>
      <div class="cro-compare-cell-{{ section.id }} cro-compare-cell-their-{{ section.id }}">
        {% if block.settings.their_status == 'check' %}
          <svg class="cro-icon-check" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
        {% else %}
          <svg class="cro-icon-cross" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12"></path></svg>
        {% endif %}
      </div>
    {% endfor %}
  </div>
</div>

{% schema %}
{
  "name": "CRO - Compare Table",
  "settings": [
    { "type": "text", "id": "heading", "label": "Heading", "default": "Why choose us?" },
    { "type": "text", "id": "our_brand", "label": "Your Brand Name", "default": "Us" },
    { "type": "text", "id": "their_brand", "label": "Competitor Name", "default": "Them" },
    { "type": "header", "content": "Colors" },
    { "type": "color", "id": "our_bg_color", "label": "Your Brand Column Background", "default": "#f0fdf4" },
    { "type": "color", "id": "their_bg_color", "label": "Competitor Column Background", "default": "#f9fafb" },
    { "type": "color", "id": "text_color", "label": "Text Color", "default": "#121212" },
    { "type": "header", "content": "Layout & Styling" },
    { "type": "range", "id": "heading_size", "min": 20, "max": 60, "step": 2, "label": "Heading Size", "default": 32 },
    { "type": "range", "id": "max_width", "min": 400, "max": 1200, "step": 50, "label": "Max Width", "default": 900 },
    { "type": "range", "id": "padding_x", "min": 0, "max": 100, "step": 5, "label": "Horizontal Padding", "default": 20 },
    { "type": "range", "id": "margin_top", "min": 0, "max": 100, "step": 5, "label": "Top Margin", "default": 60 },
    { "type": "range", "id": "margin_bottom", "min": 0, "max": 100, "step": 5, "label": "Bottom Margin", "default": 60 }
  ],
  "blocks": [
    {
      "type": "feature",
      "name": "Feature Row",
      "settings": [
        { "type": "text", "id": "feature", "label": "Feature Name", "default": "Premium Quality" },
        { "type": "select", "id": "our_status", "label": "Our Brand Status", "options": [{"value": "check", "label": "Check"},{"value": "cross", "label": "Cross"}], "default": "check" },
        { "type": "select", "id": "their_status", "label": "Competitor Status", "options": [{"value": "check", "label": "Check"},{"value": "cross", "label": "Cross"}], "default": "cross" }
      ]
    }
  ],
  "presets": [
    {
      "name": "CRO - Compare Table",
      "category": "Comparison Tables",
      "blocks": [
        { "type": "feature", "settings": { "feature": "Free Shipping", "our_status": "check", "their_status": "cross" } },
        { "type": "feature", "settings": { "feature": "30-Day Guarantee", "our_status": "check", "their_status": "cross" } },
        { "type": "feature", "settings": { "feature": "24/7 Support", "our_status": "check", "their_status": "cross" } }
      ]
    }
  ]
}
{% endschema %}`
    },
    {
      sku: 'CRO-TRST-001',
      name: 'Dynamic Trust Badges',
      handle: 'cro-trust-badges-01',
      category_id: categoryTrust.id,
      short_description: 'Instill buyer confidence with customizable trust badges.',
      full_description: 'A row of Trust Badges (Shipping, Returns, Secure Checkout). Essential for boosting conversion rates on Product Pages.',
      price: 0.0,
      is_free: true,
      tag: 'Trust',
      liquid_content: `{%- style -%}
  .cro-trust-{{ section.id }} {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: {{ section.settings.gap }}px;
    padding: {{ section.settings.padding_y }}px 0;
    margin: {{ section.settings.margin_top }}px 0 {{ section.settings.margin_bottom }}px 0;
    border-top: {{ section.settings.border_width }}px solid {{ section.settings.border_color }};
    border-bottom: {{ section.settings.border_width }}px solid {{ section.settings.border_color }};
    background-color: {{ section.settings.bg_color }};
  }
  .cro-trust-item-{{ section.id }} {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    width: {{ section.settings.item_width }}px;
    color: {{ section.settings.text_color }};
  }
  .cro-trust-icon-{{ section.id }} {
    width: {{ section.settings.icon_size }}px;
    height: {{ section.settings.icon_size }}px;
    margin-bottom: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cro-trust-icon-{{ section.id }} svg {
    width: 100%;
    height: 100%;
    fill: {{ section.settings.icon_color }};
  }
  .cro-trust-icon-{{ section.id }} img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .cro-trust-title-{{ section.id }} {
    font-size: {{ section.settings.font_size }}px;
    font-weight: 600;
    line-height: 1.3;
  }
{%- endstyle -%}

<div class="cro-trust-{{ section.id }}">
  {% for block in section.blocks %}
    <div class="cro-trust-item-{{ section.id }}" {{ block.shopify_attributes }}>
      <div class="cro-trust-icon-{{ section.id }}">
        {% if block.settings.image != blank %}
          <img src="{{ block.settings.image | img_url: '100x' }}" alt="{{ block.settings.title | escape }}">
        {% else %}
          {{ block.settings.svg_code }}
        {% endif %}
      </div>
      <div class="cro-trust-title-{{ section.id }}">{{ block.settings.title | escape }}</div>
    </div>
  {% endfor %}
</div>

{% schema %}
{
  "name": "CRO - Trust Badges",
  "settings": [
    { "type": "header", "content": "Colors" },
    { "type": "color", "id": "bg_color", "label": "Background Color", "default": "transparent" },
    { "type": "color", "id": "text_color", "label": "Text Color", "default": "#121212" },
    { "type": "color", "id": "icon_color", "label": "SVG Icon Color", "default": "#121212" },
    { "type": "color", "id": "border_color", "label": "Border Color", "default": "#e5e5e5" },
    { "type": "header", "content": "Layout & Styling" },
    { "type": "range", "id": "item_width", "min": 80, "max": 250, "step": 10, "label": "Item Max Width", "default": 120 },
    { "type": "range", "id": "icon_size", "min": 20, "max": 100, "step": 2, "label": "Icon Size", "default": 32 },
    { "type": "range", "id": "font_size", "min": 10, "max": 24, "step": 1, "label": "Font Size", "default": 13 },
    { "type": "range", "id": "gap", "min": 10, "max": 100, "step": 5, "label": "Gap between items", "default": 30 },
    { "type": "range", "id": "border_width", "min": 0, "max": 5, "step": 1, "label": "Top/Bottom Border Width", "default": 1 },
    { "type": "range", "id": "padding_y", "min": 0, "max": 100, "step": 5, "label": "Vertical Padding", "default": 20 },
    { "type": "range", "id": "margin_top", "min": 0, "max": 100, "step": 5, "label": "Top Margin", "default": 0 },
    { "type": "range", "id": "margin_bottom", "min": 0, "max": 100, "step": 5, "label": "Bottom Margin", "default": 0 }
  ],
  "blocks": [
    {
      "type": "badge",
      "name": "Trust Badge",
      "settings": [
        { "type": "text", "id": "title", "label": "Badge Text", "default": "Free Shipping" },
        { "type": "html", "id": "svg_code", "label": "SVG Icon Code", "default": "<svg viewBox='0 0 24 24'><path d='M20 8h-3V4H3c-1.1 0-2 .9-2 2v11h2c0 1.66 1.34 3 3 3s3-1.34 3-3h6c0 1.66 1.34 3 3 3s3-1.34 3-3h2v-5l-3-4zM6 18.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm13.5-9l1.96 2.5H17V9.5h2.5zm-1.5 9c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z'/></svg>" },
        { "type": "image_picker", "id": "image", "label": "Or Image (Overrides SVG)" }
      ]
    }
  ],
  "presets": [
    {
      "name": "CRO - Trust Badges",
      "category": "Trust Signals",
      "blocks": [
        { "type": "badge", "settings": { "title": "Free Delivery" } },
        { "type": "badge", "settings": { "title": "30-Day Returns" } },
        { "type": "badge", "settings": { "title": "Secure Checkout" } }
      ]
    }
  ]
}
{% endschema %}`
    },
    {
      sku: 'CRO-URG-001',
      name: 'Urgency / FOMO Banner',
      handle: 'cro-urgency-banner-01',
      category_id: categoryBanner.id,
      short_description: 'Create urgency with a ticking countdown.',
      full_description: 'A customizable banner featuring a dynamic countdown timer to drive immediate action from visitors.',
      price: 0.0,
      is_free: true,
      tag: 'Urgency',
      liquid_content: `{%- style -%}
  .cro-urgency-{{ section.id }} {
    background-color: {{ section.settings.bg_color }};
    color: {{ section.settings.text_color }};
    padding: {{ section.settings.padding_y }}px {{ section.settings.padding_x }}px;
    text-align: center;
    font-size: {{ section.settings.font_size }}px;
    font-weight: 500;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 15px;
    margin: {{ section.settings.margin_top }}px 0 {{ section.settings.margin_bottom }}px 0;
  }
  .cro-urgency-timer-{{ section.id }} {
    display: flex;
    gap: 8px;
    font-weight: bold;
  }
  .cro-urgency-box-{{ section.id }} {
    background: {{ section.settings.box_bg_color }};
    color: {{ section.settings.box_text_color }};
    padding: 4px 8px;
    border-radius: 4px;
    min-width: 40px;
  }
  .cro-urgency-btn-{{ section.id }} {
    background-color: {{ section.settings.btn_bg_color }};
    color: {{ section.settings.btn_text_color }};
    padding: 8px 16px;
    border-radius: 4px;
    text-decoration: none;
    font-weight: bold;
    font-size: 14px;
    transition: opacity 0.3s;
  }
  .cro-urgency-btn-{{ section.id }}:hover {
    opacity: 0.8;
  }
{%- endstyle -%}

<div class="cro-urgency-{{ section.id }}">
  <div class="cro-urgency-text-{{ section.id }}">{{ section.settings.message | escape }}</div>
  
  <div class="cro-urgency-timer-{{ section.id }}" data-hours="{{ section.settings.hours }}" data-minutes="{{ section.settings.minutes }}">
    <div class="cro-urgency-box-{{ section.id }}"><span class="h">00</span>h</div>
    <div class="cro-urgency-box-{{ section.id }}"><span class="m">00</span>m</div>
    <div class="cro-urgency-box-{{ section.id }}"><span class="s">00</span>s</div>
  </div>

  {% if section.settings.btn_link != blank %}
    <a href="{{ section.settings.btn_link }}" class="cro-urgency-btn-{{ section.id }}">{{ section.settings.btn_text | escape }}</a>
  {% endif %}
</div>

<script>
  document.addEventListener("DOMContentLoaded", function() {
    const timerEl = document.querySelector('.cro-urgency-timer-{{ section.id }}');
    if(!timerEl) return;
    
    // Simple evergreen timer logic (resets for each user)
    let hours = parseInt(timerEl.getAttribute('data-hours')) || 2;
    let minutes = parseInt(timerEl.getAttribute('data-minutes')) || 0;
    
    // Check local storage so it doesn't reset on refresh
    const storageKey = 'cro_timer_' + '{{ section.id }}';
    let endTime = localStorage.getItem(storageKey);
    const now = new Date().getTime();
    
    if(!endTime || now > parseInt(endTime)) {
      endTime = now + (hours * 60 * 60 * 1000) + (minutes * 60 * 1000);
      localStorage.setItem(storageKey, endTime);
    } else {
      endTime = parseInt(endTime);
    }

    const hSpan = timerEl.querySelector('.h');
    const mSpan = timerEl.querySelector('.m');
    const sSpan = timerEl.querySelector('.s');

    const updateTimer = setInterval(function() {
      const currentTime = new Date().getTime();
      const distance = endTime - currentTime;

      if (distance < 0) {
        clearInterval(updateTimer);
        hSpan.innerText = "00";
        mSpan.innerText = "00";
        sSpan.innerText = "00";
        return;
      }

      const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((distance % (1000 * 60)) / 1000);

      hSpan.innerText = h < 10 ? "0" + h : h;
      mSpan.innerText = m < 10 ? "0" + m : m;
      sSpan.innerText = s < 10 ? "0" + s : s;
    }, 1000);
  });
</script>

{% schema %}
{
  "name": "CRO - Urgency Banner",
  "settings": [
    { "type": "text", "id": "message", "label": "Message", "default": "Flash Sale Ends Soon!" },
    { "type": "range", "id": "hours", "min": 0, "max": 24, "step": 1, "label": "Timer Hours", "default": 2 },
    { "type": "range", "id": "minutes", "min": 0, "max": 59, "step": 1, "label": "Timer Minutes", "default": 30 },
    { "type": "text", "id": "btn_text", "label": "Button Text", "default": "Shop Now" },
    { "type": "url", "id": "btn_link", "label": "Button Link" },
    { "type": "header", "content": "Colors" },
    { "type": "color", "id": "bg_color", "label": "Background Color", "default": "#121212" },
    { "type": "color", "id": "text_color", "label": "Text Color", "default": "#ffffff" },
    { "type": "color", "id": "box_bg_color", "label": "Timer Box Background", "default": "#ffffff" },
    { "type": "color", "id": "box_text_color", "label": "Timer Box Text", "default": "#121212" },
    { "type": "color", "id": "btn_bg_color", "label": "Button Background", "default": "#E11D48" },
    { "type": "color", "id": "btn_text_color", "label": "Button Text Color", "default": "#ffffff" },
    { "type": "header", "content": "Layout & Styling" },
    { "type": "range", "id": "font_size", "min": 12, "max": 24, "step": 1, "label": "Font Size", "default": 16 },
    { "type": "range", "id": "padding_y", "min": 0, "max": 50, "step": 2, "label": "Vertical Padding", "default": 12 },
    { "type": "range", "id": "padding_x", "min": 0, "max": 50, "step": 2, "label": "Horizontal Padding", "default": 20 },
    { "type": "range", "id": "margin_top", "min": 0, "max": 50, "step": 5, "label": "Top Margin", "default": 0 },
    { "type": "range", "id": "margin_bottom", "min": 0, "max": 50, "step": 5, "label": "Bottom Margin", "default": 0 }
  ],
  "presets": [
    {
      "name": "CRO - Urgency Banner",
      "category": "Announcement Banners"
    }
  ]
}
{% endschema %}`
    }
  ];

  for (const sData of sectionsData) {
    const liquid = sData.liquid_content;
    delete sData.liquid_content;

    let section = await prisma.section.findUnique({ where: { handle: sData.handle } });
    if (!section) {
      section = await prisma.section.create({
        data: sData
      });
      console.log(`Created section: ${section.name}`);
    } else {
      section = await prisma.section.update({
        where: { id: section.id },
        data: sData
      });
      console.log(`Updated section: ${section.name}`);
    }

    // Always create a new version with the liquid content
    await prisma.sectionVersion.create({
      data: {
        section_id: section.id,
        version: "1.0.0",
        liquid_content: liquid,
        is_breaking: false,
      }
    });
  }

  console.log('Successfully injected 5 CRO optimized sections!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
