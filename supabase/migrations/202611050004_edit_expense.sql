alter table public.expenses add column revision integer not null default 0;

create function public.edit_expense(
  expense_id uuid, target uuid, payer uuid, expense_title text, spent_on date,
  total integer, lines jsonb, expected_revision integer
) returns void language plpgsql security definer set search_path = '' as $$
declare
  line jsonb;
  consumer uuid;
  consumers uuid[];
  amount integer;
  tally bigint := 0;
begin
  if not public.is_member(target) or not exists (
    select 1 from public.expenses e join public.groups g on g.id = e.group_id
    where e.id = expense_id and e.group_id = target
      and auth.uid() in (e.created_by, g.owner_id)
  ) then raise exception 'Somente quem lançou a despesa ou criou o grupo pode editar.'; end if;
  if jsonb_typeof(lines) is distinct from 'array' or jsonb_array_length(lines) not between 1 and 100 then
    raise exception 'Informe de 1 a 100 itens.';
  end if;
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
  update public.expenses e
  set payer_id = payer, title = btrim(expense_title), expense_date = spent_on,
      total_cents = total, items = lines, revision = e.revision + 1
  where e.id = expense_id and e.group_id = target and e.revision = expected_revision;
  if not found then raise exception 'A despesa mudou. Reabra a edição para ver a versão atual.'; end if;
end $$;

revoke execute on function public.edit_expense(uuid,uuid,uuid,text,date,integer,jsonb,integer) from public, anon;
grant execute on function public.edit_expense(uuid,uuid,uuid,text,date,integer,jsonb,integer) to authenticated;
