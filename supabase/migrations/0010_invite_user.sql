-- Lets the invite-user Edge Function finish assigning a newly invited
-- profile to the inviting admin's organization + role. A plain UPDATE from
-- the Edge Function would get silently reverted by trg_guard_profile_tenant
-- (it only allows organization_id changes via app.allow_profile_org_change),
-- so this wraps that in a SECURITY DEFINER function instead.
--
-- This function does its own authorization: it has no auth.uid() check,
-- because the service-role client that calls it has no JWT/session. The
-- invite-user Edge Function already verifies the caller is an admin of
-- org_id before calling this, so it must never be reachable from the
-- browser — only the service role may execute it.
create or replace function public.admin_assign_invited_profile(target_user_id uuid, org_id uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if new_role not in ('admin', 'user') then
    raise exception 'Invalid role: %', new_role;
  end if;
  perform set_config('app.allow_profile_org_change', 'on', true);
  update public.profiles set organization_id = org_id, role = new_role where id = target_user_id;
end;
$$;

revoke all on function public.admin_assign_invited_profile(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.admin_assign_invited_profile(uuid, uuid, text) to service_role;
