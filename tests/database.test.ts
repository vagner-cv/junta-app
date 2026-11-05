import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const owner = "10000000-0000-0000-0000-000000000001";
const guest = "10000000-0000-0000-0000-000000000002";
const outsider = "10000000-0000-0000-0000-000000000003";
const expense = "20000000-0000-0000-0000-000000000001";

test("migrações protegem dados, preservam o vínculo e deduplicam despesas", async () => {
  const db = new PGlite();
  try {
    // Supabase provides these roles, schemas and functions in a hosted project.
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create function auth.uid() returns uuid language sql stable
        as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      create schema storage;
      create table storage.buckets (id text, name text, public boolean, file_size_limit int, allowed_mime_types text[]);
      create table storage.objects (bucket_id text, name text);
      alter table storage.objects enable row level security;
      create function storage.foldername(path text) returns text[] language sql immutable as
        $$ select (string_to_array(path, '/'))[1:cardinality(string_to_array(path, '/'))-1] $$;
      grant usage on schema auth, storage to authenticated;
      grant select, insert on storage.objects to authenticated;
      create publication supabase_realtime;
    `);
    for (const name of ["202611050001_junta", "202611050002_scan_quota", "202611050003_leave_group", "202611050004_edit_expense"]) {
      await db.exec(await readFile(new URL("../supabase/migrations/" + name + ".sql", import.meta.url), "utf8"));
    }
    await db.exec("set role authenticated");
    const asUser = (id: string) => db.query("select set_config('request.jwt.claim.sub', $1, false)", [id]);

    await asUser(owner);
    const created = await db.query<{ id: string }>("select public.create_group('Casa','Ana') as id");
    const group = created.rows[0].id;
    const groups = await db.query<{ invite_token: string }>("select invite_token from public.groups");
    const token = groups.rows[0].invite_token;
    await db.query("select public.add_member($1, 'Bruno')", [group]);
    const people = await db.query<{ id: string }>("select id from public.members order by name");
    const [a, b] = people.rows.map(person => person.id);
    const photo = [group, owner, expense].join("/");
    await db.query("insert into storage.objects values ('receipts', $1)", [photo]);

    const save = (consumers: string[], total = 5000) => db.query(
      "select public.save_expense($1,$2,$3,'Compras','2026-11-05',$4,$5,$6)",
      [expense, group, a, total, JSON.stringify([{ description: "Mercado", quantity: 1, amount_cents: 5000, consumers }]), photo],
    );
    await assert.rejects(save([]), /consumidores/);
    await assert.rejects(save([a, b], 4900), /soma/);
    await save([a, b]);
    await save([a, b]);
    assert.equal((await db.query("select id from public.expenses")).rows.length, 1);
    const edit = (revision = 0, total = 5000) => db.query(
      "select public.edit_expense($1,$2,$3,'Compras revisadas','2026-11-05',$4,$5,$6)",
      [expense, group, a, total, JSON.stringify([{ description: "Mercado", quantity: 1, amount_cents: 5000, consumers: [b] }]), revision],
    );
    await assert.rejects(edit(0, 4999), /soma/);
    await edit();
    await assert.rejects(edit(), /mudou/);
    const edited = await db.query("select title, receipt_path, revision from public.expenses");
    assert.deepEqual(edited.rows[0], { title: "Compras revisadas", receipt_path: photo, revision: 1 });

    await asUser(outsider);
    for (const table of ["public.groups", "public.members", "public.expenses", "storage.objects"]) {
      assert.equal((await db.query("select * from " + table)).rows.length, 0);
    }
    await assert.rejects(save([a]), /Sem acesso/);
    await assert.rejects(db.query("select public.reserve_receipt_scan($1)", [group]), /Sem acesso/);
    await assert.rejects(db.query("update public.expenses set total_cents=1"), /permission denied/);

    await asUser(guest);
    await db.query("select public.join_group($1,'',$2)", [token, b]);
    await assert.rejects(edit(1), /Somente quem/);
    assert.equal((await db.query("select id from public.members where user_id=auth.uid()")).rows.length, 1);
    assert.equal((await db.query("select id from public.expenses")).rows.length, 1);
    assert.equal((await db.query("select name from storage.objects")).rows.length, 1);
    for (let i = 0; i < 6; i++) {
      const result = await db.query<{ allowed: boolean }>("select public.reserve_receipt_scan($1) as allowed", [group]);
      assert.equal(result.rows[0].allowed, i < 5);
    }
    await db.query("select public.leave_group($1)", [group]);
    assert.equal((await db.query("select id from public.expenses")).rows.length, 0);
    assert.equal((await db.query("select name from storage.objects")).rows.length, 0);
    await db.query("select public.join_group($1,'Bruno')", [token]);
    const rejoined = await db.query<{ id: string }>("select id from public.members where user_id=auth.uid()");
    assert.equal(rejoined.rows[0].id, b);
  } finally {
    await db.close();
  }
});
