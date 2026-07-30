import Link from "next/link";
import { ExternalLink, Image as ImageIcon } from "lucide-react";
import type { CreativeMetrics, CreativeSort } from "@/types";
import { formatCurrency, formatNumber } from "@/lib/utils";
import CreativeLightbox from "./CreativeLightbox";

const SORT_OPTIONS: { key: CreativeSort; label: string }[] = [
  { key: "gasto", label: "Gasto" },
  { key: "cliques", label: "Cliques" },
  { key: "leads", label: "Leads" },
  { key: "cpl", label: "CPL" },
];

interface CreativesGridProps {
  rows: CreativeMetrics[];
  sort: CreativeSort;
  /** Query string do período atual (ex.: "period=7d" ou "period=custom&start=...&end=..."). */
  periodQuery: string;
  basePath: string;
}

function sortRows(rows: CreativeMetrics[], sort: CreativeSort): CreativeMetrics[] {
  const sorted = [...rows];
  switch (sort) {
    case "cliques":
      return sorted.sort((a, b) => b.cliques - a.cliques);
    case "leads":
      return sorted.sort((a, b) => b.leads - a.leads);
    case "cpl":
      // CPL crescente (mais barato primeiro), sem leads por último
      return sorted.sort(
        (a, b) => (a.cpl ?? Number.POSITIVE_INFINITY) - (b.cpl ?? Number.POSITIVE_INFINITY)
      );
    case "gasto":
      return sorted.sort((a, b) => b.gasto - a.gasto);
  }
}

export default function CreativesGrid({
  rows,
  sort,
  periodQuery,
  basePath,
}: CreativesGridProps) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl bg-card border border-border p-12 flex flex-col items-center gap-3 text-muted">
        <ImageIcon size={48} />
        <p>Nenhum criativo encontrado neste período</p>
      </div>
    );
  }

  const sorted = sortRows(rows, sort);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">Ordenar por</span>
        <div className="inline-flex rounded-lg bg-card border border-border p-1 gap-1">
          {SORT_OPTIONS.map(({ key, label }) => (
            <Link
              key={key}
              href={`${basePath}?${periodQuery}&sort=${key}`}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                sort === key
                  ? "bg-accent text-white font-medium"
                  : "text-muted hover:text-white"
              }`}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sorted.map((row) => (
          <CreativeCard key={`${row.anuncio}-${row.ad_id}`} row={row} />
        ))}
      </div>
    </div>
  );
}

/**
 * Prioridade: image_url (alta resolução) > Storage (permanente) > thumbnail_url (CDN fresh).
 * NÃO modificamos a URL do fbcdn — ela já vem assinada pela Meta API com o tamanho correto.
 */
function creativeImageUrl(row: CreativeMetrics): string | null {
  if (row.image_url) return row.image_url;
  if (row.thumbnail_storage_url) return row.thumbnail_storage_url;
  return row.thumbnail_url ?? null;
}

/**
 * Quando thumbnail_storage_url é primária mas pode falhar (arquivo não existe no Storage),
 * a thumbnail_url do CDN é o fallback — renovada diariamente pelo n8n.
 */
function creativeFallbackUrl(row: CreativeMetrics): string | null {
  if (!row.image_url && row.thumbnail_storage_url && row.thumbnail_url) {
    return row.thumbnail_url;
  }
  return null;
}

/** Anúncios de vídeo têm thumbnail do CDN t15.5256 e não têm image_url. */
function isVideoAd(row: CreativeMetrics): boolean {
  if (row.image_url) return false;
  return !!(row.thumbnail_url?.includes("t15.5256") || row.thumbnail_url?.includes("t13/"));
}

function CreativeCard({ row }: { row: CreativeMetrics }) {
  const thumbnail = creativeImageUrl(row);
  const thumbnailFallback = creativeFallbackUrl(row);
  const isVideo = isVideoAd(row);
  const hasLeads = row.leads > 0;

  const metrics = [
    { label: "Cliques", value: formatNumber(row.cliques) },
    hasLeads
      ? { label: "Leads", value: formatNumber(row.leads) }
      : { label: "Mensagens", value: formatNumber(row.mensagens) },
    { label: "Gasto Total", value: formatCurrency(row.gasto) },
    hasLeads
      ? { label: "CPL", value: row.cpl !== null ? formatCurrency(row.cpl) : "—" }
      : {
          label: "Custo/Mensagem",
          value: row.custo_mensagem !== null ? formatCurrency(row.custo_mensagem) : "—",
        },
  ];

  return (
    <div className="rounded-xl bg-card border border-white/5 hover:border-white/10 hover:shadow-lg transition-all overflow-hidden flex flex-col">
      {thumbnail ? (
        <CreativeLightbox src={thumbnail} fallback={thumbnailFallback} alt={row.anuncio} isVideo={isVideo} videoLink={row.link_anuncio} />
      ) : (
        <div className="w-full aspect-square rounded-t-xl bg-border/40 flex items-center justify-center text-muted">
          <ImageIcon size={40} />
        </div>
      )}

      <div className="p-4 flex flex-col gap-3 flex-1">
        <div>
          <h4 className="font-medium leading-snug line-clamp-2" title={row.anuncio}>
            {row.anuncio}
          </h4>
          {row.campanha && (
            <p className="text-xs text-muted truncate mt-1" title={row.campanha}>
              {row.campanha}
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {metrics.map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-muted">{label}</p>
              <p className="font-medium">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-auto pt-1">
          {row.link_anuncio ? (
            <a
              href={row.link_anuncio}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm rounded-lg border border-border px-3 py-1.5 text-muted hover:text-white hover:border-accent/40 transition-colors"
            >
              <ExternalLink size={14} />
              Ver anúncio
            </a>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm rounded-lg border border-border px-3 py-1.5 text-muted opacity-50 cursor-not-allowed">
              <ExternalLink size={14} />
              Ver anúncio
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
