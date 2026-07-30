"use client";

import { Bell, ExternalLink, Loader2, RefreshCw, Save, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getClientSocialAccount,
  setSocialAccountActive,
  updateClientNotificationSettings,
  type SocialAccountInfo,
} from "@/app/actions/clients";

interface Group {
  id: string;
  subject: string;
  size: number;
  pictureUrl: string | null;
}

interface Props {
  clientId: string;
  sheetsLeadsUrl: string | null;
  whatsappNotify: string | null;
  whatsappNotify2: string | null;
  whatsappGroupJid: string | null;
  notifyLeadsNumber: boolean;
  notifyLeadsGroup: boolean;
  notifyBalanceNumber: boolean;
  notifyBalanceGroup: boolean;
}

export default function ClientNotificationSettings({
  clientId,
  sheetsLeadsUrl,
  whatsappNotify,
  whatsappNotify2,
  whatsappGroupJid,
  notifyLeadsNumber,
  notifyLeadsGroup,
  notifyBalanceNumber,
  notifyBalanceGroup,
}: Props) {
  const [open, setOpen] = useState(false);

  // form state
  const [url, setUrl]       = useState(sheetsLeadsUrl ?? "");
  const [phone, setPhone]   = useState(whatsappNotify ?? "");
  const [phone2, setPhone2] = useState(whatsappNotify2 ?? "");
  const [groupJid, setGroupJid] = useState(whatsappGroupJid ?? "");
  const [leadsNum,    setLeadsNum]    = useState(notifyLeadsNumber);
  const [leadsGrp,    setLeadsGrp]    = useState(notifyLeadsGroup);
  const [balanceNum,  setBalanceNum]  = useState(notifyBalanceNumber);
  const [balanceGrp,  setBalanceGrp]  = useState(notifyBalanceGroup);

  // groups
  const [groups, setGroups]         = useState<Group[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupsError, setGroupsError]     = useState<string | null>(null);

  // save
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // instagram orgânico
  const [socialAccount, setSocialAccount]   = useState<SocialAccountInfo | null>(null);
  const [igActive, setIgActive]             = useState(false);
  const [togglingIg, setTogglingIg]         = useState(false);

  const isConfigured = sheetsLeadsUrl || whatsappNotify || whatsappNotify2 || whatsappGroupJid;

  async function fetchGroups() {
    setLoadingGroups(true);
    setGroupsError(null);
    try {
      const res = await fetch("/api/evolution/groups");
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Erro ${res.status}`);
      }
      const data: Group[] = await res.json();
      setGroups(data);
    } catch (e) {
      setGroupsError(e instanceof Error ? e.message : "Erro ao buscar grupos");
    } finally {
      setLoadingGroups(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    fetchGroups();
    getClientSocialAccount(clientId).then((acc) => {
      setSocialAccount(acc);
      setIgActive(acc?.is_active ?? false);
    });
  }, [open, clientId]);

  async function handleToggleIg(active: boolean) {
    if (!socialAccount) return;
    setTogglingIg(true);
    try {
      await setSocialAccountActive(socialAccount.id, active);
      setIgActive(active);
      setSocialAccount({ ...socialAccount, is_active: active });
    } finally {
      setTogglingIg(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await updateClientNotificationSettings(clientId, {
        sheets_leads_url:    url || null,
        whatsapp_notify:     phone || null,
        whatsapp_notify_2:   phone2 || null,
        whatsapp_group_jid:  groupJid || null,
        notify_leads_number:   leadsNum,
        notify_leads_group:    leadsGrp,
        notify_balance_number: balanceNum,
        notify_balance_group:  balanceGrp,
      });
      setSuccess(true);
      setTimeout(() => { setOpen(false); setSuccess(false); }, 1200);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  const hasPhone = phone.length >= 10 || phone2.length >= 10;
  const hasGroup = groupJid.endsWith("@g.us");

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-sm transition-colors ${
          isConfigured ? "text-accent hover:text-accent/80" : "text-muted hover:text-white"
        }`}
      >
        <Bell size={14} />
        {isConfigured ? "Notificações ativas" : "Configurar notificações"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-lg rounded-xl bg-card border border-border p-5 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Notificações de leads e saldo</h3>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-white">
                <X size={18} />
              </button>
            </div>

            {/* Instagram Orgânico */}
            <div className="rounded-lg border border-border p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="shrink-0 text-muted text-sm">📷</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Instagram Orgânico</p>
                  {socialAccount ? (
                    <p className="text-xs text-muted truncate">{socialAccount.account_name}</p>
                  ) : (
                    <p className="text-xs text-muted">Nenhuma conta conectada</p>
                  )}
                </div>
              </div>
              {socialAccount ? (
                <button
                  type="button"
                  disabled={togglingIg}
                  onClick={() => handleToggleIg(!igActive)}
                  className={`relative shrink-0 w-10 h-5 rounded-full transition-colors ${
                    igActive ? "bg-accent" : "bg-border"
                  } ${togglingIg ? "opacity-50" : ""}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${igActive ? "translate-x-5" : ""}`} />
                </button>
              ) : (
                <span className="text-xs text-muted shrink-0">—</span>
              )}
            </div>

            {/* Planilha */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">Planilha de leads</label>
              <p className="text-xs text-muted">
                Compartilhe a planilha com a conta de serviço e cole o link. O fluxo detecta novos leads automaticamente.
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                />
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center px-2 text-muted hover:text-white" title="Abrir">
                    <ExternalLink size={15} />
                  </a>
                )}
              </div>
            </div>

            {/* Número individual */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">Número WhatsApp (individual)</label>
              <p className="text-xs text-muted">DDI + DDD + número, sem espaços. Ex: 5511999999999</p>
              <input
                type="tel"
                placeholder="5511999999999"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                maxLength={15}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>

            {/* Número individual 2 */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">Número WhatsApp (2º analista)</label>
              <p className="text-xs text-muted">Opcional. Receberá as mesmas notificações do número 1.</p>
              <input
                type="tel"
                placeholder="5511999999999"
                value={phone2}
                onChange={(e) => setPhone2(e.target.value.replace(/\D/g, ""))}
                maxLength={15}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>

            {/* Grupo WhatsApp */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">Grupo WhatsApp</label>
                <button
                  type="button"
                  onClick={fetchGroups}
                  className="inline-flex items-center gap-1 text-xs text-muted hover:text-white transition-colors"
                >
                  {loadingGroups
                    ? <Loader2 size={12} className="animate-spin" />
                    : <RefreshCw size={12} />}
                  Atualizar lista
                </button>
              </div>

              {groupsError && <p className="text-xs text-danger">{groupsError}</p>}

              {loadingGroups ? (
                <div className="flex items-center gap-2 text-xs text-muted py-2">
                  <Loader2 size={14} className="animate-spin" /> Buscando grupos...
                </div>
              ) : (
                <select
                  value={groupJid}
                  onChange={(e) => setGroupJid(e.target.value)}
                  className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
                >
                  <option value="">— Nenhum grupo —</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.subject} ({g.size} membros)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Preferências */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Quando notificar?</p>

              <div className="rounded-lg border border-border divide-y divide-border">
                {/* Novos leads */}
                <div className="p-3">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Novo lead</p>
                  <div className="space-y-2">
                    <label className={`flex items-center gap-2 text-sm cursor-pointer ${!hasPhone ? "opacity-40" : ""}`}>
                      <input type="checkbox" checked={leadsNum} onChange={(e) => setLeadsNum(e.target.checked)}
                        disabled={!hasPhone}
                        className="rounded accent-accent" />
                      Número individual
                      {!hasPhone && <span className="text-xs text-muted">(configure o número acima)</span>}
                    </label>
                    <label className={`flex items-center gap-2 text-sm cursor-pointer ${!hasGroup ? "opacity-40" : ""}`}>
                      <input type="checkbox" checked={leadsGrp} onChange={(e) => setLeadsGrp(e.target.checked)}
                        disabled={!hasGroup}
                        className="rounded accent-accent" />
                      Grupo WhatsApp
                      {!hasGroup && <span className="text-xs text-muted">(selecione um grupo acima)</span>}
                    </label>
                  </div>
                </div>

                {/* Saldo baixo */}
                <div className="p-3">
                  <p className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Saldo baixo</p>
                  <div className="space-y-2">
                    <label className={`flex items-center gap-2 text-sm cursor-pointer ${!hasPhone ? "opacity-40" : ""}`}>
                      <input type="checkbox" checked={balanceNum} onChange={(e) => setBalanceNum(e.target.checked)}
                        disabled={!hasPhone}
                        className="rounded accent-accent" />
                      Número individual
                      {!hasPhone && <span className="text-xs text-muted">(configure o número acima)</span>}
                    </label>
                    <label className={`flex items-center gap-2 text-sm cursor-pointer ${!hasGroup ? "opacity-40" : ""}`}>
                      <input type="checkbox" checked={balanceGrp} onChange={(e) => setBalanceGrp(e.target.checked)}
                        disabled={!hasGroup}
                        className="rounded accent-accent" />
                      Grupo WhatsApp
                      {!hasGroup && <span className="text-xs text-muted">(selecione um grupo acima)</span>}
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {error   && <p className="text-sm text-danger">{error}</p>}
            {success && <p className="text-sm text-green-400">Salvo com sucesso!</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setOpen(false)}
                className="px-4 py-2 rounded-lg text-sm text-muted hover:text-white transition-colors">
                Cancelar
              </button>
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/80 disabled:opacity-50 transition-colors">
                <Save size={14} />
                {saving ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
