"use client";

import { ReactNode } from "react";
import ConnectionStatus from "./ConnectionStatus";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  primaryButtonText?: string;
  primaryButtonIcon?: "plus" | "download";
  onPrimaryClick?: () => void;
  extraActions?: ReactNode;
}

export default function PageHeader({
  title,
  subtitle,
  extraActions,
}: PageHeaderProps) {

  return (
    <>
      <header className="flex items-start justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <h1 className="font-primary text-2xl font-semibold tracking-normal text-[var(--text-primary)]">
              {title}
            </h1>
            <ConnectionStatus />
          </div>
          <p className="text-sm text-[var(--text-muted)]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-3">
          {extraActions}

        </div>
      </header>

    </>
  );
}
