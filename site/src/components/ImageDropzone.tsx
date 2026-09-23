"use client";

import { useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { X, SpinnerGap } from "@phosphor-icons/react";
import type { Icon } from "@phosphor-icons/react";
import { useI18n } from "@/i18n/I18nProvider";

type ImageDropzoneProps = {
  name: string;
  defaultValue?: string | null;
  label: string;
  placeholder: string;
  icon: Icon;
  shape?: "wide" | "square";
};

// Remplace les anciens champs "URL de l'image" (coller un lien externe) par
// un vrai depot de fichier, conforme a la maquette (voir "drop banner, 16:9"
// / "drop background" dans Design/Omniscient Site Mockups.dc.html). Upload
// direct navigateur -> Vercel Blob (voir /api/upload) : seul le jeton
// transite par notre serveur, jamais le fichier lui-meme — evite la limite
// de taille des server actions Next.js pour des images de quelques Mo.
export function ImageDropzone({ name, defaultValue, label, placeholder, icon: PlaceholderIcon, shape = "wide" }: ImageDropzoneProps) {
  const { t } = useI18n();
  const [url, setUrl] = useState(defaultValue ?? "");
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setStatus("error");
      return;
    }
    setStatus("uploading");
    try {
      const blob = await upload(file.name, file, {
        access: "public",
        handleUploadUrl: "/api/upload",
      });
      setUrl(blob.url);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="field-label">{label}</span>
      <input type="hidden" name={name} value={url} />
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void uploadFile(file);
          event.target.value = "";
        }}
      />
      <div
        role="button"
        tabIndex={0}
        onClick={() => status !== "uploading" && inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragOver(false);
          const file = event.dataTransfer.files?.[0];
          if (file) void uploadFile(file);
        }}
        className={`relative flex h-24 cursor-pointer items-center justify-center gap-1.5 overflow-hidden rounded-md border border-dashed text-center font-mono text-[11px] text-muted ${shape === "square" ? "w-24" : "w-full"}`}
        style={{
          borderColor: dragOver ? "var(--accent)" : "var(--border)",
          backgroundImage: url
            ? undefined
            : "repeating-linear-gradient(45deg, var(--surface) 0 8px, var(--surface-raised) 8px 16px)",
        }}
      >
        {url ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- image d'origine externe (Vercel Blob), pas un asset local optimisable */}
            <img src={url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setUrl("");
                setStatus("idle");
              }}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </>
        ) : status === "uploading" ? (
          <SpinnerGap className="h-4 w-4 animate-spin" />
        ) : (
          <>
            <PlaceholderIcon className="h-4 w-4 flex-shrink-0" />
            <span>{placeholder}</span>
          </>
        )}
      </div>
      {status === "error" ? <p className="text-xs text-danger">{t("imageUpload.failed")}</p> : null}
    </div>
  );
}
