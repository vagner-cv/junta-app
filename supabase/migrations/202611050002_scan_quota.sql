create table public.receipt_scans (
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid not null,
  created_at timestamptz not null default now()
);
create index on public.receipt_scans (group_id, created_at);
create index on public.receipt_scans (user_id, created_at);
alter table public.receipt_scans enable row level security;
revoke all on public.receipt_scans from anon, authenticated;

create function public.reserve_receipt_scan(target uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_member(target) then raise exception 'Sem acesso ao grupo.'; end if;
  perform pg_advisory_xact_lock(1, hashtext(auth.uid()::text));
  perform pg_advisory_xact_lock(2, hashtext(target::text));
  if (select count(*) from public.receipt_scans where user_id = auth.uid() and created_at > now() - interval '1 day') >= 5
    or (select count(*) from public.receipt_scans where group_id = target and created_at > now() - interval '1 day') >= 20
  then return false; end if;
  insert into public.receipt_scans (group_id, user_id) values (target, auth.uid());
  return true;
end $$;

revoke execute on function public.reserve_receipt_scan(uuid) from public, anon;
grant execute on function public.reserve_receipt_scan(uuid) to authenticated;
