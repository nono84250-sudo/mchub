import { Fragment, type ReactNode } from "react";

// Mise en forme volontairement minuscule pour le texte de presentation d'une fiche (voir
// lib/serverPage.ts) : « ## titre », « - element de liste », **gras** et *italique*. Le texte
// n'est jamais interprete comme du HTML : chaque morceau devient un noeud React (echappe par
// React), donc aucune balise ni attribut saisi par un proprietaire ne peut arriver dans la page.
function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*(.+?)\*\*|\*(.+?)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(m[1] !== undefined ? <strong key={`${keyPrefix}-${i++}`}>{m[1]}</strong> : <em key={`${keyPrefix}-${i++}`}>{m[2]}</em>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ source, className }: { source: string; className?: string }) {
  const blocks: ReactNode[] = [];
  let para: string[] = [];
  let list: string[] = [];
  const flushPara = () => {
    if (para.length) {
      const k = `p${blocks.length}`;
      blocks.push(
        <p key={k}>
          {para.map((line, i) => (
            <Fragment key={i}>
              {i > 0 ? <br /> : null}
              {inline(line, `${k}-${i}`)}
            </Fragment>
          ))}
        </p>,
      );
      para = [];
    }
  };
  const flushList = () => {
    if (list.length) {
      const k = `l${blocks.length}`;
      blocks.push(
        <ul key={k}>
          {list.map((item, i) => (
            <li key={i}>{inline(item, `${k}-${i}`)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const line of source.split("\n")) {
    if (/^##\s+/.test(line)) {
      flushPara();
      flushList();
      const k = `h${blocks.length}`;
      blocks.push(<h3 key={k}>{inline(line.replace(/^##\s+/, ""), k)}</h3>);
    } else if (/^-\s+/.test(line)) {
      flushPara();
      list.push(line.replace(/^-\s+/, ""));
    } else if (!line.trim()) {
      flushPara();
      flushList();
    } else {
      flushList();
      para.push(line);
    }
  }
  flushPara();
  flushList();
  return (
    <div
      className={`max-w-[68ch] break-words text-foreground [&_em]:italic [&_h3]:mb-1.5 [&_h3]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold first:[&_h3]:mt-0 [&_li]:mb-1 [&_p]:mb-3 [&_strong]:font-semibold [&_strong]:text-accent [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 ${className ?? ""}`}
    >
      {blocks}
    </div>
  );
}
