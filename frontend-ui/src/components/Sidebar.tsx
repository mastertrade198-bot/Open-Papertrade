"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, TrendingUp, Wallet, History, Star, Settings, LogOut, CandlestickChart, ChevronDown, UserRound } from "lucide-react";
import { usePortfolio } from "@/context/PortfolioContext";
import { useAuth } from "@/context/AuthContext";
import { API_HOST } from "@/lib/api";
import QuickSettings from "./QuickSettings";
import { RefreshCw } from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Painel", href: "/" },
  { icon: TrendingUp, label: "Mercados", href: "/markets" },
  { icon: CandlestickChart, label: "Gráficos", href: "/chart" },
  { icon: Wallet, label: "Carteira", href: "/portfolio" },
  { icon: Star, label: "Favoritos", href: "/watchlist" },
  { icon: History, label: "Extrato", href: "/balance-history" },
  { icon: Settings, label: "Conta", href: "/account" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, refreshPrices, isLoading } = usePortfolio();
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (refreshing || isLoading) return;
    setRefreshing(true);
    try { await refreshPrices(); } finally { setRefreshing(false); }
  };
  const { logout } = useAuth();
  const [accountOpen, setAccountOpen] = useState(false);
  const handleLogout = async () => {
    await logout();
    setAccountOpen(false);
    router.push("/login");
  };

  return (
    <header className="master-topnav relative z-[100] min-h-[66px] border-b border-[var(--border-primary)] bg-[var(--bg-sidebar)]/95 backdrop-blur-xl">
      <div className="mx-auto flex min-h-[66px] w-full max-w-[1920px] flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 lg:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 hover:opacity-90" aria-label="Master Trade — Painel">
          <img src="/logo.png" alt="" width={26} height={26} className="rounded-lg" />
          <span className="whitespace-nowrap text-[12px] font-extrabold tracking-[.07em] text-[var(--text-primary)]">
            MASTER <span className="text-[var(--accent-primary)]">TRADE</span>
          </span>
        </Link>
        <div className="hidden h-6 w-px bg-[var(--border-primary)] xl:block" />
        <nav aria-label="Navegação principal" className="order-3 flex w-full min-w-0 flex-wrap items-center justify-center gap-1 lg:order-none lg:w-auto lg:flex-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-semibold transition-colors ${active ? "bg-[var(--bg-hover)] text-[var(--accent-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"}`}>
                <Icon size={15} strokeWidth={1.8} />{label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-1.5">
          <button type="button" onClick={() => void handleRefresh()} disabled={refreshing || isLoading} aria-label="Atualizar cotações" title="Atualizar cotações" className="rounded-lg border border-[var(--border-primary)] p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-50"><RefreshCw size={15} className={refreshing || isLoading ? "animate-spin" : ""} /></button>
          <div className="relative">
            <button type="button" onClick={() => setAccountOpen(v => !v)} aria-expanded={accountOpen}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-primary)] px-2 py-1.5 text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
              {user.avatarUrl ? <img src={user.avatarUrl.startsWith("http") ? user.avatarUrl : `${API_HOST}${user.avatarUrl}`} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-primary)] text-xs font-bold text-white">{user.initials || <UserRound size={14} />}</span>}
              <span className="hidden max-w-[105px] truncate text-xs font-semibold sm:block">{user.name}</span>
              <ChevronDown size={13} className="text-[var(--text-muted)]" />
            </button>
            {accountOpen && <div className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-2 shadow-2xl">
              <Link href="/account" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-[var(--bg-hover)]"><Settings size={15} /> Minha conta</Link>
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
  );
}
