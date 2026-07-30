"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { activateBMClient, addClientMember, deactivateClient, reactivateClient, removeClientMember, renameClient } from "@/app/actions/clients";
import type { GestorUser } from "@/app/actions/users";

interface BMAccount {
  id: string;
  name: string;
  account_status: number;
}

interface ActiveClient {
  id: string;
  name: string;
  account_id: string;
  account_name: string | null;
  owner_user_id: string | null;
  owner_email: string | null;
  group_name: string | null;
  member_ids: string[];
  member_emails: string[];
}

interface Group {
  id: string;
  name: string;
  color: string;
}

interface Props {
  newAccounts: BMAccount[];
  activeClients: ActiveClient[];
  inactiveClients: ActiveClient[];
  gestores: GestorUser[];
  groups: Group[];
  bmError: string | null;
  isAdmin: boolean;
  currentUserId: string;
}

function accountStatusLabel(status: number) {
  if (status === 1) return { label: "Ativo", cls: "bg-success/15 text-success" };
  if (status === 2) return { label: "Desativado", cls: "bg-danger/15 text-danger" };
  return { label: "Inativo", cls: "bg-muted/20 text-muted" };
}

// ─── Activate Modal ──────────────────────────────────────────
function ActivateModal({
  account,
  groups,
  gestores,
  onClose,
  onSuccess,
  defaultOwnerId = "",
}: {
  account: BMAccount;
  groups: Group[];
  gestores: GestorUser[];
  onClose: () => void;
  onSuccess: () => void;
  defaultOwnerId?: string;
}) {
  const [name, setName] = useState(account.name);
  const [groupId, setGroupId] = useState(groups[0]?.id ?? "");
  const [ownerId, setOwnerId] = useState(defaultOwnerId);
  const [backfillDays, setBackfillDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await activateBMClient(
          account.id,
          account.name,
          name,
          groupId,
          ownerId || null,
          backfillDays,
        );
        setDone(true);
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 1200);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl bg-card border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Ativar Cliente</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-muted font-mono bg-background px-2 py-1 rounded">
          {account.id}
        </p>

        {done ? (
          <div className="flex flex-col items-center gap-2 py-4">
            <CheckCircle2 size={32} className="text-success" />
            <p className="text-sm text-success font-medium">
              {backfillDays > 0
                ? `Cliente ativado! Histórico de ${backfillDays} dias será buscado amanhã.`
                : "Cliente ativado! Dados serão coletados a partir de amanhã."}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-muted">Nome do cliente</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted">Grupo <span className="text-danger">*</span></label>
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                required
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
              >
                {groups.length === 0 && (
                  <option value="">Nenhum grupo cadastrado</option>
                )}
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted">Gestor responsável (opcional)</label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
              >
                <option value="">Sem gestor</option>
                {gestores.map((g) => (
                  <option key={g.id} value={g.id}>{g.email}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-muted">Histórico de dados</label>
              <select
                value={backfillDays}
                onChange={(e) => setBackfillDays(Number(e.target.value))}
                className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
              >
                <option value={0}>Sem histórico — coletar só daqui pra frente</option>
                <option value={7}>7 dias</option>
                <option value={14}>14 dias</option>
                <option value={30}>30 dias (padrão)</option>
                <option value={45}>45 dias</option>
                <option value={60}>60 dias</option>
              </select>
            </div>

            {error && (
              <p className="text-xs text-danger flex items-center gap-1">
                <AlertTriangle size={13} />{error}
              </p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isPending || !groupId}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-accent hover:bg-accent/80 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
              >
                {isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                Ativar
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ─── Edit Members Modal ───────────────────────────────────────
function EditMembersModal({
  client,
  gestores,
  onClose,
  onSuccess,
}: {
  client: ActiveClient;
  gestores: GestorUser[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [memberIds, setMemberIds] = useState<string[]>(client.member_ids);
  const [addingId, setAddingId] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const available = gestores.filter((g) => !memberIds.includes(g.id));

  function handleAdd() {
    if (!addingId || memberIds.includes(addingId)) return;
    setError(null);
    startTransition(async () => {
      try {
        await addClientMember(client.id, addingId);
        setMemberIds((prev) => [...prev, addingId]);
        setAddingId("");
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao adicionar.");
      }
    });
  }

  function handleRemove(userId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await removeClientMember(client.id, userId);
        setMemberIds((prev) => prev.filter((id) => id !== userId));
        onSuccess();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao remover.");
      }
    });
  }

  const gestorMap = new Map(gestores.map((g) => [g.id, g.email]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl bg-card border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Gestores do cliente</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-muted">{client.name}</p>

        {/* Membros atuais */}
        <div className="space-y-1.5">
          {memberIds.length === 0 ? (
            <p className="text-xs text-muted italic">Nenhum gestor atribuído.</p>
          ) : (
            memberIds.map((uid) => (
              <div key={uid} className="flex items-center justify-between gap-2 rounded-lg bg-background border border-border px-3 py-2">
                <span className="text-sm truncate">{gestorMap.get(uid) ?? uid}</span>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleRemove(uid)}
                  className="shrink-0 text-muted hover:text-danger transition-colors disabled:opacity-50"
                >
                  <X size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Adicionar gestor */}
        {available.length > 0 && (
          <div className="flex gap-2">
            <select
              value={addingId}
              onChange={(e) => setAddingId(e.target.value)}
              className="flex-1 rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
            >
              <option value="">Adicionar gestor...</option>
              {available.map((g) => (
                <option key={g.id} value={g.id}>{g.email}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={!addingId || isPending}
              onClick={handleAdd}
              className="inline-flex items-center gap-1.5 rounded-lg bg-accent hover:bg-accent/80 disabled:opacity-50 text-white text-sm font-medium px-3 py-2 transition-colors"
            >
              {isPending ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
            </button>
          </div>
        )}

        {error && (
          <p className="text-xs text-danger flex items-center gap-1">
            <AlertTriangle size={13} />{error}
          </p>
        )}

        <button
          onClick={onClose}
          className="w-full rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

// ─── Rename Modal ─────────────────────────────────────────────
function RenameModal({
  client,
  onClose,
  onSuccess,
}: {
  client: ActiveClient;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(client.name);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await renameClient(client.id, name);
        onSuccess();
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido.");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-xl bg-card border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Renomear cliente</h2>
          <button onClick={onClose} className="text-muted hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-muted">{client.account_id}</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-muted">Nome do cliente</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              autoFocus
              className="w-full rounded-lg bg-background border border-border px-3 py-2 text-sm focus:outline-none focus:border-accent"
            />
          </div>
          {error && (
            <p className="text-xs text-danger flex items-center gap-1">
              <AlertTriangle size={13} />{error}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-4 py-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending || !name.trim()}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-accent hover:bg-accent/80 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
            >
              {isPending ? <Loader2 size={14} className="animate-spin" /> : null}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Archive Row Button ───────────────────────────────────────
function ArchiveButton({ clientId, clientName }: { clientId: string; clientName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleConfirm() {
    startTransition(async () => {
      try {
        await deactivateClient(clientId);
        router.refresh();
      } catch {
        setConfirming(false);
      }
    });
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted hidden sm:block">Arquivar &ldquo;{clientName}&rdquo;?</span>
        <button
          onClick={handleConfirm}
          disabled={isPending}
          className="rounded px-2 py-1 text-xs font-medium bg-danger/15 text-danger hover:bg-danger/25 transition-colors disabled:opacity-50"
        >
          {isPending ? <Loader2 size={12} className="animate-spin" /> : "Confirmar"}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded px-2 py-1 text-xs text-muted hover:text-foreground transition-colors"
        >
          Cancelar
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="p-2 rounded-lg border border-border text-muted hover:text-danger hover:border-danger/40 transition-colors"
      title="Arquivar cliente"
    >
      <Trash2 size={14} />
    </button>
  );
}

// ─── Reactivate Row Button ────────────────────────────────────
function ReactivateButton({ clientId }: { clientId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleReactivate() {
    startTransition(async () => {
      try {
        await reactivateClient(clientId);
        router.refresh();
      } catch { /* noop */ }
    });
  }

  return (
    <button
      onClick={handleReactivate}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-border text-muted hover:text-success hover:border-success/40 disabled:opacity-50 px-3 py-1.5 text-xs font-medium transition-colors"
      title="Reativar cliente"
    >
      {isPending ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
      Reativar
    </button>
  );
}

// ─── Main Panel ───────────────────────────────────────────────
export default function ContasPanel({
  newAccounts,
  activeClients,
  inactiveClients,
  gestores,
  groups,
  bmError,
  isAdmin,
  currentUserId,
}: Props) {
  const [tab, setTab] = useState<"ativas" | "inativas">("ativas");
  const [clientFilter, setClientFilter] = useState<"todos" | "meus">("todos");
  const [activating, setActivating] = useState<BMAccount | null>(null);
  const [editingMembers, setEditingMembers] = useState<ActiveClient | null>(null);
  const [renamingClient, setRenamingClient] = useState<ActiveClient | null>(null);
  const router = useRouter();

  const inativasCount = inactiveClients.length + newAccounts.length;

  const visibleActiveClients =
    clientFilter === "meus"
      ? activeClients.filter((c) => c.member_ids.includes(currentUserId))
      : activeClients;

  const tabClass = (t: "ativas" | "inativas") =>
    tab === t
      ? "px-4 py-2 text-sm font-medium border-b-2 border-accent text-foreground"
      : "px-4 py-2 text-sm text-muted hover:text-foreground transition-colors border-b-2 border-transparent";

  return (
    <>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border mb-6">
        <button className={tabClass("ativas")} onClick={() => setTab("ativas")}>
          Contas Ativas
          <span className="ml-2 text-xs text-muted">({activeClients.length})</span>
        </button>
        <button className={tabClass("inativas")} onClick={() => setTab("inativas")}>
          Inativas / Novas
          {inativasCount > 0 && (
            <span className="ml-2 text-xs bg-accent/20 text-accent px-1.5 py-0.5 rounded-full font-semibold">
              {inativasCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Tab: Ativas ── */}
      {tab === "ativas" && (
        <div>
          {/* Filtro meus / todos */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-muted">Exibir:</span>
            <div className="inline-flex rounded-lg border border-border overflow-hidden text-xs font-medium">
              <button
                onClick={() => setClientFilter("todos")}
                className={`px-3 py-1.5 transition-colors ${clientFilter === "todos" ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}
              >
                Todos ({activeClients.length})
              </button>
              <button
                onClick={() => setClientFilter("meus")}
                className={`px-3 py-1.5 border-l border-border transition-colors ${clientFilter === "meus" ? "bg-accent text-white" : "text-muted hover:text-foreground"}`}
              >
                Meus ({activeClients.filter((c) => c.member_ids.includes(currentUserId)).length})
              </button>
            </div>
          </div>

          {visibleActiveClients.length === 0 ? (
            <div className="rounded-xl border border-border p-10 flex flex-col items-center gap-2 text-center">
              <p className="text-sm text-muted">
                {clientFilter === "meus" ? "Nenhum cliente atribuído a você." : "Nenhum cliente ativo."}
              </p>
              {clientFilter === "meus" ? (
                <button
                  onClick={() => setClientFilter("todos")}
                  className="text-xs text-accent hover:underline mt-1"
                >
                  Ver todos os clientes
                </button>
              ) : (
                <button
                  onClick={() => setTab("inativas")}
                  className="text-xs text-accent hover:underline mt-1"
                >
                  Ver contas inativas e novas do BM
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-background/50">
                    <th className="text-left text-xs text-muted font-medium px-4 py-3">Cliente</th>
                    <th className="text-left text-xs text-muted font-medium px-4 py-3 hidden sm:table-cell">Conta Meta</th>
                    <th className="text-left text-xs text-muted font-medium px-4 py-3 hidden md:table-cell">Gestores</th>
                    <th className="text-left text-xs text-muted font-medium px-4 py-3 hidden md:table-cell">Grupo</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {visibleActiveClients.map((client, i) => (
                    <tr
                      key={client.id}
                      className={`border-b border-border last:border-b-0 ${i % 2 === 0 ? "" : "bg-background/20"}`}
                    >
                      <td className="px-4 py-3 font-medium">{client.name}</td>
                      <td className="px-4 py-3 text-muted font-mono text-xs hidden sm:table-cell">
                        {client.account_id}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs hidden md:table-cell">
                        {client.member_emails.length > 0
                          ? client.member_emails.join(", ")
                          : <span className="italic">Sem gestor</span>}
                      </td>
                      <td className="px-4 py-3 text-muted text-xs hidden md:table-cell">
                        {client.group_name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 justify-end">
                          <a
                            href={`/clients/${client.id}`}
                            className="p-2 rounded-lg border border-border text-muted hover:text-foreground transition-colors"
                            title="Ver cliente"
                          >
                            <ChevronRight size={14} />
                          </a>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => setRenamingClient(client)}
                                className="p-2 rounded-lg border border-border text-muted hover:text-foreground transition-colors"
                                title="Renomear cliente"
                              >
                                <Tag size={14} />
                              </button>
                              <button
                                onClick={() => setEditingMembers(client)}
                                className="p-2 rounded-lg border border-border text-muted hover:text-foreground transition-colors"
                                title="Gestores do cliente"
                              >
                                <Pencil size={14} />
                              </button>
                              <ArchiveButton clientId={client.id} clientName={client.name} />
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Inativas / Novas ── */}
      {tab === "inativas" && (
        <div className="space-y-8">

          {/* Seção: contas arquivadas (reativáveis) */}
          {inactiveClients.length > 0 && (
            <div>
              <p className="text-xs text-muted font-medium mb-3 uppercase tracking-wide">Arquivadas — clique em Reativar para restaurar</p>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-background/50">
                      <th className="text-left text-xs text-muted font-medium px-4 py-3">Cliente</th>
                      <th className="text-left text-xs text-muted font-medium px-4 py-3 hidden sm:table-cell">Conta Meta</th>
                      <th className="text-left text-xs text-muted font-medium px-4 py-3 hidden md:table-cell">Grupo</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {inactiveClients.map((client, i) => (
                      <tr
                        key={client.id}
                        className={`border-b border-border last:border-b-0 ${i % 2 === 0 ? "" : "bg-background/20"}`}
                      >
                        <td className="px-4 py-3 font-medium text-muted">{client.name}</td>
                        <td className="px-4 py-3 text-muted font-mono text-xs hidden sm:table-cell">
                          {client.account_id}
                        </td>
                        <td className="px-4 py-3 text-muted text-xs hidden md:table-cell">
                          {client.group_name ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            {isAdmin && <ReactivateButton clientId={client.id} />}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Seção: novas contas do BM ainda não ativadas */}
          <div>
            <p className="text-xs text-muted font-medium mb-3 uppercase tracking-wide">
              {bmError ? "Erro ao carregar contas do BM" : `Novas do BM — parceiras ainda não ativadas (${newAccounts.length})`}
            </p>
            {bmError ? (
              <div className="rounded-xl border border-danger/30 bg-danger/10 p-5 flex gap-3">
                <AlertTriangle size={18} className="text-danger mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-danger">Erro ao carregar contas Meta</p>
                  <p className="text-sm text-muted mt-1">{bmError}</p>
                  <p className="text-xs text-muted mt-2">
                    Configure <code className="bg-card px-1 rounded">meta_bm_id</code> e{" "}
                    <code className="bg-card px-1 rounded">meta_access_token</code> na tabela{" "}
                    <code className="bg-card px-1 rounded">tenants</code> para este tenant.
                  </p>
                </div>
              </div>
            ) : newAccounts.length === 0 ? (
              <div className="rounded-xl border border-border p-8 flex flex-col items-center gap-2 text-center">
                <CheckCircle2 size={28} className="text-success" />
                <p className="text-sm text-muted">Todas as contas do BM já estão ativas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {newAccounts.map((acc) => {
                  const { label, cls } = accountStatusLabel(acc.account_status);
                  return (
                    <div key={acc.id} className="rounded-xl bg-card border border-border p-5 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm leading-snug">{acc.name}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${cls}`}>
                          {label}
                        </span>
                      </div>
                      <p className="text-xs text-muted font-mono">{acc.id}</p>
                      <button
                        onClick={() => setActivating(acc)}
                        className="mt-auto inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent hover:bg-accent/80 text-white text-sm font-medium px-4 py-2 transition-colors"
                      >
                        <Plus size={14} />
                        Ativar no Dashboard
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {inactiveClients.length === 0 && !bmError && newAccounts.length === 0 && (
            <div className="rounded-xl border border-border p-10 flex flex-col items-center gap-2 text-center">
              <CheckCircle2 size={32} className="text-success" />
              <p className="text-sm font-medium">Nenhuma conta inativa ou nova.</p>
            </div>
          )}
        </div>
      )}

      {/* Activate Modal */}
      {activating && (
        <ActivateModal
          account={activating}
          groups={groups}
          gestores={gestores}
          onClose={() => setActivating(null)}
          onSuccess={() => router.refresh()}
          defaultOwnerId={!isAdmin ? currentUserId : ""}
        />
      )}

      {/* Edit Members Modal */}
      {editingMembers && (
        <EditMembersModal
          client={editingMembers}
          gestores={gestores}
          onClose={() => setEditingMembers(null)}
          onSuccess={() => router.refresh()}
        />
      )}

      {/* Rename Modal */}
      {renamingClient && (
        <RenameModal
          client={renamingClient}
          onClose={() => setRenamingClient(null)}
          onSuccess={() => router.refresh()}
        />
      )}
    </>
  );
}
