create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  owner_id uuid not null,
  invite_token uuid not null unique default gen_random_uuid()
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups on delete cascade,
  user_id uuid,
  departed boolean not null default false,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  unique (group_id, user_id),
  unique (group_id, id)
);

create table public.expenses (
  id uuid primary key,
  group_id uuid not null references public.groups on delete cascade,
  created_by uuid not null,
  payer_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  expense_date date not null,
  total_cents integer not null check (total_cents > 0),
  receipt_path text,
  items jsonb not null,
  foreign key (group_id, payer_id) references public.members (group_id, id)
);

alter table public.groups enable row level security;
alter table public.members enable row level security;
alter table public.expenses enable row level security;

create function public.is_member(target uuid) returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (
  select 1 from public.members where group_id = target and user_id = auth.uid() and not departed
) $$;

create policy groups_read on public.groups for select to authenticated using (public.is_member(id));
create policy members_read on public.members for select to authenticated using (public.is_member(group_id));
create policy expenses_read on public.expenses for select to authenticated using (public.is_member(group_id));

revoke all on public.groups, public.members, public.expenses from anon, authenticated;
grant select on public.groups, public.members, public.expenses to authenticated;

create function public.create_group(group_name text, member_name text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare new_id uuid;
begin
  insert into public.groups(name, owner_id) values (btrim(group_name), auth.uid()) returning id into new_id;
  insert into public.members(group_id, user_id, name) values (new_id, auth.uid(), btrim(member_name));
  return new_id;
end $$;

create function public.add_member(target uuid, member_name text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_member(target) or not exists (select 1 from public.groups where id = target and owner_id = auth.uid()) then
    raise exception 'Somente quem criou o grupo pode adicionar participantes.';
  end if;
  insert into public.members(group_id, name) values (target, btrim(member_name));
end $$;

create function public.invite_info(token uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('name', g.name, 'available', coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'name', m.name) order by m.name)
    from public.members m where m.group_id = g.id and m.user_id is null
  ), '[]'::jsonb))
  from public.groups g where g.invite_token = token
$$;

create function public.join_group(token uuid, member_name text, claim_id uuid default null) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
  select id into target from public.groups where invite_token = token for update;
  if target is null then raise exception 'Convite inválido.'; end if;
  update public.members set departed = false where group_id = target and user_id = auth.uid();
  if found then return target; end if;
  if claim_id is null then
    insert into public.members(group_id, user_id, name) values (target, auth.uid(), btrim(member_name));
  else
    update public.members set user_id = auth.uid()
      where group_id = target and id = claim_id and user_id is null;
    if not found then raise exception 'Este participante já foi vinculado.'; end if;
  end if;
  return target;
end $$;

create function public.save_expense(
  expense_id uuid, target uuid, payer uuid, expense_title text, spent_on date,
  total integer, lines jsonb, photo text default null
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  line jsonb;
  consumer uuid;
  consumers uuid[];
  amount integer;
  tally bigint := 0;
begin
  if not public.is_member(target) then raise exception 'Sem acesso ao grupo.'; end if;
  if exists (select 1 from public.expenses where id = expense_id and group_id = target and created_by = auth.uid()) then
    return expense_id;
  end if;
  if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) not between 1 and 100 then
    raise exception 'Informe de 1 a 100 itens.';
  end if;
  if photo is not null and (
    photo <> target::text || '/' || auth.uid()::text || '/' || expense_id::text or
    not exists (select 1 from storage.objects where bucket_id = 'receipts' and name = photo)
  ) then raise exception 'Comprovante inválido.'; end if;
  for line in select value from jsonb_array_elements(lines) loop
    amount := (line->>'amount_cents')::integer;
    if coalesce(char_length(btrim(line->>'description')), 0) not between 1 and 120
      or jsonb_typeof(line->'quantity') is distinct from 'number' or (line->>'quantity')::numeric <= 0
      or jsonb_typeof(line->'amount_cents') is distinct from 'number' or amount is null
      or jsonb_typeof(line->'consumers') is distinct from 'array' then
      raise exception 'Confira os dados dos itens.';
    end if;
    consumers := array(select distinct value::uuid from jsonb_array_elements_text(line->'consumers'));
    if cardinality(consumers) = 0 or cardinality(consumers) <> jsonb_array_length(line->'consumers') then
      raise exception 'Selecione os consumidores de cada item.';
    end if;
    foreach consumer in array consumers loop
      if not exists (select 1 from public.members where id = consumer and group_id = target) then
        raise exception 'Consumidor inválido.';
      end if;
    end loop;
    tally := tally + amount;
  end loop;
  if tally is distinct from total::bigint or total <= 0 then raise exception 'A soma dos itens deve bater com o total.'; end if;
  insert into public.expenses(id, group_id, created_by, payer_id, title, expense_date, total_cents, items, receipt_path)
  values (expense_id, target, auth.uid(), payer, btrim(expense_title), spent_on, total, lines, photo)
  on conflict (id) do nothing;
  if not exists (select 1 from public.expenses where id = expense_id and group_id = target and created_by = auth.uid()) then
    raise exception 'Identificador de despesa em uso.';
  end if;
  return expense_id;
end $$;

revoke execute on function public.is_member(uuid), public.create_group(text,text), public.add_member(uuid,text),
  public.invite_info(uuid), public.join_group(uuid,text,uuid),
  public.save_expense(uuid,uuid,uuid,text,date,integer,jsonb,text) from public, anon;
grant execute on function public.is_member(uuid), public.create_group(text,text), public.add_member(uuid,text),
  public.invite_info(uuid), public.join_group(uuid,text,uuid),
  public.save_expense(uuid,uuid,uuid,text,date,integer,jsonb,text) to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

create policy receipts_read on storage.objects for select to authenticated using (
  bucket_id = 'receipts' and case when (storage.foldername(name))[1] ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then public.is_member((storage.foldername(name))[1]::uuid) else false end and (
    (storage.foldername(name))[2] = auth.uid()::text or
    exists (select 1 from public.expenses where receipt_path = name)
  )
);
create policy receipts_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'receipts' and array_length(storage.foldername(name), 1) = 2
  and case when (storage.foldername(name))[1] ~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then public.is_member((storage.foldername(name))[1]::uuid) else false end
  and (storage.foldername(name))[2] = auth.uid()::text
);

alter publication supabase_realtime add table public.expenses, public.members;
