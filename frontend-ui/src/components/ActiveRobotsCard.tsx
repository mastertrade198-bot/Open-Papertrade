"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bot, ChevronRight } from "lucide-react";
import { API_HOST } from "@/lib/api";

type Robot = { id: string; displayNumber: number; symbol: string; assetName: string; status: string; pnl: number };

export default function ActiveRobotsCard() {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`${API_HOST}/api/robots/`, { credentials: "include", cache: "no-store" });
        if (!response.ok) throw new Error("Falha ao carregar robôs");
        const data = await response.json();
        if (active) { setRobots(Array.isArray(data.robots) ? data.robots : []); setError(false); }
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const activeRobots = robots.filter(robot => robot.status === "ACTIVE");
  const money = (value: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "USD" }).format(value);

  return <section className="overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)]">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-primary)] px-4 py-3">
      <div className="flex items-center gap-2"><Bot size={17} className="text-[var(--accent-primary)]"/><h2 className="text-sm font-semibold text-[var(--text-primary)]">Robôs ativos</h2></div>
      <Link href="/robots" className="inline-flex items-center gap-1 text-xs text-[var(--accent-primary)] hover:underline">Ver robôs <ChevronRight size={13}/></Link>
    </div>
    <div className="px-4 py-4">
      {loading ? <p className="text-xs text-[var(--text-muted)]">Carregando robôs...</p> :
        error ? <p className="text-xs text-[var(--text-muted)]">Não foi possível consultar os robôs.</p> :
        <>
          <p className="mb-3 text-2xl font-semibold tabular-nums text-[var(--text-primary)]">{activeRobots.length}<span className="ml-2 text-xs font-normal text-[var(--text-muted)]">em execução</span></p>
          {activeRobots.length === 0 ? <p className="text-xs text-[var(--text-muted)]">Nenhum robô ativo no momento.</p> :
            <div className="divide-y divide-[var(--border-primary)]">{activeRobots.slice(0, 4).map(robot =>
              <div key={robot.id} className="flex items-center justify-between gap-3 py-2 text-xs">
                <span className="min-w-0 truncate text-[var(--text-primary)]">{robot.assetName || robot.symbol} <span className="text-[var(--text-muted)]">#{robot.displayNumber}</span></span>
                <span className={`shrink-0 font-semibold tabular-nums ${robot.pnl >= 0 ? "text-[var(--accent-green)]" : "text-[var(--accent-red)]"}`}>{money(robot.pnl)}</span>
              </div>)}</div>}
        </>
      }
    </div>
  </section>;
}
