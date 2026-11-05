"use client";

import { useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { brl, cents } from "../lib/money";
import type { Member } from "./page";
import { receiptTypes, type ReceiptSuggestion } from "../lib/receipt";

type Line = { id: string; description: string; quantity: string; value: string; consumers: string[] };
type Props = { client: SupabaseClient; groupId: string; userId: string; members: Member[]; onClose: () => void; onSaved: () => void };

export function ExpenseForm({ client, groupId, userId, members, onClose, onSaved }: Props) {
  const makeLine = (description = "", quantity = "1", value = ""): Line => ({
    id: crypto.randomUUID(), description, quantity, value, consumers: members.map(member => member.id),
  });
  const [lines, setLines] = useState<Line[]>(() => [makeLine()]);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toLocaleDateString("sv-SE"));
  const [total, setTotal] = useState("");
  const [payer, setPayer] = useState(members.find(member => member.user_id === userId)?.id ?? members[0]?.id ?? "");
  const [photo, setPhoto] = useState<File>();
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const working = useRef(false);
  const requestId = useRef<string | undefined>(undefined);
  const uploaded = useRef(false);
  const updateLine = (id: string, update: Partial<Line>) => setLines(current => current.map(line => line.id === id ? { ...line, ...update } : line));

  async function run(operation: () => Promise<void>) {
    if (working.current) return;
    working.current = true; setPending(true); setError("");
    try { await operation(); }
    catch (cause) { setError(typeof cause === "object" && cause && "message" in cause ? String(cause.message) : "Tente novamente."); }
    finally { working.current = false; setPending(false); }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const amount = cents(total);
      const items = lines.map(line => {
        const quantity = Number(line.quantity.replace(",", "."));
        if (!line.description.trim() || !Number.isFinite(quantity) || quantity <= 0 || !line.consumers.length) {
          throw new Error("Preencha a descrição, a quantidade e os consumidores de cada item.");
        }
        return { description: line.description.trim(), quantity, amount_cents: cents(line.value, true), consumers: line.consumers };
      });
      if (!title.trim() || !date || !payer) throw new Error("Informe título, data e pagador.");
      if (!amount || items.reduce((sum, item) => sum + item.amount_cents, 0) !== amount) {
        throw new Error("A soma dos itens deve ser igual ao total da despesa.");
      }
      requestId.current ??= crypto.randomUUID();
      setAttempted(true);
      const path = photo ? [groupId, userId, requestId.current].join("/") : null;
      if (photo && path && !uploaded.current) {
        const result = await client.storage.from("receipts").upload(path, photo);
        if (result.error) {
          const existing = await client.storage.from("receipts").createSignedUrl(path, 10);
          if (existing.error) throw result.error;
        }
        uploaded.current = true;
      }
      const result = await client.rpc("save_expense", {
        expense_id: requestId.current, target: groupId, payer, expense_title: title,
        spent_on: date, total: amount, lines: items, photo: path,
      });
      if (result.error) throw result.error;
      onSaved();
    });
  }

  function selectPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(""); setSuggestion("");
    if (!receiptTypes.includes(file.type) || file.size === 0 || file.size > 8 * 1024 * 1024) {
      setError("Escolha uma imagem JPEG, PNG, WebP ou HEIC de até 8 MB.");
    } else setPhoto(file);
  }

  function analyze() {
    if (!photo) return;
    void run(async () => {
      setSuggestion("");
      const auth = await client.auth.getSession();
      if (auth.error || !auth.data.session) throw new Error("Sessão indisponível. Reabra o app.");
      const data = new FormData();
      data.set("photo", photo);
      data.set("group", groupId);
      const response = await fetch("/api/receipt", {
        method: "POST", body: data, headers: { Authorization: "Bearer " + auth.data.session.access_token },
      });
      const result: ReceiptSuggestion & { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error ?? "A leitura falhou. Preencha os campos manualmente.");
      setTitle(result.title ?? result.merchant ?? "");
      setDate(result.date ?? "");
      setTotal(result.total_cents == null ? "" : (result.total_cents / 100).toFixed(2));
      setLines(result.items.length ? result.items.map(item => makeLine(item.description ?? "", item.quantity?.toString() ?? "",
        item.amount_cents == null ? "" : (item.amount_cents / 100).toFixed(2))) : [makeLine()]);
      setSuggestion(["Confira todos os campos antes de salvar.", result.merchant && "Estabelecimento: " + result.merchant, ...result.warnings].filter(Boolean).join(" "));
    });
  }

  let itemSum: number | undefined;
  let expected: number | undefined;
  try { itemSum = lines.reduce((sum, line) => sum + cents(line.value, true), 0); } catch {}
  try { expected = cents(total); } catch {}

  return <section><div className="row"><h2>Adicionar despesa</h2><button className="secondary" disabled={pending} onClick={onClose}>Voltar</button></div>
    {error && <p className="alert" role="alert">{error}</p>}
    {suggestion && <p role="status">{suggestion}</p>}
    <form onSubmit={submit}><fieldset disabled={pending} className="stack">
      <label>Fotografar nota<input type="file" disabled={attempted} accept="image/*" capture="environment" onChange={selectPhoto} /></label>
      <label>Escolher foto da galeria<input type="file" disabled={attempted} accept="image/*" onChange={selectPhoto} /></label>
      {photo && <div className="row"><span>{photo.name}</span><button type="button" className="secondary" disabled={attempted} onClick={() => setPhoto(undefined)}>Remover foto</button></div>}
      {photo && <button type="button" className="secondary" onClick={analyze}>Ler campos com IA</button>}
      <label>Título<input required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label>Data<input required type="date" value={date} onChange={event => setDate(event.target.value)} /></label>
      <label>Total em R$<input required inputMode="decimal" placeholder="0,00" value={total} onChange={event => setTotal(event.target.value)} /></label>
      <label>Quem pagou<select required value={payer} onChange={event => setPayer(event.target.value)}>
        {members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}
      </select></label>
      {lines.map((line, index) => <fieldset className="item stack" key={line.id}><legend>Item {index + 1}</legend>
        <label>Descrição<input required maxLength={120} value={line.description} onChange={event => updateLine(line.id, { description: event.target.value })} /></label>
        <div className="columns">
          <label>Quantidade<input required inputMode="decimal" value={line.quantity} onChange={event => updateLine(line.id, { quantity: event.target.value })} /></label>
          <label>Valor em R$ (negativo para desconto)<input required inputMode="decimal" value={line.value} onChange={event => updateLine(line.id, { value: event.target.value })} /></label>
        </div>
        <span>Quem consumiu?</span>
        <div className="actions">
          <button type="button" className="secondary" onClick={() => updateLine(line.id, { consumers: members.map(member => member.id) })}>Selecionar todos</button>
          <button type="button" className="secondary" onClick={() => updateLine(line.id, { consumers: [] })}>Limpar</button>
        </div>
        <div className="chips">{members.map(member => <label key={member.id}><input type="checkbox"
          checked={line.consumers.includes(member.id)} onChange={event => updateLine(line.id, {
            consumers: event.target.checked ? [...line.consumers, member.id] : line.consumers.filter(id => id !== member.id),
          })} />{member.name}</label>)}</div>
        {lines.length > 1 && <button type="button" className="secondary" onClick={() => setLines(current => current.filter(item => item.id !== line.id))}>Remover item</button>}
      </fieldset>)}
      <button type="button" className="secondary" disabled={lines.length >= 100} onClick={() => setLines(current => [...current, makeLine()])}>+ Adicionar item</button>
      {itemSum !== undefined && <p role="status">Soma dos itens {brl(itemSum)}{expected !== undefined && itemSum !== expected && " · Diferença " + brl(expected - itemSum)}</p>}
      <button type="submit">{pending ? "Processando…" : "Salvar despesa"}</button>
    </fieldset></form>
  </section>;
}
