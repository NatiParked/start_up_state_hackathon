-- 0013_subscriptions_rls_fix.sql
-- Add missing INSERT policy for authenticated users (admins, logged-in testers)
-- and DELETE policies for the unsubscribe capability-URL flow.
-- Idempotent: safe to re-run.

-- Authenticated users can also subscribe (anon policy already exists from 0009)
DROP POLICY IF EXISTS map_subscriptions_authed_insert ON map_subscriptions;
CREATE POLICY map_subscriptions_authed_insert
  ON map_subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Anon visitors can delete via the unsubscribe link (?unsubscribe=<id>)
-- UUID is a non-guessable capability token; USING(true) is intentional.
DROP POLICY IF EXISTS map_subscriptions_anon_delete ON map_subscriptions;
CREATE POLICY map_subscriptions_anon_delete
  ON map_subscriptions
  FOR DELETE
  TO anon
  USING (true);

-- Authenticated users (admins) can also delete via the unsubscribe link
DROP POLICY IF EXISTS map_subscriptions_authed_delete ON map_subscriptions;
CREATE POLICY map_subscriptions_authed_delete
  ON map_subscriptions
  FOR DELETE
  TO authenticated
  USING (true);
