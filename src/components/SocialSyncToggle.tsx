"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setSocialAccountActive } from "@/app/actions/clients";

function IgIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
}

interface Props {
  accountId: string;
  accountName: string | null;
  initialActive: boolean;
}

export default function SocialSyncToggle({ accountId, accountName, initialActive }: Props) {
  const [active, setActive] = useState(initialActive);
  const [toggling, setToggling] = useState(false);
  const router = useRouter();

  async function handleToggle() {
    setToggling(true);
    try {
      await setSocialAccountActive(accountId, !active);
      setActive(!active);
      router.refresh();
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-card border border-border px-4 py-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <IgIcon size={14} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{accountName ?? "Instagram"}</p>
          <p className="text-xs text-muted">
            {active
              ? "Sincronizando diariamente às 9h15"
              : "Sync desativado — nenhum dado será coletado"}
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={toggling}
        onClick={handleToggle}
        aria-label={active ? "Desativar sync" : "Ativar sync"}
        className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${
          active ? "bg-accent" : "bg-border"
        } ${toggling ? "opacity-50" : ""}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
            active ? "translate-x-5" : ""
          }`}
        />
      </button>
    </div>
  );
}
