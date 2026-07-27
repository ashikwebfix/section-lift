-- CreateTable
CREATE TABLE "Shop" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopify_shop_id" TEXT,
    "shop_domain" TEXT NOT NULL,
    "installed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uninstalled_at" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "default_theme_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "category_id" TEXT,
    "short_description" TEXT,
    "full_description" TEXT,
    "price" REAL NOT NULL DEFAULT 0.0,
    "is_free" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PUBLISHED',
    "demo_url" TEXT,
    "preview_image_url" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "Section_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SectionVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "section_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "liquid_source_location" TEXT,
    "liquid_content" TEXT,
    "checksum" TEXT,
    "is_breaking" BOOLEAN NOT NULL DEFAULT false,
    "published_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SectionVersion_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "Section" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Entitlement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop_domain" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "source_type" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "granted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Entitlement_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "Section" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Installation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop_domain" TEXT NOT NULL,
    "section_id" TEXT NOT NULL,
    "section_version_id" TEXT,
    "theme_id" TEXT NOT NULL,
    "theme_name" TEXT,
    "theme_role" TEXT,
    "filename" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "installed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Installation_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "Section" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Installation_section_version_id_fkey" FOREIGN KEY ("section_version_id") REFERENCES "SectionVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shopify_shop_id_key" ON "Shop"("shopify_shop_id");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_shop_domain_key" ON "Shop"("shop_domain");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Section_sku_key" ON "Section"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "Section_handle_key" ON "Section"("handle");
