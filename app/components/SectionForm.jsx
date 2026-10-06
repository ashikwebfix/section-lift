import { Form } from "react-router";

/**
 * Shared create/edit form for superadmin sections.
 * Field names must stay in sync with the actions in
 * superadmin.sections.new.jsx and superadmin.sections.$id.jsx.
 */
export default function SectionForm({ categories, section = null, liquidContent = "", isSubmitting, submitLabel, submittingLabel, error }) {
  const s = section || {};
  const bool = (v, fallback) => (v === undefined || v === null ? fallback : v ? "true" : "false");

  return (
    <Form method="post" encType="multipart/form-data" className="sl-card sa-form-card">
      {section && <input type="hidden" name="intent" value="update" />}

      {error && (
        <div style={{ padding: "var(--sl-space-6) var(--sl-space-6) 0" }}>
          <div className="sl-alert sl-alert-error" role="alert">{error}</div>
        </div>
      )}

      <div className="sa-form-section">
        <div>
          <h2 className="sl-section-title">Basics</h2>
          <p className="sl-caption sl-mt-1">How this resource is identified across the app.</p>
        </div>
        <div className="sa-form-grid">
          <div className="sl-field">
            <label className="sl-label-text" htmlFor="sf-name" style={{ marginBottom: 0 }}>Name</label>
            <input id="sf-name" type="text" name="name" defaultValue={s.name} className="sl-input" required />
          </div>
          <div className="sl-field">
            <label className="sl-label-text" htmlFor="sf-sku" style={{ marginBottom: 0 }}>SKU</label>
            <input id="sf-sku" type="text" name="sku" defaultValue={s.sku} className="sl-input" required />
            <span className="sa-hint">Must be unique.</span>
          </div>
          <div className="sl-field">
            <label className="sl-label-text" htmlFor="sf-handle" style={{ marginBottom: 0 }}>Handle</label>
            <input id="sf-handle" type="text" name="handle" defaultValue={s.handle} className="sl-input" required />
            <span className="sa-hint">Unique and URL friendly, e.g. hero-banner-01.</span>
          </div>
          <div className="sl-field">
            <label className="sl-label-text" htmlFor="sf-type" style={{ marginBottom: 0 }}>Type</label>
            <select id="sf-type" name="type" defaultValue={s.type || "SECTION"} className="sl-select" required>
              <option value="SECTION">Section</option>
              <option value="PAGE">Page</option>
            </select>
          </div>
          <div className="sl-field">
            <label className="sl-label-text" htmlFor="sf-category" style={{ marginBottom: 0 }}>Category</label>
            <select id="sf-category" name="category_id" defaultValue={s.category_id || ""} className="sl-select" required>
              <option value="">Select category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="sl-field">
            <label className="sl-label-text" htmlFor="sf-tag" style={{ marginBottom: 0 }}>Tag <span className="sa-hint">(optional)</span></label>
            <input id="sf-tag" type="text" name="tag" defaultValue={s.tag || ""} className="sl-input" placeholder="e.g. Banner, Slider" />
          </div>
        </div>
      </div>

      <div className="sa-form-section">
        <div>
          <h2 className="sl-section-title">Pricing &amp; visibility</h2>
          <p className="sl-caption sl-mt-1">Control access and how it's surfaced to merchants.</p>
        </div>
        <div className="sa-form-grid">
          <div className="sl-field">
            <label className="sl-label-text" htmlFor="sf-price" style={{ marginBottom: 0 }}>Price (USD)</label>
            <input id="sf-price" type="number" step="0.01" name="price" defaultValue={s.price ?? 0} className="sl-input" required />
          </div>
          <div className="sl-field">
            <label className="sl-label-text" htmlFor="sf-free" style={{ marginBottom: 0 }}>Free?</label>
            <select id="sf-free" name="is_free" defaultValue={bool(s.is_free, "true")} className="sl-select" required>
              <option value="true">Yes</option>
              <option value="false">No</option>
            </select>
          </div>
          <div className="sl-field">
            <label className="sl-label-text" htmlFor="sf-exclusive" style={{ marginBottom: 0 }}>Exclusive?</label>
            <select id="sf-exclusive" name="is_exclusive" defaultValue={bool(s.is_exclusive, "false")} className="sl-select" required>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
            <span className="sa-hint">Exclusive items are excluded from the subscription.</span>
          </div>
          <div className="sl-field">
            <label className="sl-label-text" htmlFor="sf-featured" style={{ marginBottom: 0 }}>Featured?</label>
            <select id="sf-featured" name="is_featured" defaultValue={bool(s.is_featured, "false")} className="sl-select" required>
              <option value="false">No</option>
              <option value="true">Yes</option>
            </select>
          </div>
        </div>
      </div>

      <div className="sa-form-section">
        <div>
          <h2 className="sl-section-title">Content</h2>
          <p className="sl-caption sl-mt-1">Preview, descriptions, and the Liquid source.</p>
        </div>

        <div className="sl-field">
          <label className="sl-label-text" htmlFor="sf-image" style={{ marginBottom: 0 }}>Preview image</label>
          {s.preview_image_url && (
            <div className="sl-flex sl-items-center sl-gap-3">
              <img src={s.preview_image_url} alt="Current preview" className="sa-thumb" style={{ width: 120, height: 80 }} />
              <span className="sa-hint">Leave the field blank to keep the current image.</span>
            </div>
          )}
          <input id="sf-image" type="file" name="preview_image" accept="image/*" className="sl-input sa-file-input" />
        </div>

        <div className="sl-field">
          <label className="sl-label-text" htmlFor="sf-short" style={{ marginBottom: 0 }}>Short description</label>
          <input id="sf-short" type="text" name="short_description" defaultValue={s.short_description || ""} className="sl-input" />
        </div>

        <div className="sl-field">
          <label className="sl-label-text" htmlFor="sf-full" style={{ marginBottom: 0 }}>Full description</label>
          <textarea id="sf-full" name="full_description" defaultValue={s.full_description || ""} className="sl-input sl-textarea" rows="3" />
        </div>

        <div className="sl-field">
          <label className="sl-label-text" htmlFor="sf-liquid" style={{ marginBottom: 0 }}>Liquid code</label>
          <textarea
            id="sf-liquid"
            name="liquid_content"
            defaultValue={liquidContent}
            className="sl-input sl-textarea sa-code"
            rows="14"
            spellCheck={false}
            required
          />
        </div>
      </div>

      <div className="sa-form-footer">
        <button type="submit" className="sl-btn sl-btn-primary" disabled={isSubmitting}>
          {isSubmitting ? submittingLabel : submitLabel}
        </button>
      </div>
    </Form>
  );
}
