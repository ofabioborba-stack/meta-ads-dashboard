"use client";

import { useState, type ReactNode } from "react";

const BASE_TABS = [
  { id: "resumo",    label: "Resumo"    },
  { id: "campanhas", label: "Campanhas" },
  { id: "criativos", label: "Criativos" },
  { id: "leads",     label: "Leads"     },
] as const;

type BaseTabId = (typeof BASE_TABS)[number]["id"];
type TabId = BaseTabId | "organico";

interface ClientTabsProps {
  resumo: ReactNode;
  campanhas: ReactNode;
  criativos: ReactNode;
  leads: ReactNode;
  organico?: ReactNode;
}

export default function ClientTabs({ resumo, campanhas, criativos, leads, organico }: ClientTabsProps) {
  const [active, setActive] = useState<TabId>("resumo");

  const tabs = [
    ...BASE_TABS,
    ...(organico !== undefined ? [{ id: "organico" as const, label: "Orgânico" }] : []),
  ];

  const content: Record<TabId, ReactNode> = { resumo, campanhas, criativos, leads, organico };

  return (
    <div>
      <div className="flex gap-1 border-b border-border mb-5">
        {tabs.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActive(id)}
            className={`px-4 py-2.5 text-sm border-b-2 -mb-px transition-colors ${
              active === id
                ? "border-accent text-white font-medium"
                : "border-transparent text-muted hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {content[active]}
    </div>
  );
}
