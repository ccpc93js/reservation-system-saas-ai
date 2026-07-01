-- Allow org members to update guest book entries (service type corrections, etc.)
CREATE POLICY checkin_registry_update ON public.checkin_registry
  FOR UPDATE
  USING (organization_id IN (
    SELECT memberships.organization_id FROM memberships WHERE memberships.user_id = auth.uid()
  ))
  WITH CHECK (organization_id IN (
    SELECT memberships.organization_id FROM memberships WHERE memberships.user_id = auth.uid()
  ));
