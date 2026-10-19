"use client";
import { useEffect, useState } from "react";
import { userAPI, type SimulatedPosition } from "@/lib/api";

const usd = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(n);
export default function LeveragedTradeHistory() {
  const [positions, setPositions] = useState<SimulatedPosition[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    userAPI.getPositions().then(data => { if (active) setPositions(data.positions); })
      .catch(() => { if (active) setError("Não foi possível carregar operações alavancadas."); });
    return () => { active = false; };
  }, []);
  return <section className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5">
    <h2 className="text-lg font-semibold text-[var(--text-primary)]">Operações de trade alavancadas</h2>
    <p className="text-xs text-[var(--text-muted)] mb-4">Posições abertas e fechadas, incluindo resultados realizados.</p>
    {error && <p role="alert" className="text-red-500">{error}</p>}
    <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-sm text-[var(--text-primary)]">
      <thead><tr className="border-b border-[var(--border-primary)] text-left">{["Data", "Ativo", "Direção", "Margem", "Alavancagem", "Status", "Fechamento", "Lucro / Prejuízo"].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead>
      <tbody>{positions.map(p => <tr key={p.id} className="border-b border-[var(--border-primary)]">
        <td className="p-3 whitespace-nowrap">{new Date(p.openedAt).toLocaleString("pt-BR")}</td>
        <td className="p-3">{p.symbol}</td><td className="p-3">{p.side === "LONG" ? "Compra" : "Venda"}</td>
        <td className="p-3">{usd(p.margin)}</td><td className="p-3">{p.leverage}x</td>
        <td className="p-3">{p.status === "OPEN" ? "Aberta" : "Encerrada"}</td>
        <td className="p-3 whitespace-nowrap">{p.closedAt ? new Date(p.closedAt).toLocaleString("pt-BR") : "—"}</td>
        <td className="p-3">{p.realizedPnl == null ? "—" : usd(p.realizedPnl)}</td>
      </tr>)}
      {!positions.length && !error && <tr><td colSpan={8} className="p-6 text-center">Nenhuma operação alavancada encontrada.</td></tr>}
      </tbody></table></div>
  </section>;
}
