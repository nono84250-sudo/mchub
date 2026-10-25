"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/I18nProvider";

// Page Telecharger (design 2026-10-17, point 3) : dessin de l'ecran bleu
// SmartScreen tel que Windows le montre, pour qu'un nouveau joueur le
// reconnaisse AVANT qu'il apparaisse. Cliquable : « Informations
// complementaires » montre la suite, comme dans Windows. Couleurs figees
// (bleu Windows), volontairement hors du theme du site.
export function SmartScreenDemo() {
  const { t } = useI18n();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const wb = "border-2 border-white bg-transparent px-3 py-1 text-xs text-white cursor-pointer";

  return (
    <figure className="m-0">
      <div
        className="flex flex-col gap-2 rounded p-3.5 text-[12.5px] leading-snug text-white shadow-[0_8px_18px_-10px_rgba(0,0,0,0.6)]"
        style={{ background: "#0f5ea8", fontFamily: '"Segoe UI", system-ui, sans-serif' }}
      >
        <p className="m-0 text-[19px] font-light leading-tight">{t("download.ssTitle")}</p>
        {step === 2 ? (
          <button type="button" onClick={() => setStep(0)} className="rounded-sm bg-white/15 px-2 py-1.5 text-left">
            {t("download.ssDone")}
          </button>
        ) : (
          <>
            <span>{t("download.ssBody")}</span>
            {step === 1 ? (
              <>
                <span className="text-[11.5px] opacity-90">
                  {t("download.ssApp")}
                  <br />
                  {t("download.ssPublisher")}
                </span>
                <div className="mt-1 flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => setStep(2)} className={wb}>
                    {t("download.ssRun")}
                  </button>
                  <button type="button" onClick={() => setStep(0)} className={wb}>
                    {t("download.ssDontRun")}
                  </button>
                </div>
              </>
            ) : (
              <>
                <button type="button" onClick={() => setStep(1)} className="self-start text-left underline">
                  {t("download.ssMore")}
                </button>
                <div className="mt-1 flex justify-end">
                  <span className={wb}>{t("download.ssDontRun")}</span>
                </div>
              </>
            )}
          </>
        )}
      </div>
      <figcaption className="sr-only">{t("download.ssCaption")}</figcaption>
    </figure>
  );
}
