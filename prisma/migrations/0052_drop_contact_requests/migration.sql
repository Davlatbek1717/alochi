-- Drop contact requests funnel — feature removed end-to-end.
-- Idempotent: tolerates the table/enum already being absent.
DROP TABLE IF EXISTS "contact_requests";
DROP TYPE  IF EXISTS "ContactRequestStatus";
DROP TYPE  IF EXISTS "CenterSize";
