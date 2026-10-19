"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, TrendingUp, Wallet, Repeat, History, Star, Settings, LogOut, CandlestickChart, Menu, X, ChevronDown, UserRound } from "lucide-react";
import { usePortfolio } from "@/context/PortfolioContext";
import { useAuth } from "@/context/AuthContext";
import { API_HOST } from "@/lib/api";

const navItems = [
  { icon: LayoutDashboard, label: "Painel", href: "/" },
  { icon: TrendingUp, label: "Mercados", href: "/markets" },
  { icon: CandlestickChart, label: "Gráficos", href: "/chart" },
  { icon: Repeat, label: "Negociar", href: "/trade" },
  { icon: Wallet, label: "Carteira", href: "/portfolio" },
  { icon: Star, label: "Favoritos", href: "/watchlist" },
  { icon: History, label: "Extrato", href: "/balance-history" },
  { icon: Settings, label: "Conta", href: "/account" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = usePortfolio();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const handleLogout = async () => {
    await logout();
    setAccountOpen(false);
    router.push("/login");
  };

  return (
    <header className="master-topnav relative z-[100] h-[66px] border-b border-[var(--border-primary)] bg-[var(--bg-sidebar)]/95 backdrop-blur-xl">
      <div className="mx-auto flex h-full w-full max-w-[1920px] items-center gap-4 px-4 lg:px-7">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 hover:opacity-90" aria-label="Master Trade — Painel">
          <img src="/logo.png" alt="" width={32} height={32} className="rounded-lg" />
          <span className="whitespace-nowrap text-[15px] font-extrabold tracking-[.12em] text-[var(--text-primary)]">
            MASTER <span className="text-[var(--accent-primary)]">TRADE</span>
          </span>
        </Link>
        <div className="hidden h-6 w-px bg-[var(--border-primary)] lg:block" />
        <nav aria-label="Navegação principal" className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto lg:flex">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-semibold transition-colors ${active ? "bg-[var(--bg-hover)] text-[var(--accent-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] hover:text-[var(--text-primary)]"}`}>
                <Icon size={15} strokeWidth={1.8} />{label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <span className="hidden rounded-md border border-[var(--border-primary)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary)] sm:inline-flex">Simulação · USD</span>
          <div className="relative">
            <button type="button" onClick={() => setAccountOpen(v => !v)} aria-expanded={accountOpen}
              className="flex items-center gap-2 rounded-lg border border-[var(--border-primary)] px-2 py-1.5 text-[var(--text-primary)] hover:bg-[var(--bg-hover)]">
              {user.avatarUrl ? <img src={user.avatarUrl.startsWith("http") ? user.avatarUrl : `${API_HOST}${user.avatarUrl}`} alt="" className="h-7 w-7 rounded-full object-cover" /> : <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-primary)] text-xs font-bold text-white">{user.initials || <UserRound size={14} />}</span>}
              <span className="hidden max-w-[105px] truncate text-xs font-semibold sm:block">{user.name}</span>
              <ChevronDown size={13} className="text-[var(--text-muted)]" />
            </button>
            {accountOpen && <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-1 shadow-2xl">
              <Link href="/account" onClick={() => setAccountOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm hover:bg-[var(--bg-hover)]"><Settings size={15} /> Minha conta</Link>
              <button type="button" onClick={() => void handleLogout()} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--accent-red)] hover:bg-[var(--bg-hover)]"><LogOut size={15} /> Sair</button>
            </div>}
          </div>
          <button type="button" aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen(v => !v)}
            className="rounded-lg border border-[var(--border-primary)] p-2 text-[var(--text-primary)] lg:hidden">
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {menuOpen && <nav aria-label="Navegação móvel" className="absolute left-0 right-0 top-full max-h-[calc(100dvh-66px)] overflow-y-auto border-b border-[var(--border-primary)] bg-[var(--bg-sidebar)] p-3 shadow-2xl lg:hidden">
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
          {navItems.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)}
            className={`flex items-center gap-2 rounded-lg px-3 py-3 text-sm ${pathname === href ? "bg-[var(--bg-hover)] text-[var(--accent-primary)]" : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"}`}><Icon size={17}/>{label}</Link>)}
        </div>
      </nav>}
    </header>
  );
}
