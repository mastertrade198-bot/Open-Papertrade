"use client";

import { useState } from "react";
import { ArrowDownToLine, Wallet, X } from "lucide-react";

type Method = "PIX" | "USDT";

export default function WalletActions({ balance }: { balance: number }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("PIX");
  const [destination, setDestination] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [reference, setReference] = useState("");

  const numericAmount = Number(amount);
  const validAmount = /^\d+(?:\.\d{1,2})?$/.test(amount) && Number.isFinite(numericAmount) && numericAmount > 0 && numericAmount <= balance;
  const validDestination = destination.trim().length >= 3 && destination.trim().length <= 255;
  const reset = () => { setOpen(false); setAmount(""); setDestination(""); setError(""); setReference(""); setMethod("PIX"); };

  async function requestWithdrawal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validAmount || !validDestination) { setError("Informe um valor válido dentro do saldo disponível e os dados de destino."); return; }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/users/withdrawals/", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amount, method, destination: destination.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || data.detail || "Não foi possível registrar a solicitação. Tente novamente.");
      setReference(String(data.id || "registrada"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar a solicitação.");
    } finally { setPending(false); }
  }

  return <section className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 sm:p-6" aria-label="Saldo e movimentações">
    <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">
      <div><p className="text-xs font-medium uppercase tracking-wider text-[var(--text-muted)]">Saldo disponível</p><p className="mt-2 text-3xl font-semibold tabular-nums text-[var(--text-primary)]">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Math.max(0, balance))}</p><p className="mt-2 text-xs text-[var(--text-muted)]">Saldo da conta de simulação</p></div>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled title="Depósitos temporariamente indisponíveis" className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-[var(--border-primary)] px-5 py-3 text-sm font-semibold text-[var(--text-muted)] opacity-60"><Wallet size={16}/> Depositar</button>
        <button type="button" disabled={balance <= 0} onClick={() => { setError(""); setReference(""); setOpen(true); }} className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent-primary)] px-5 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"><ArrowDownToLine size={16}/> Sacar</button>
      </div>
    </div>
    {open && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/65 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) reset(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="withdraw-title" className="w-full max-w-md rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4"><div><h2 id="withdraw-title" className="text-xl font-semibold text-[var(--text-primary)]">Solicitar saque</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Escolha o destino e informe o valor.</p></div><button type="button" aria-label="Fechar" onClick={reset} className="rounded-lg p-2 text-[var(--text-muted)] hover:bg-[var(--bg-hover)]"><X size={19}/></button></div>
        {reference ? <div role="status" className="mt-7 space-y-4"><p className="text-sm leading-7 text-[var(--text-primary)]">Solicitação recebida para análise. Nenhuma transferência foi executada automaticamente.</p><p className="text-xs text-[var(--text-muted)]">Protocolo: {reference}</p><button type="button" onClick={reset} className="w-full rounded-lg bg-[var(--accent-primary)] py-3 text-sm font-semibold text-white">Concluir</button></div> : <form onSubmit={requestWithdrawal} className="mt-7 space-y-5">
          <div><label htmlFor="withdraw-amount" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Valor para saque (USD)</label><input id="withdraw-amount" type="number" inputMode="decimal" min="0.01" max={balance} step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card-inner)] px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"/><p className="mt-2 text-xs text-[var(--text-muted)]">Disponível: {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(balance)}</p></div>
          <fieldset><legend className="mb-2 text-sm font-medium text-[var(--text-primary)]">Forma de saque</legend><div className="grid grid-cols-2 gap-2">{(["PIX","USDT"] as Method[]).map(option=><button key={option} type="button" aria-pressed={method===option} onClick={()=>{setMethod(option);setDestination("");setError("");}} className={`rounded-lg border px-4 py-3 text-sm font-semibold ${method===option?"border-[var(--accent-primary)] bg-[var(--bg-hover)] text-[var(--text-primary)]":"border-[var(--border-primary)] text-[var(--text-muted)]"}`}>{option}</button>)}</div></fieldset>
          {method === "PIX" ? <><div role="note" className="rounded-lg border border-[var(--border-primary)] bg-[var(--bg-muted)] p-3 text-xs leading-6 text-[var(--text-secondary)]"><strong>Atenção:</strong> a conta bancária vinculada à chave PIX deve pertencer ao mesmo CPF cadastrado na Master Trade.</div><div><label htmlFor="withdraw-destination" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Chave PIX</label><input id="withdraw-destination" required maxLength={255} autoComplete="off" value={destination} onChange={e=>setDestination(e.target.value)} placeholder="CPF, e-mail, telefone ou chave aleatória" className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card-inner)] px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"/></div></> : <div><label htmlFor="withdraw-destination" className="mb-2 block text-sm font-medium text-[var(--text-primary)]">Endereço da carteira USDT</label><input id="withdraw-destination" required maxLength={255} autoComplete="off" value={destination} onChange={e=>setDestination(e.target.value)} placeholder="Cole o endereço da carteira" className="w-full rounded-lg border border-[var(--border-primary)] bg-[var(--bg-card-inner)] px-4 py-3 text-[var(--text-primary)] outline-none focus:border-[var(--accent-primary)]"/><p className="mt-2 text-xs text-[var(--text-muted)]">A rede de destino deverá ser confirmada antes de qualquer transferência.</p></div>}
          {error && <p role="alert" className="text-sm text-[var(--accent-red)]">{error}</p>}
          <button type="submit" disabled={!validAmount || !validDestination || pending} className="w-full rounded-lg bg-[var(--accent-primary)] px-4 py-3.5 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">{pending?"Enviando...":"Solicitar saque"}</button>
          <p className="text-xs leading-5 text-[var(--text-muted)]">O envio registra uma solicitação para análise; não executa pagamentos automaticamente.</p>
        </form>}
      </div>
    </div>}
  </section>;
}
