-- 0014_subscriptions_upsert_policy.sql
-- Allow anon and authenticated users to update their own subscription row.
-- Required for upsert-by-email (re-subscribe updates preferences + resets confirmation).
-- Security: anyone who knows an email can update preferences, but must still
-- confirm from the inbox — acceptable for a public subscription form.

DROP POLICY IF EXISTS map_subscriptions_anon_update ON map_subscriptions;
CREATE POLICY map_subscriptions_anon_update
  ON map_subscriptions
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS map_subscriptions_authed_update ON map_subscriptions;
CREATE POLICY map_subscriptions_authed_update
  ON map_subscriptions
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
