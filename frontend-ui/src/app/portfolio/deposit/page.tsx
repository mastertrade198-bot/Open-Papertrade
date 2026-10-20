"use client";

import Link from "next/link";
import { ArrowLeft, ShieldAlert, Wallet, Network, LockKeyhole, Landmark } from "lucide-react";
import Sidebar from "@/components/Sidebar";

export default function PolygonDepositPage() {
  return (
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <Sidebar />
      <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 lg:px-8">
        <Link href="/portfolio" className="inline-flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft size={16} /> Voltar à Carteira
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Depositar USDT</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Rede Polygon PoS · Depósitos reais</p>
        </div>
        <div role="status" className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-500">
          <ShieldAlert size={22} className="shrink-0" />
          <div>
            <p className="font-semibold">Depósitos ainda não habilitados</p>
            <p className="mt-1 text-sm">A integração está em preparação. Nenhum endereço de depósito foi emitido e nenhum saldo real será creditado até a ativação segura do serviço de custódia e da conciliação blockchain. Não envie criptomoedas para endereços de teste.</p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5">
            <Network className="mb-3 text-[var(--accent-primary)]" size={22} />
            <p className="text-xs text-[var(--text-muted)]">Rede</p>
            <p className="mt-1 font-semibold text-[var(--text-primary)]">Polygon PoS</p>
          </div>
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5">
            <Wallet className="mb-3 text-[var(--accent-primary)]" size={22} />
            <p className="text-xs text-[var(--text-muted)]">Ativo</p>
            <p className="mt-1 font-semibold text-[var(--text-primary)]">USDT</p>
          </div>
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5">
            <LockKeyhole className="mb-3 text-[var(--accent-primary)]" size={22} />
            <p className="text-xs text-[var(--text-muted)]">Endereço individual</p>
            <p className="mt-1 font-semibold text-[var(--text-primary)]">Aguardando configuração</p>
          </div>
        </div>
        <section className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-6">
          <div className="flex items-center gap-2"><Landmark size={19} className="text-[var(--accent-primary)]" /><h2 className="font-semibold text-[var(--text-primary)]">Carteira-mãe de custódia</h2></div>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Destino provisório registrado para a integração. O valor abaixo é um marcador, não um endereço blockchain válido.</p>
          <code className="mt-3 block break-all rounded-lg bg-[var(--bg-primary)] px-3 py-2 text-sm text-[var(--text-primary)]">0xtestealterar</code>
          <p className="mt-2 text-xs text-amber-500">Configuração pendente: transferências automáticas bloqueadas até validar e substituir o endereço.</p>
        </section>
        <section className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-6">
          <h2 className="font-semibold text-[var(--text-primary)]">Seu endereço de depósito</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">O endereço individual aparecerá aqui somente quando a integração de custódia estiver ativa e verificada.</p>
          <div className="mt-4 rounded-lg border border-dashed border-[var(--border-primary)] p-5 text-center text-sm text-[var(--text-muted)]">Endereço indisponível · depósitos bloqueados</div>
        </section>
        <p className="text-xs text-[var(--text-muted)]">Depósitos reais exigem verificação do contrato USDT, confirmação on-chain, registro de auditoria, gestão segura de chaves e política de custódia. Valores exibidos nas telas legadas de negociação não representam automaticamente fundos depositados.</p>
      </main>
    </div>
  );
}
