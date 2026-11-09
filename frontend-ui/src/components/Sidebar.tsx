"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, TrendingUp, ArrowLeftRight, Wallet, History, Star, Settings, LogOut, CandlestickChart, ChevronDown, ChevronRight, UserRound, Eye, EyeOff, Bot, Menu, Home, X, FolderKanban } from "lucide-react";
import { usePortfolio } from "@/context/PortfolioContext";
import { useAuth } from "@/context/AuthContext";
import { API_HOST } from "@/lib/api";
import QuickSettings from "./QuickSettings";
import { RefreshCw } from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Painel", href: "/dashboard" },
  { icon: TrendingUp, label: "Mercados", href: "/markets" },
  { icon: FolderKanban, label: "Projetos", href: "/projects" },
  { icon: ArrowLeftRight, label: "Negociar", href: "/trade" },
  { icon: Bot, label: "Robôs", href: "/robots" },
  { icon: Wallet, label: "Carteira", href: "/portfolio" },
  { icon: History, label: "Extrato", href: "/balance-history" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, buyingPower, refreshPrices, isLoading } = usePortfolio();
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (refreshing || isLoading) return;
    setRefreshing(true);
    try { await refreshPrices(); } finally { setRefreshing(false); }
  };
  const { logout } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileTradeOpen, setMobileTradeOpen] = useState(false);
  const handleLogout = async () => {
    await logout();
    setAccountOpen(false);
    router.push("/login");
  };

  return (
    <>
    <header className="master-topnav relative z-[100] min-h-[54px] lg:min-h-[66px] border-b border-[var(--border-primary)] bg-[var(--bg-sidebar)]/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[54px] lg:min-h-[66px] w-full max-w-[1440px] flex-nowrap items-center justify-between gap-2 px-3 py-2 lg:flex-wrap lg:gap-x-3 lg:gap-y-2 lg:px-6 lg:py-3">
        <Link href="/dashboard" className="flex min-w-0 shrink items-center gap-1.5 hover:opacity-90 lg:shrink-0 lg:gap-2.5" aria-label="Master Trade — Painel">
          <img src="/logo.png" alt="" width={26} height={26} className="h-6 w-6 shrink-0 rounded-lg lg:h-[26px] lg:w-[26px]" />
          <span className="whitespace-nowrap text-[10px] sm:text-[12px] font-extrabold tracking-[.04em] lg:tracking-[.07em] text-[var(--text-primary)]">
            MASTER <span className="text-[var(--accent-primary)]">TRADE</span>
          </span>
        </Link>
        <div className="hidden h-6 w-px bg-[var(--border-primary)] xl:block" />
        <nav aria-label="Navegação principal" className="order-3 hidden w-full min-w-0 items-center justify-start gap-1 overflow-x-auto lg:flex whitespace-nowrap pb-1 lg:order-none lg:w-auto lg:flex-1 lg:pb-0">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-[12px] font-medium transition-colors ${active ? "bg-[var(--bg-muted)] text-[var(--accent-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"}`}>
                <Icon size={15} strokeWidth={1.8} />{label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1 lg:gap-1.5">
          <div className="flex min-w-0 items-center gap-1 rounded-lg border border-[var(--border-primary)] px-1.5 py-1 lg:gap-1.5 lg:px-2.5 lg:py-1.5" aria-label="Saldo disponível em USD">
            <Wallet size={15} className="hidden shrink-0 text-[var(--text-muted)] lg:block" />
            <span className="hidden text-[10px] text-[var(--text-muted)] xl:inline">Saldo</span>
            <span className="whitespace-nowrap font-mono text-[10px] sm:text-[12px] font-semibold text-[var(--text-primary)] tabular-nums">
              {balanceVisible ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(buyingPower) : "••••••"}
            </span>
            <button type="button" onClick={() => setBalanceVisible(v => !v)}
              aria-label={balanceVisible ? "Ocultar saldo" : "Mostrar saldo"}
              title={balanceVisible ? "Ocultar saldo" : "Mostrar saldo"}
              className="rounded p-0.5 lg:p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              {balanceVisible ? <Eye size={15} /> : <EyeOff size={15} />}
            </button>
          </div>
          <button type="button" onClick={() => void handleRefresh()} disabled={refreshing || isLoading} aria-label="Atualizar cotações" title="Atualizar cotações" className="hidden lg:block rounded-lg border border-[var(--border-primary)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"><RefreshCw size={15} className={refreshing || isLoading ? "animate-spin" : ""} /></button>
          <div className="relative">
            <button type="button" onClick={() => setAccountOpen(v => !v)} aria-expanded={accountOpen}
              className="flex items-center gap-1 rounded-lg border border-[var(--border-primary)] p-1 text-[var(--text-primary)] hover:bg-[var(--bg-hover)] lg:gap-2 lg:px-2 lg:py-1.5">
              {user.avatarUrl ? <img src={user.avatarUrl.startsWith("http") ? user.avatarUrl : `${API_HOST}${user.avatarUrl}`} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-primary)] text-xs font-bold text-white">{user.initials || <UserRound size={14} />}</span>}
              <span className="hidden max-w-[105px] truncate text-xs font-semibold sm:block">{user.name}</span>
              <ChevronDown size={13} className="hidden text-[var(--text-muted)] lg:block" />
            </button>
            {accountOpen && <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-2 shadow-2xl">
              <Link href="/account" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"><Settings size={15} /> Minha conta</Link>
              <div className="my-2 border-t border-[var(--border-primary)] pt-2">
                <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">Aparência e moeda</p>
                <QuickSettings />
              </div>
              <button type="button" onClick={() => void handleLogout()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--accent-red)] hover:bg-[var(--bg-hover)]"><LogOut size={15} /> Sair</button>
            </div>}
          </div>
        </div>
      </div>

    </header>
    <nav aria-label="Navegação mobile" className="master-mobile-nav fixed inset-x-0 bottom-0 z-[110] grid grid-cols-5 items-end border-t border-[var(--border-primary)] bg-[var(--bg-sidebar)]/95 px-1 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,.12)] backdrop-blur-xl lg:hidden">
      {[
        { href: "/dashboard", label: "Início", Icon: Home },
        { href: "/markets", label: "Mercados", Icon: TrendingUp },
        { href: "/trade", label: "Negociar", Icon: ArrowLeftRight },
        { href: "/portfolio", label: "Carteira", Icon: Wallet },
      ].slice(0, 2).map(({ href, label, Icon }) => (
        <Link key={href} href={href} aria-current={pathname.startsWith(href) ? "page" : undefined}
          className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-semibold ${pathname.startsWith(href) ? "text-[var(--accent-primary)]" : "text-[var(--text-secondary)]"}`}>
          <Icon size={21}/><span>{label}</span>
        </Link>
      ))}
      <button type="button" onClick={() => { setMobileMenuOpen(false); setMobileTradeOpen(open => !open); }}
        aria-expanded={mobileTradeOpen} aria-controls="master-mobile-trade"
        className="relative -mt-4 flex min-w-0 flex-col items-center gap-1 rounded-xl bg-[var(--accent-primary)] px-1 py-3 text-[10px] font-bold text-white shadow-lg shadow-black/15">
        <ArrowLeftRight size={22}/><span>Negociar</span>
      </button>
      <Link href="/portfolio" aria-current={pathname.startsWith("/portfolio") ? "page" : undefined}
        className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-semibold ${pathname.startsWith("/portfolio") ? "text-[var(--accent-primary)]" : "text-[var(--text-secondary)]"}`}>
        <Wallet size={21}/><span>Carteira</span>
      </Link>
      <button type="button" onClick={() => { setMobileTradeOpen(false); setMobileMenuOpen(open => !open); }} aria-expanded={mobileMenuOpen} aria-controls="master-mobile-menu"
        className={`flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-2 text-[10px] font-semibold ${mobileMenuOpen ? "text-[var(--accent-primary)]" : "text-[var(--text-secondary)]"}`}>
        <Menu size={21}/><span>Menu</span>
      </button>
    </nav>
    {mobileTradeOpen && (
      <div className="fixed inset-0 z-[105] bg-black/50 lg:hidden" onClick={() => setMobileTradeOpen(false)}>
        <section id="master-mobile-trade" aria-label="Escolher modo de negociação" onClick={event => event.stopPropagation()}
          className="absolute inset-x-3 bottom-[calc(82px+env(safe-area-inset-bottom))] rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between px-2 py-1">
            <strong className="text-sm text-[var(--text-primary)]">Como deseja negociar?</strong>
            <button type="button" onClick={() => setMobileTradeOpen(false)} aria-label="Fechar opções de negociação" className="rounded-lg p-2 text-[var(--text-secondary)]"><X size={18}/></button>
          </div>
          <Link href="/trade" onClick={() => setMobileTradeOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
            <ArrowLeftRight size={21} className="text-[var(--accent-primary)]"/>
            <span className="flex-1"><strong className="block text-sm">Negociar manual</strong><span className="text-xs text-[var(--text-muted)]">Abra e gerencie suas próprias operações</span></span>
            <ChevronRight size={17} className="text-[var(--text-muted)]"/>
          </Link>
          <Link href="/robots" onClick={() => setMobileTradeOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-3 text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
            <Bot size={21} className="text-[var(--accent-primary)]"/>
            <span className="flex-1"><strong className="block text-sm">Negociar com robô</strong><span className="text-xs text-[var(--text-muted)]">Acesse a área de robôs de negociação</span></span>
            <ChevronRight size={17} className="text-[var(--text-muted)]"/>
          </Link>
        </section>
      </div>
    )}
    {mobileMenuOpen && (
      <div className="fixed inset-0 z-[105] bg-black/50 lg:hidden" onClick={() => setMobileMenuOpen(false)}>
        <section id="master-mobile-menu" aria-label="Mais opções" onClick={event => event.stopPropagation()}
          className="absolute inset-x-3 bottom-[calc(82px+env(safe-area-inset-bottom))] max-h-[65dvh] overflow-y-auto rounded-2xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-3 shadow-2xl">
          <div className="mb-2 flex items-center justify-between px-2"><strong className="text-sm">Menu</strong><button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu" className="rounded-lg p-2"><X size={18}/></button></div>
          {navItems.filter(item => !["/dashboard","/markets","/trade","/portfolio"].includes(item.href)).map(({href,label,icon:Icon}) => (
            <Link key={href} href={href} onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"><Icon size={18}/>{label}</Link>
          ))}
          <Link href="/account" onClick={() => setMobileMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"><Settings size={18}/>Minha conta</Link>
          <button type="button" onClick={() => { setMobileMenuOpen(false); void handleLogout(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-[var(--accent-red)]"><LogOut size={18}/>Sair</button>
        </section>
      </div>
    )}
    </>
  );
}
