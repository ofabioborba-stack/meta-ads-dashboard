const BASE = process.env.EVOLUTION_API_URL!;

export interface EvolutionGroup {
  id: string;     // JID: 1234@g.us
  subject: string;
  size: number;
  pictureUrl: string | null;
}

export async function listGroups(instance: string, apiKey: string): Promise<EvolutionGroup[]> {
  const res = await fetch(
    `${BASE}/group/fetchAllGroups/${encodeURIComponent(instance)}?getParticipants=false`,
    { headers: { apikey: apiKey }, cache: "no-store" }
  );
  if (!res.ok) throw new Error(`Evolution API ${res.status}`);
  const data = await res.json() as EvolutionGroup[];
  return data.filter((g) => !g.id.includes("@broadcast"));
}

export async function sendText(to: string, text: string, instance: string, apiKey: string): Promise<void> {
  const res = await fetch(
    `${BASE}/message/sendText/${encodeURIComponent(instance)}`,
    {
      method: "POST",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ number: to, text }),
    }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Evolution sendText ${res.status}: ${body}`);
  }
}

/**
 * Número individual para a Evolution: apenas os dígitos (DDI+DDD+número).
 * A Evolution resolve o JID e o "9" brasileiro sozinha. Mandar o JID completo
 * (`...@s.whatsapp.net`) faz a checagem de existência falhar (exists:false),
 * então o envio individual nunca chegava.
 */
export function toWhatsappNumber(phone: string): string {
  return phone.replace(/\D/g, "");
}
