-- Global project settings to store product description, summarized context, and global keywords

CREATE TABLE IF NOT EXISTS "project_settings" (
  "id" INTEGER PRIMARY KEY DEFAULT 1,
  "product_description_raw" TEXT,
  "product_context" TEXT,
  "keywords" TEXT[]
);

-- Ensure a singleton row exists
INSERT INTO "project_settings" ("id")
VALUES (1)
ON CONFLICT ("id") DO NOTHING;

