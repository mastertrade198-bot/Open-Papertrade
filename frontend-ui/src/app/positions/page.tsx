"use client";

import { useCallback, useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";
import { SimulatedPosition, userAPI } from "@/lib/api";

const usd = (value: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export default function PositionsPage() {
  const [positions, setPositions] = useState<SimulatedPosition[]>([]);
  const [buyingPower, setBuyingPower] = useState<number | null>(null);
  const [symbol, setSymbol] = useState("AAPL");
  const [side, setSide] = useState<"LONG" | "SHORT">("LONG");
  const [quantity, setQuantity] = useState("1");
  const [leverage, setLeverage] = useState("10");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    try {
      const data = await userAPI.getPositions();
      setPositions(data.positions);
      setBuyingPower(data.buyingPower);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar as operações.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  async function openPosition(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const qty = Number(quantity);
    const lev = Number(leverage);
    if (!symbol.trim() || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(lev) || lev < 1 || lev > 100) {
      setError("Informe ativo, quantidade positiva e alavancagem de 1x a 100x.");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await userAPI.openPosition({ symbol: symbol.trim().toUpperCase(), side, quantity: qty, leverage: lev });
      setNotice("Operação simulada aberta.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível abrir a operação.");
    } finally {
      setBusy(false);
    }
  }

  async function closePosition(id: string) {
    if (!window.confirm("Encerrar esta operação simulada pelo preço atual de mercado?")) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await userAPI.closePosition(id);
      setNotice("Operação simulada encerrada.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível encerrar a operação.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="flex-1 min-w-0 p-6 md:p-10 space-y-6 text-[var(--text-primary)]">
        <header className="flex flex-wrap justify-between items-center gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Operações alavancadas · Simulador</h1>
            <p className="text-sm text-[var(--text-muted)]">Apenas saldo fictício. Nenhuma ordem é enviada a corretoras.</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-[var(--text-muted)]">Margem livre simulada</p>
            <p className="text-xl font-mono">{buyingPower === null ? "—" : usd(buyingPower)}</p>
          </div>
        </header>

        <form onSubmit={openPosition} className="grid grid-cols-2 lg:grid-cols-5 gap-3 p-5 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)]">
          <label className="text-sm">Selecionar ativo (USD)
            <select aria-label="Selecionar ativo" value={symbol} onChange={e => setSymbol(e.target.value)} className="mt-1 w-full p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)]" required>
              <optgroup label="Ações dos EUA">
                <option value="AAPL">Apple (AAPL)</option>
                <option value="MSFT">Microsoft (MSFT)</option>
                <option value="NVDA">NVIDIA (NVDA)</option>
                <option value="TSLA">Tesla (TSLA)</option>
                <option value="AMZN">Amazon (AMZN)</option>
                <option value="GOOGL">Alphabet (GOOGL)</option>
                <option value="META">Meta (META)</option>
              </optgroup>
              <optgroup label="Criptomoedas">
                <option value="BTC-USD">Bitcoin (BTC-USD)</option>
                <option value="ETH-USD">Ethereum (ETH-USD)</option>
              </optgroup>
            </select>
          </label>
          <label className="text-sm">Direção
            <select value={side} onChange={e => setSide(e.target.value as "LONG" | "SHORT")} className="mt-1 w-full p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)]">
              <option value="LONG">LONG</option><option value="SHORT">SHORT</option>
            </select>
          </label>
          <label className="text-sm">Quantidade
            <input aria-label="Quantidade" type="number" min="0.00000001" step="any" value={quantity} onChange={e => setQuantity(e.target.value)} className="mt-1 w-full p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)]" required />
          </label>
          <label className="text-sm">Alavancagem (1–100x)
            <input aria-label="Alavancagem" type="number" min="1" max="100" step="0.01" value={leverage} onChange={e => setLeverage(e.target.value)} className="mt-1 w-full p-2 rounded bg-[var(--bg-primary)] border border-[var(--border-primary)]" required />
          </label>
          <button disabled={busy} type="submit" className="self-end p-2 rounded bg-[var(--accent-primary)] text-black font-semibold disabled:opacity-50">Abrir posição</button>
        </form>

        {error && <p role="alert" className="text-red-500">{error}</p>}
        {notice && <p role="status" className="text-green-500">{notice}</p>}

        <section className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] overflow-x-auto">
          <div className="flex justify-between items-center p-4">
            <h2 className="font-semibold">Posições ({positions.filter(p => p.status === "OPEN").length} abertas)</h2>
            <button type="button" onClick={() => void refresh()} className="text-sm underline">Atualizar</button>
          </div>
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-[var(--text-muted)] border-y border-[var(--border-primary)]">
              <tr>{["Ativo", "Direção", "Quantidade", "Entrada", "Alavancagem", "Margem", "Preço atual", "P&L", "Status", "Ação"].map(h => <th key={h} className="px-3 py-3">{h}</th>)}</tr>
            </thead>
            <tbody>
              {positions.map(p => (
                <tr key={p.id} className="border-b border-[var(--border-primary)]">
                  <td className="px-3 py-3 font-medium">{p.symbol}</td>
                  <td className="px-3 py-3">{p.side}</td>
                  <td className="px-3 py-3 font-mono">{p.quantity}</td>
                  <td className="px-3 py-3 font-mono">{usd(p.entryPrice)}</td>
                  <td className="px-3 py-3">{p.leverage}x</td>
                  <td className="px-3 py-3 font-mono">{usd(p.margin)}</td>
                  <td className="px-3 py-3 font-mono">{p.marketPrice === undefined ? "—" : usd(p.marketPrice)}</td>
                  <td className="px-3 py-3 font-mono">{p.status === "OPEN" ? (p.unrealizedPnl === undefined ? "—" : usd(p.unrealizedPnl)) : usd(p.realizedPnl ?? 0)}</td>
                  <td className="px-3 py-3">{p.status}</td>
                  <td className="px-3 py-3">{p.status === "OPEN" && <button disabled={busy} onClick={() => void closePosition(p.id)} className="underline disabled:opacity-50">Encerrar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && positions.length === 0 && <p className="p-6 text-[var(--text-muted)]">Nenhuma posição simulada ainda.</p>}
          {loading && <p className="p-6">Carregando operações…</p>}
        </section>
      </main>
    </div>
  );
}
