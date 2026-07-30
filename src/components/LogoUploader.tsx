"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";

interface Props {
  clientId: string;
  logoUrl: string | null;
  clientName: string;
  /** 'sm' = 40 px (card), 'lg' = 56 px (detalhe) */
  size?: "sm" | "lg";
  canEdit?: boolean;
}

export default function LogoUploader({
  clientId,
  logoUrl,
  clientName,
  size = "lg",
  canEdit = false,
}: Props) {
  const [currentUrl, setCurrentUrl] = useState(logoUrl);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const sizeClass = size === "sm" ? "w-10 h-10" : "w-14 h-14";
  const textClass = size === "sm" ? "text-base" : "text-xl";
  const iconSize = size === "sm" ? 14 : 18;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optimistic preview before upload
    const preview = URL.createObjectURL(file);
    setCurrentUrl(preview);
    setUploading(true);
    setError(null);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch(`/api/clients/${clientId}/logo`, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { logo_url?: string; error?: string };

      if (!res.ok || data.error) {
        setError(data.error ?? "Falha no upload");
        setCurrentUrl(logoUrl); // revert
      } else if (data.logo_url) {
        // Add cache-busting query param so the browser reloads the new image
        setCurrentUrl(`${data.logo_url}?t=${Date.now()}`);
      }
    } catch {
      setError("Erro de conexão");
      setCurrentUrl(logoUrl);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(preview);
      // Reset input so same file can be re-uploaded if needed
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const initial = clientName.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col items-start gap-1">
      <div
        className={`relative ${sizeClass} rounded-xl shrink-0 ${canEdit ? "cursor-pointer group" : ""}`}
        onClick={canEdit && !uploading ? () => inputRef.current?.click() : undefined}
        title={canEdit ? "Clique para alterar logo" : undefined}
      >
        {currentUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentUrl}
            alt={clientName}
            className={`${sizeClass} rounded-xl object-cover`}
          />
        ) : (
          <div
            className={`${sizeClass} rounded-xl bg-accent/20 text-accent flex items-center justify-center font-bold ${textClass}`}
          >
            {initial}
          </div>
        )}

        {canEdit && (
          <div className="absolute inset-0 rounded-xl bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? (
              <Loader2 size={iconSize} className="animate-spin text-white" />
            ) : (
              <Camera size={iconSize} className="text-white" />
            )}
          </div>
        )}
      </div>

      {canEdit && (
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFile}
        />
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
