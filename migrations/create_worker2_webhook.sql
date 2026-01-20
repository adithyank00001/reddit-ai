-- Create webhook trigger for Worker 2 (The Brain)
-- This trigger fires when a new lead is inserted into the leads table
-- and sends a POST request to the Google Apps Script web app

-- First, ensure the pg_net extension is enabled (required for webhooks)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Drop the trigger if it already exists (to avoid errors on re-run)
DROP TRIGGER IF EXISTS "worker2_lead_processing_webhook" ON "public"."leads";

-- Create the webhook trigger
-- This will send a POST request to your Google Apps Script web app
-- whenever a new row is inserted into the leads table
CREATE TRIGGER "worker2_lead_processing_webhook"
AFTER INSERT ON "public"."leads"
FOR EACH ROW
EXECUTE FUNCTION "net"."http_request"(
  'https://script.google.com/macros/s/AKfycbwdaAr0ASaEe2ADL5nFe9jXvDHAfZabhcBpJWa19yVSCdlHAuChinssYQvYb8rdEPhpgg/exec',
  'POST',
  '{"Content-Type": "application/json"}',
  '{}',
  '30000'::text -- 30 second timeout
);

-- Add a comment for documentation
COMMENT ON TRIGGER "worker2_lead_processing_webhook" ON "public"."leads" IS 
'Webhook trigger that sends new lead data to Worker 2 (Google Apps Script) for AI processing';
