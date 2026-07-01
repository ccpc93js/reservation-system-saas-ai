-- Allow org members to delete guest book entries (manual removal)
CREATE POLICY checkin_registry_delete ON public.checkin_registry
  FOR DELETE
  USING (organization_id IN (
    SELECT memberships.organization_id FROM memberships WHERE memberships.user_id = auth.uid()
  ));
