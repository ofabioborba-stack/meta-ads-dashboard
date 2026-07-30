"use client";

import { Printer } from "lucide-react";

/** Opção secundária: abre o diálogo de impressão do navegador. */
export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg border border-border text-muted text-sm px-3 py-2 hover:text-white transition-colors"
    >
      <Printer size={15} />
      Imprimir
    </button>
  );
}
