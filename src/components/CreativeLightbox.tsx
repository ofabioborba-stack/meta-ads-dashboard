"use client";

import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";

interface CreativeLightboxProps {
  src: string;
  fallback?: string | null;
  alt: string;
  isVideo?: boolean;
  videoLink?: string | null;
}

/** Thumbnail clicável. Vídeos mostram overlay de play e abrem o link do anúncio. */
export default function CreativeLightbox({ src, fallback, alt, isVideo, videoLink }: CreativeLightboxProps) {
  const [activeSrc, setActiveSrc] = useState(src);
  const [imgError, setImgError] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => { setActiveSrc(src); setImgError(false); }, [src]);

  function handleError() {
    if (fallback && activeSrc !== fallback) {
      setActiveSrc(fallback);
    } else {
      setImgError(true);
    }
  }

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  if (isVideo) {
    return (
      <a
        href={videoLink ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full relative group cursor-pointer"
        aria-label={`Ver vídeo de ${alt}`}
      >
        {imgError ? (
          <div className="w-full aspect-square rounded-t-xl bg-gradient-to-br from-zinc-800 to-zinc-900" />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={activeSrc}
            alt={alt}
            onError={handleError}
            className="w-full aspect-square object-cover rounded-t-xl bg-zinc-900"
          />
        )}
        <div className="absolute inset-0 flex items-center justify-center rounded-t-xl bg-black/30 group-hover:bg-black/50 transition-colors">
          <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Play size={24} className="text-white fill-white ml-1" />
          </div>
        </div>
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="block w-full cursor-pointer"
        aria-label={`Ampliar imagem de ${alt}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={activeSrc}
          alt={alt}
          onError={handleError}
          className="w-full aspect-square object-cover rounded-t-xl"
        />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Fechar"
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X size={28} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={activeSrc}
            alt={alt}
            onError={handleError}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[600px] max-h-[80vh] object-contain rounded-xl"
          />
        </div>
      )}
    </>
  );
}
