-- RLS yoqish
ALTER TABLE tenants     ENABLE ROW LEVEL SECURITY;
ALTER TABLE branches    ENABLE ROW LEVEL SECURITY;
ALTER TABLE users       ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Tenant izolyatsiyasi (app_user uchun)
CREATE POLICY tenant_isolation ON users
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid
         OR current_setting('app.role', true) = 'superadmin');

CREATE POLICY tenant_isolation ON branches
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid
         OR current_setting('app.role', true) = 'superadmin');

-- Superadmin va app_user ruxsatlari
GRANT ALL ON ALL TABLES IN SCHEMA public TO app_user;
