"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ClipboardList, RefreshCw } from "lucide-react";
import { userAPI, type BalanceTransaction } from "@/lib/api";

const usd = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(amount);
const date = (value: string) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); };
const friendlyDescription = (description: string, category: string, amount: number) => {
  const raw = (description || "").trim();
  const clean = raw.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "").replace(/\s*[·:–-]\s*$/g, "").replace(/\bsimulad[oa]s?\b/gi, "").replace(/\s{2,}/g, " ").trim();
  if (category === "ROBOT_RESERVE" || /^capital\s+(?:simulado\s+)?reservado/i.test(raw)) return "Valor reservado para robô";
  if (category === "ROBOT_REFUND" || /^capital\s+(?:simulado\s+)?devolvido/i.test(raw)) return "Devolução de valor reservado";
  if (category === "WITHDRAWAL_REFUND" || category === "WITHDRAWAL_REJECTED_LEGACY") return "Devolução de saque rejeitado";
  if (/^participa[cç][aã]o\s+(?:simulada\s+)?no projeto/i.test(raw)) return clean.replace(/^participa[cç][aã]o\s+no projeto/i, "Investimento no projeto");
  if (/^margem reservada/i.test(raw)) return clean.replace(/^margem reservada/i, "Margem utilizada");
  if (/^altera[cç][aã]o de saldo dispon[ií]vel/i.test(raw)) return amount >= 0 ? "Crédito no saldo disponível" : "Débito no saldo disponível";
  return clean || (amount >= 0 ? "Crédito na conta" : "Débito na conta");
};

export default function PortfolioBalanceStatement() {
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [filter, setFilter] = useState<"ALL" | "CREDIT" | "DEBIT">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try { const result = await userAPI.getBalanceHistory(500); setTransactions(result.transactions); setError(""); }
    catch { setError("Não foi possível carregar as movimentações da conta."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000);
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onFocus); };
  }, [load]);
  const shown = useMemo(() => transactions.filter(t => filter === "ALL" || (filter === "CREDIT" ? t.amount > 0 : t.amount < 0)), [transactions, filter]);
  return <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-primary)] px-4 py-4">
      <div className="flex items-center gap-2"><ClipboardList size={18} className="text-[var(--accent-primary)]" /><div><h2 className="text-sm font-semibold text-[var(--text-primary)]">Entradas e saídas</h2><p className="text-xs text-[var(--text-secondary)]">Extrato de movimentações do saldo da conta</p></div></div>
      <div className="flex items-center gap-3"><button type="button" onClick={() => void load()} aria-label="Atualizar extrato" className="rounded-lg border border-[var(--border-primary)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"><RefreshCw size={14} /></button></div>
    </div>
    <div className="flex gap-2 border-b border-[var(--border-primary)] px-4 py-3">
      {([{key:"ALL",label:"Todas"},{key:"CREDIT",label:"Entradas"},{key:"DEBIT",label:"Saídas"}] as const).map(item => <button type="button" key={item.key} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)} className={`rounded-full border px-3 py-1.5 text-xs ${filter === item.key ? "border-[var(--accent-primary)] bg-[var(--accent-primary)]/10 text-[var(--accent-primary)]" : "border-[var(--border-primary)] text-[var(--text-secondary)]"}`}>{item.label}</button>)}
    </div>
    {error && <p role="alert" className="px-4 py-3 text-xs text-[var(--accent-red)]">{error}</p>}
    {loading ? <p className="px-4 py-8 text-center text-xs text-[var(--text-secondary)]">Carregando movimentações...</p> : shown.length === 0 ? <p className="px-4 py-8 text-center text-xs text-[var(--text-secondary)]">Nenhuma movimentação registrada neste filtro.</p> :
      <div className="overflow-x-auto"><table className="w-full min-w-[680px] text-left text-xs"><thead className="bg-[var(--bg-card-inner)] text-[var(--text-secondary)]"><tr><th className="px-4 py-3">Data e hora</th><th className="px-3 py-3">Movimentação</th><th className="px-3 py-3">Descrição</th><th className="px-3 py-3">Situação</th><th className="px-3 py-3 text-right">Valor</th><th className="px-3 py-3 text-right">Saldo anterior</th><th className="px-4 py-3 text-right">Saldo após</th></tr></thead><tbody className="divide-y divide-[var(--border-primary)]">{shown.map(t => <tr key={t.id}><td className="whitespace-nowrap px-4 py-3 text-[var(--text-secondary)]">{date(t.createdAt)}</td><td className="px-3 py-3"><span className="inline-flex items-center gap-1">{t.amount >= 0 ? <ArrowDownLeft size={14} className="text-[var(--accent-green)]" /> : <ArrowUpRight size={14} className="text-[var(--accent-red)]" />}{t.amount >= 0 ? "Entrada" : "Saída"}</span></td><td className="px-3 py-3 text-[var(--text-primary)]">{friendlyDescription(t.description, t.category, t.amount)}</td><td className="px-3 py-3 text-[var(--text-secondary)]">{t.category === "WITHDRAWAL_REQUEST" ? "Solicitado" : t.category === "WITHDRAWAL_APPROVED" ? "Confirmado" : t.category === "WITHDRAWAL_REFUND" || t.category === "WITHDRAWAL_REJECTED_LEGACY" ? "Rejeitado" : "—"}</td><td className={`whitespace-nowrap px-3 py-3 text-right font-semibold tabular-nums ${t.amount >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>{t.amount >= 0 ? "+" : ""}{usd(t.amount)}</td><td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{usd(t.balanceBefore)}</td><td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">{usd(t.balanceAfter)}</td></tr>)}</tbody></table></div>}
    <p className="border-t border-[var(--border-primary)] px-4 py-3 text-[11px] text-[var(--text-secondary)]">Exibindo até 500 movimentações recentes. Os registros financeiros permanecem preservados na conta.</p>
  </section>;
}
