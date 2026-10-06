import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vue d'ensemble — Admin Omniscient" };

export default async function Overview() {
  const [servers, users, openReports] = await Promise.all([
    db.orm.public.Server.select("id", "published").all(),
    db.orm.public.User.select("id").all(),
    db.orm.public.Report.select("id").where({ status: "new" }).all(),
  ]);
  const published = servers.filter((s) => s.published).length;
  const cards: [string, number][] = [
    ["Serveurs", servers.length],
    ["Serveurs publiés", published],
    ["Joueurs (comptes)", users.length],
    ["Signalements à traiter", openReports.length],
  ];
  return (
    <section>
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 16 }}>Vue d&apos;ensemble</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
        {cards.map(([label, value]) => (
          <div key={label} style={{ border: "1px solid #2a2d45", borderRadius: 12, padding: 16 }}>
            <div style={{ fontSize: 12, color: "#9ca3af" }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 500, marginTop: 6 }}>{value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
