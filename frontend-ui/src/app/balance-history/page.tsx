"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Sidebar from "@/components/Sidebar";
import LeveragedTradeHistory from "@/components/LeveragedTradeHistory";
import { userAPI, type BalanceTransaction } from "@/lib/api";

const usd = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(n);
const date = (s: string) => new Date(s).toLocaleString("pt-BR");
const withdrawalStatus = (category: string) => category === "WITHDRAWAL_REQUEST" ? "Solicitado" : category === "WITHDRAWAL_APPROVED" ? "Confirmado" : category === "WITHDRAWAL_REFUND" || category === "WITHDRAWAL_REJECTED_LEGACY" ? "Rejeitado" : null;
const transactionType = (category: string, amount: number) => withdrawalStatus(category) ? "Saque" : amount > 0 ? "Crédito" : amount < 0 ? "Débito" : "Registro";

export default function BalanceHistoryPage() {
  const [transactions, setTransactions] = useState<BalanceTransaction[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [filter, setFilter] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    try {
      const result = await userAPI.getBalanceHistory(500);
      setTransactions(result.transactions);
      setBalance(result.buyingPower);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o histórico.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const shown = useMemo(() => transactions.filter((t) => filter === "ALL" || (filter === "CREDIT" ? t.amount > 0 : t.amount < 0 || t.category === "WITHDRAWAL_APPROVED" || t.category === "WITHDRAWAL_REJECTED_LEGACY")), [transactions, filter]);
  return (
    <div className="flex h-screen bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto p-5 md:p-8">
        <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
          <div><h1 className="font-primary text-2xl font-semibold tracking-normal">Extrato da conta</h1><p className="text-sm text-[var(--text-muted)] mt-1">Consulte as movimentações e os saldos da sua conta.</p></div>
          <button onClick={() => void load()} className="px-4 py-2 rounded-lg border border-[var(--border-primary)] hover:bg-[var(--bg-hover)]">Atualizar</button>
        </div>
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 mb-6">
          <p className="text-sm text-[var(--text-muted)]">Saldo disponível</p>
          <p className="text-2xl font-bold mt-1">{balance === null ? "—" : usd(balance)}</p>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {([["ALL", "Todas as movimentações"], ["CREDIT", "Créditos"], ["DEBIT", "Débitos"]] as const).map(([value, label]) => (
            <button key={value} onClick={() => setFilter(value)} className={`px-4 py-2 rounded-lg text-sm border border-[var(--border-primary)] ${filter === value ? "bg-[var(--bg-hover)] font-semibold" : ""}`}>{label}</button>
          ))}
        </div>
        {error && <p role="alert" className="text-[var(--accent-red)] mb-4">{error}</p>}
        <div className="overflow-x-auto rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)]">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="text-left text-[var(--text-muted)] border-b border-[var(--border-primary)]">
              <tr>{["Data", "Movimentação", "Situação", "Descrição", "Valor (USD)", "Saldo anterior", "Saldo após"].map(h => <th key={h} className="px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {shown.map(t => <tr key={t.id} className="border-b border-[var(--border-primary)]">
                <td className="px-4 py-3 whitespace-nowrap">{date(t.createdAt)}</td>
                <td className="px-4 py-3">{transactionType(t.category, t.amount)}</td>
                <td className="px-4 py-3">{withdrawalStatus(t.category) ? <span className={`inline-flex rounded-md px-2 py-1 text-xs font-semibold ${t.category === "WITHDRAWAL_APPROVED" ? "bg-[var(--accent-green)]/10 text-[var(--accent-green)]" : t.category === "WITHDRAWAL_REFUND" || t.category === "WITHDRAWAL_REJECTED_LEGACY" ? "bg-[var(--accent-red)]/10 text-[var(--accent-red)]" : "bg-[var(--bg-muted)] text-[var(--text-secondary)]"}`}>{withdrawalStatus(t.category)}</span> : <span className="text-[var(--text-muted)]">—</span>}</td>
                <td className="px-4 py-3">{t.description}</td>
                <td className={`px-4 py-3 font-mono font-semibold ${t.amount >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>{t.amount >= 0 ? "+" : ""}{usd(t.amount)}</td>
                <td className="px-4 py-3 font-mono">{usd(t.balanceBefore)}</td>
                <td className="px-4 py-3 font-mono">{usd(t.balanceAfter)}</td>
              </tr>)}
              {!shown.length && <tr><td colSpan={7} className="px-4 py-10 text-center text-[var(--text-muted)]">{loading ? "Carregando transações..." : "Nenhuma transação registrada neste filtro."}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-6"><LeveragedTradeHistory /></div>
        <p className="text-xs text-[var(--text-muted)] mt-4">O histórico registra alterações feitas após a ativação do recurso. Operações anteriores não são reconstruídas. Até 500 registros recentes são exibidos.</p>
      </main>
    </div>
  );
}
