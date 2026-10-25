import { getT } from "@/i18n/getDictionary";
import { t } from "@/i18n/t";
import { STATE_COLOR, type ServerState } from "@/lib/playerGauge";

// Pastille d'etat pres du nom (variante C, 17/10) : point de couleur + chiffre, et une
// bulle au survol (ou au clavier) qui explique l'etat en une phrase.
export async function ServerStatePill({
  state,
  count,
  capacity,
  className = "",
}: {
  state: ServerState;
  count: number | null;
  capacity: number | null;
  className?: string;
}) {
  const { dict } = await getT();
  const s = dict.servers.state;
  const label = s[state];
  const text =
    state === "off" ? s.off : state === "unk" ? s.unknownShort : capacity ? `${count} / ${capacity}` : t(dict, "servers.state.onlineCount", { count: count ?? 0 });
  const tip =
    state === "unk"
      ? s.tipUnk
      : state === "off"
        ? s.tipOff
        : state === "full"
          ? t(dict, "servers.state.tipFull", { count: count ?? 0, capacity: capacity ?? 0 })
          : state === "warn"
            ? t(dict, "servers.state.tipWarn", { count: count ?? 0, capacity: capacity ?? 0 })
            : capacity
              ? t(dict, "servers.state.tipOk", { count: count ?? 0, capacity })
              : t(dict, "servers.state.tipOkNoCap", { count: count ?? 0 });
  const color = STATE_COLOR[state];

  return (
    <span
      className={`group/pill relative inline-flex flex-shrink-0 cursor-help items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-px text-[11.5px] font-semibold ${className}`}
      style={{ color, borderColor: color }}
      aria-label={`${label}. ${tip}`}
    >
      <span
        aria-hidden="true"
        className="h-[9px] w-[9px] rounded-full"
        style={state === "unk" ? { border: `1.5px dashed ${color}` } : { background: color }}
      />
      {text}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-30 w-max max-w-[240px] -translate-x-1/2 whitespace-normal rounded-lg border border-white/15 bg-[#0e0f16] px-2.5 py-2 text-left text-xs font-normal leading-snug text-[#f1f1f4] opacity-0 shadow-[0_8px_20px_rgba(0,0,0,0.4)] transition-opacity group-hover/pill:opacity-100"
      >
        <b className="mb-0.5 block font-semibold" style={{ color }}>
          ● {label}
        </b>
        {tip}
      </span>
    </span>
  );
}
