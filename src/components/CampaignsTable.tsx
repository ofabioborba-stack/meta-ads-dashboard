import type { CampaignMetrics } from "@/types";
import { formatCurrency, formatNumber } from "@/lib/utils";

interface CampaignsTableProps {
  rows: CampaignMetrics[];
}

export default function CampaignsTable({ rows }: CampaignsTableProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-card border border-border p-8 text-center text-muted">
        Sem campanhas no período selecionado.
      </div>
    );
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.alcance += r.alcance;
      acc.cliques += r.cliques;
      acc.leads += r.leads;
      acc.mensagens += r.mensagens;
      acc.visitasPerfil += r.profile_visits;
      acc.custo += r.custo;
      return acc;
    },
    { alcance: 0, cliques: 0, leads: 0, mensagens: 0, visitasPerfil: 0, custo: 0 }
  );
  const totalCpl = totals.leads > 0 ? totals.custo / totals.leads : null;

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="text-left font-medium px-5 py-3">Campanha</th>
              <th className="text-right font-medium px-4 py-3">Alcance</th>
              <th className="text-right font-medium px-4 py-3">Cliques</th>
              <th className="text-right font-medium px-4 py-3">Leads</th>
              <th className="text-right font-medium px-4 py-3">Mensagens</th>
              <th className="text-right font-medium px-4 py-3">Visitas Perfil</th>
              <th className="text-right font-medium px-4 py-3">Gasto</th>
              <th className="text-right font-medium px-5 py-3">CPL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.campanha} className="border-b border-border/50">
                <td className="px-5 py-3 max-w-xs truncate" title={row.campanha}>
                  {row.campanha}
                </td>
                <td className="text-right px-4 py-3">{formatNumber(row.alcance)}</td>
                <td className="text-right px-4 py-3">{formatNumber(row.cliques)}</td>
                <td className="text-right px-4 py-3">{formatNumber(row.leads)}</td>
                <td className="text-right px-4 py-3">{formatNumber(row.mensagens)}</td>
                <td className="text-right px-4 py-3">{formatNumber(row.profile_visits)}</td>
                <td className="text-right px-4 py-3">{formatCurrency(row.custo)}</td>
                <td className="text-right px-5 py-3">
                  {row.cpl !== null ? formatCurrency(row.cpl) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="px-5 py-3">Total</td>
              <td className="text-right px-4 py-3">{formatNumber(totals.alcance)}</td>
              <td className="text-right px-4 py-3">{formatNumber(totals.cliques)}</td>
              <td className="text-right px-4 py-3">{formatNumber(totals.leads)}</td>
              <td className="text-right px-4 py-3">{formatNumber(totals.mensagens)}</td>
              <td className="text-right px-4 py-3">{formatNumber(totals.visitasPerfil)}</td>
              <td className="text-right px-4 py-3">{formatCurrency(totals.custo)}</td>
              <td className="text-right px-5 py-3">
                {totalCpl !== null ? formatCurrency(totalCpl) : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
