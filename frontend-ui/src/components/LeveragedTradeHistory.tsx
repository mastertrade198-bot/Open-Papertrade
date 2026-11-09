"use client";
import { useEffect, useState } from "react";
import { ChartNoAxesCombined } from "lucide-react";
import { userAPI, type SimulatedPosition } from "@/lib/api";

const usd = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(n);

export default function LeveragedTradeHistory() {
  const [positions, setPositions] = useState<SimulatedPosition[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await userAPI.getPositions();
        if (active) { setPositions(data.positions); setError(""); }
      } catch {
        if (active) setError("Não foi possível atualizar as operações.");
      }
    };
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const recent = [...positions].sort((a, b) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()).slice(0, 5);
  return <section className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-primary)] px-4 py-3">
      <div className="flex items-center gap-2"><ChartNoAxesCombined size={17} className="text-[var(--accent-primary)]" /><h2 className="text-sm font-semibold text-[var(--text-primary)]">Operações</h2></div>
      <span className="text-xs text-[var(--text-muted)]">{positions.filter(p => p.status === "OPEN").length} abertas · {positions.length} no histórico</span>
    </div>
    {error && <p role="alert" className="px-4 py-2 text-xs text-red-500">{error}</p>}
    {recent.length === 0 ? <p className="px-4 py-5 text-center text-xs text-[var(--text-muted)]">Nenhuma operação registrada.</p> :
      <div className="divide-y divide-[var(--border-primary)]">
        {recent.map(p => {
          const pnl = p.status === "OPEN" ? p.unrealizedPnl : p.realizedPnl;
          return <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_110px_110px_100px]">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{p.symbol} <span className="text-xs font-normal text-[var(--text-muted)]">{p.side === "LONG" ? "Compra" : "Venda"} · {p.leverage}x</span></p>
              <p className="text-[11px] text-[var(--text-muted)]">{new Date(p.openedAt).toLocaleDateString("pt-BR")}</p>
            </div>
            <div className="hidden text-right text-xs text-[var(--text-secondary)] sm:block">{usd(p.margin)}</div>
            <span className={`rounded-md px-2 py-1 text-center text-[11px] font-semibold ${p.status === "OPEN" ? "bg-blue-500/10 text-blue-500" : "bg-[var(--bg-secondary)] text-[var(--text-muted)]"}`}>{p.status === "OPEN" ? "Aberta" : "Fechada"}</span>
            <span className={`whitespace-nowrap text-right text-xs font-semibold ${pnl == null ? "text-[var(--text-muted)]" : pnl >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>{pnl == null ? "—" : usd(pnl)}</span>
          </div>;
        })}
      </div>}
  </section>;
}
