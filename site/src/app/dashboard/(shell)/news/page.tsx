import { getT } from "@/i18n/getDictionary";

export const metadata = { title: "Actualités — Omniscient" };

export default async function NewsPage() {
  const { dict } = await getT();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{dict.dashboard.newsTitle}</h1>

      <div className="panel mt-8 p-8 text-center text-muted">{dict.dashboard.newsEmpty}</div>
    </div>
  );
}
