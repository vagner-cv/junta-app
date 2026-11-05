create function public.leave_group(target uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  -- Keep the participant and its balances, without making it claimable by a new visitor.
  update public.members set departed = true where group_id = target and user_id = auth.uid();
end $$;

revoke execute on function public.leave_group(uuid) from public, anon;
grant execute on function public.leave_group(uuid) to authenticated;
