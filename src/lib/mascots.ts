export interface Mascot {
  /** Nome do mascote — personaliza o botão de insights por IA. */
  name: string;
  imageUrl: string;
}

/**
 * Mascotes por tenant — opcional. Adicione entradas aqui para personalizar
 * o botão de Insights com IA do seu tenant.
 *
 * Exemplo:
 *   "minha-agencia": { name: "Max", imageUrl: "https://..." }
 */
const MASCOTS: Record<string, Mascot> = {};

export function getMascot(slug: string): Mascot | null {
  return MASCOTS[slug] ?? null;
}
