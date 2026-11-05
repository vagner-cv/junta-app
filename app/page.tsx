"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { balances, brl, settlements, type SplitExpense } from "../lib/money";
import { ExpenseForm } from "./expense-form";

type Group = { id: string; name: string; owner_id: string; invite_token: string };
export type Member = { id: string; name: string; user_id: string | null };
export type Expense = Omit<SplitExpense, "items"> & { id: string; title: string; expense_date: string; receipt_path: string | null;
  created_by: string; revision: number;
  items: { description: string; quantity: number; amount_cents: number; consumers: string[] }[] };
type Invite = { name: string; available: Member[] };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let browserClient: SupabaseClient | undefined;
let sessionRequest: Promise<string> | undefined;
function start(client: SupabaseClient) {
  sessionRequest ??= (async () => {
    const current = await client.auth.getSession();
    if (current.error) throw current.error;
    if (current.data.session) return current.data.session.user.id;
    const login = await client.auth.signInAnonymously();
    if (login.error) throw login.error;
    if (!login.data.user) throw new Error("Não foi possível iniciar a sessão.");
    return login.data.user.id;
  })().catch(error => { sessionRequest = undefined; throw error; });
  return sessionRequest;
}

export default function Page() {
  const [client, setClient] = useState<SupabaseClient>();
  const [userId, setUserId] = useState("");
  const [groups, setGroups] = useState<Group[]>([]);
  const [active, setActive] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [invite, setInvite] = useState<Invite>();
  const [token, setToken] = useState("");
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Expense>();
  const [openExpense, setOpenExpense] = useState("");
  const [receipt, setReceipt] = useState("");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [site, setSite] = useState("");
  const group = groups.find(item => item.id === active);

  const refreshGroups = useCallback(async (db: SupabaseClient) => {
    const result = await db.from("groups").select("*").order("name");
    if (result.error) throw result.error;
    setGroups(result.data);
  }, []);

  const connect = useCallback(async () => {
    if (!url || !key) return;
    setError("");
    try {
      browserClient ??= createClient(url, key);
      const db = browserClient;
      const id = await start(db);
      const inviteToken = new URLSearchParams(location.search).get("convite");
      if (inviteToken) {
        const result = await db.rpc("invite_info", { token: inviteToken });
        if (result.error || !result.data) setError("Convite inválido. Peça um novo link ao grupo.");
        else {
          setToken(inviteToken);
          setInvite(result.data);
        }
      }
      await refreshGroups(db);
      setSite(location.origin);
      setUserId(id);
      setClient(db);
    } catch (cause) { setError(message(cause)); }
  }, [refreshGroups]);

  useEffect(() => { void connect(); }, [connect]);

  useEffect(() => {
    if (!client || !active) return;
    const db = client;
    let closed = false;
    let version = 0;
    async function reload() {
      const request = ++version;
      const [people, entries] = await Promise.all([
        db.from("members").select("id,name,user_id").eq("group_id", active).order("name"),
        db.from("expenses").select("*").eq("group_id", active).order("expense_date", { ascending: false }),
      ]);
      if (closed || request !== version) return;
      if (people.error || entries.error) setError(message(people.error ?? entries.error));
      else { setMembers(people.data); setExpenses(entries.data); }
    }
    const channel = db.channel("group:" + active)
      .on("postgres_changes", { event: "*", schema: "public", table: "members", filter: "group_id=eq." + active }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses", filter: "group_id=eq." + active }, reload)
      .subscribe(status => { if (status === "SUBSCRIBED") void reload(); });
    void reload();
    window.addEventListener("focus", reload);
    window.addEventListener("junta:refresh", reload);
    return () => {
      closed = true;
      window.removeEventListener("focus", reload);
      window.removeEventListener("junta:refresh", reload);
      void db.removeChannel(channel);
    };
  }, [client, active]);

  async function action(work: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(""); setNotice("");
    try { await work(); } catch (cause) { setError(message(cause)); }
    finally { busyRef.current = false; setBusy(false); }
  }

  function choose(id: string) {
    if (id !== active) { setMembers([]); setExpenses([]); }
    setAdding(false); setEditing(undefined); setOpenExpense(""); setReceipt(""); setActive(id);
  }

  async function submit(event: FormEvent<HTMLFormElement>, operation: "create" | "join" | "member") {
    event.preventDefault();
    if (!client) return;
    const form = new FormData(event.currentTarget);
    const element = event.currentTarget;
    await action(async () => {
      const name = String(form.get("name") ?? "").trim();
      const result = operation === "create"
        ? await client.rpc("create_group", { group_name: String(form.get("group")).trim(), member_name: name })
        : operation === "join"
          ? await client.rpc("join_group", { token, member_name: name, claim_id: form.get("claim") || null })
          : await client.rpc("add_member", { target: active, member_name: name });
      if (result.error) throw result.error;
      if (operation !== "member") {
        await refreshGroups(client);
        choose(result.data);
      } else window.dispatchEvent(new Event("junta:refresh"));
      if (operation === "join") { setInvite(undefined); history.replaceState(null, "", "/"); }
      element.reset();
    });
  }

  const memberName = (id: string) => members.find(member => member.id === id)?.name ?? "Participante";
  const totals = balances(members.map(member => member.id), expenses);
  const transfers = settlements(totals);
  const inviteLink = group ? site + "/?convite=" + group.invite_token : "";

  return <main>
    <header><span className="brand">Junta<span>.</span></span><p>Despesas compartilhadas</p></header>
    {error && <p className="alert" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!url || !key ? <section><h1>Configure o Junta</h1><p>Preencha a URL e a chave pública do Supabase em .env.local e reinicie o aplicativo.</p></section>
      : !client ? <section>{error ? <button onClick={connect}>Tentar conectar novamente</button> : <p>Conectando…</p>}</section>
      : invite ? <section>
        <h1>Entrar em {invite.name}</h1>
        <form onSubmit={event => submit(event, "join")}>
          {!!invite.available.length && <label>Seu nome já está no grupo?<select name="claim"><option value="">Criar meu participante</option>
            {invite.available.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select></label>}
          <label>Seu nome, se estiver criando um participante<input name="name" maxLength={60} /></label>
          <button disabled={busy}>Entrar no grupo</button>
        </form>
      </section> : !group ? <>
        <section><h1>Seus grupos</h1>
          {groups.length ? <div className="stack">{groups.map(item => <button className="secondary" key={item.id} onClick={() => choose(item.id)}>{item.name}</button>)}</div>
            : <p>Crie um grupo ou abra um convite para começar.</p>}
        </section>
        <section><h2>Criar grupo</h2><form onSubmit={event => submit(event, "create")}>
          <label>Nome do grupo<input name="group" maxLength={80} required /></label>
          <label>Seu nome<input name="name" maxLength={60} required /></label>
          <button disabled={busy}>Criar grupo</button>
        </form></section>
        <p className="muted">Seu acesso é guardado neste navegador. Limpar os dados do site pode fazer você perder o acesso.</p>
      </> : <>
        <div className="actions">
          <button className="secondary" onClick={() => choose("")}>← Grupos</button>
          <button className="secondary" disabled={busy} onClick={() => {
            if (!window.confirm("Sair deste grupo? Seu histórico ficará registrado.")) return;
            void action(async () => {
              const result = await client.rpc("leave_group", { target: group.id });
              if (result.error) throw result.error;
              choose("");
              await refreshGroups(client);
            });
          }}>Sair do grupo</button>
        </div>
        <section><h1>{group.name}</h1><div className="actions">
          <button className="secondary" onClick={() => action(async () => { await navigator.clipboard.writeText(inviteLink); setNotice("Convite copiado."); })}>Copiar convite</button>
          <a href={"https://wa.me/?text=" + encodeURIComponent("Entre no grupo " + group.name + " no Junta: " + inviteLink)} target="_blank" rel="noreferrer">Convidar pelo WhatsApp</a>
        </div></section>
        {adding || editing ? <ExpenseForm key={editing?.id ?? group.id} client={client} userId={userId} groupId={group.id}
          members={members} expense={editing}
          onClose={() => { setAdding(false); setEditing(undefined); }}
          onSaved={() => { setAdding(false); setEditing(undefined); window.dispatchEvent(new Event("junta:refresh")); }} />
          : <>
            <section><h2>Saldos</h2>
              {members.map(member => {
                const value = totals.get(member.id) ?? 0;
                return <div className="row" key={member.id}><span>{member.name}</span><strong className={value < 0 ? "debt" : "credit"}>{brl(Math.abs(value))} {value < 0 ? "a pagar" : value > 0 ? "a receber" : "em aberto"}</strong></div>;
              })}
            </section>
            <section><h2>Acertar contas</h2>
              {transfers.length ? <>
                <small>Transferências sugeridas com base nos saldos do grupo.</small>
                {transfers.map(transfer => <div className="row settlement" key={transfer.from + ":" + transfer.to}>
                  <span><strong>{memberName(transfer.from)}</strong> paga a <strong>{memberName(transfer.to)}</strong></span>
                  <strong>{brl(transfer.cents)}</strong>
                </div>)}
              </> : <p>{expenses.length ? "O grupo está em dia." : "Adicione despesas para ver quem paga a quem."}</p>}
            </section>
            <section><div className="row"><h2>Despesas</h2><button disabled={!members.length} onClick={() => setAdding(true)}>Adicionar despesa</button></div>
              {!expenses.length && <p>Nenhuma despesa registrada.</p>}
              {expenses.map(expense => <article key={expense.id}>
                <button className="entry row" aria-expanded={openExpense === expense.id} onClick={() => {
                  setReceipt(""); setOpenExpense(openExpense === expense.id ? "" : expense.id);
                }}><span><strong>{expense.title}</strong><small>{expense.expense_date.split("-").reverse().join("/")} · {memberName(expense.payer_id)} pagou</small></span>
                  <strong>{brl(expense.total_cents)}</strong></button>
                {openExpense === expense.id && <div className="details">{expense.items.map((item, index) => <div className="row" key={index}>
                  <span>{item.quantity} × {item.description}<small>{item.consumers.map(memberName).join(", ")}</small></span><strong>{brl(item.amount_cents)}</strong>
                </div>)}
                  {(expense.created_by === userId || group.owner_id === userId) &&
                    <button className="secondary" onClick={() => setEditing(expense)}>Editar despesa</button>}
                  {expense.receipt_path && (receipt
                    ? <a href={receipt} target="_blank" rel="noreferrer">Abrir comprovante</a>
                    : <button className="secondary" disabled={busy} onClick={() => action(async () => {
                      const result = await client.storage.from("receipts").createSignedUrl(expense.receipt_path!, 60);
                      if (result.error) throw result.error;
                      setReceipt(result.data.signedUrl);
                    })}>Carregar comprovante</button>)}
                </div>}
              </article>)}
            </section>
            {group.owner_id === userId && <section><h2>Adicionar participante</h2><form onSubmit={event => submit(event, "member")}>
              <label>Nome<input name="name" maxLength={60} required /></label><button disabled={busy}>Adicionar por nome</button>
            </form></section>}
          </>}
      </>}
  </main>;
}

function message(cause: unknown) {
  return typeof cause === "object" && cause && "message" in cause ? String(cause.message) : "Não foi possível concluir. Tente novamente.";
}
