import { Image as ImageIcon } from "lucide-react";
import type { CreativeMetrics } from "@/types";
import { formatCurrency, formatNumber } from "@/lib/utils";

/**
 * Thumbnail pequena de propósito: as imagens disponíveis são miniaturas de
 * baixa resolução — em tamanho reduzido ficam nítidas no PDF.
 */
function creativeImageUrl(row: CreativeMetrics): string | null {
  if (row.image_url) return row.image_url;
  if (row.thumbnail_storage_url) return row.thumbnail_storage_url;
  return row.thumbnail_url;
}

interface ReportCreativesGridProps {
  rows: CreativeMetrics[];
}

/** Versão compacta do grid de criativos para o relatório/PDF (sem interação). */
export default function ReportCreativesGrid({ rows }: ReportCreativesGridProps) {
  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-card border border-border p-5 text-sm text-muted">
        Nenhum criativo com dados no período.
      </p>
    );
  }

  const sorted = [...rows].sort((a, b) => b.gasto - a.gasto);

  return (
    <div className="grid grid-cols-2 gap-3">
      {sorted.map((row) => {
        const thumbnail = creativeImageUrl(row);
        const hasLeads = row.leads > 0;
        return (
          <div
            key={`${row.anuncio}-${row.ad_id}`}
            className="rounded-xl bg-card border border-border p-3 flex gap-3"
          >
            {thumbnail ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnail}
                alt={row.anuncio}
                className="w-16 h-16 rounded-lg object-cover shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-lg bg-border/40 flex items-center justify-center text-muted shrink-0">
                <ImageIcon size={20} />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate" title={row.anuncio}>
                {row.anuncio}
              </p>
              <div className="mt-1.5 grid grid-cols-3 gap-x-3 text-xs">
                <div>
                  <p className="text-muted">Gasto</p>
                  <p className="font-medium">{formatCurrency(row.gasto)}</p>
                </div>
                <div>
                  <p className="text-muted">{hasLeads ? "Leads" : "Cliques"}</p>
                  <p className="font-medium">
                    {formatNumber(hasLeads ? row.leads : row.cliques)}
                  </p>
                </div>
                <div>
                  <p className="text-muted">{hasLeads ? "CPL" : "Mensagens"}</p>
                  <p className="font-medium">
                    {hasLeads
                      ? row.cpl !== null
                        ? formatCurrency(row.cpl)
                        : "—"
                      : formatNumber(row.mensagens)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
