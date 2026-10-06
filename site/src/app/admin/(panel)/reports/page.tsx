import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Signalements — Admin Omniscient" };

const STATUS_LABEL: Record<string, string> = { new: "Nouveau", replied: "Répondu", resolved: "Résolu" };

export default async function AdminReports() {
  const reports = await db.orm.public.Report.select("id", "issue", "reporterMinecraftUsername", "status", "createdAt")
    .orderBy((r) => r.createdAt.desc())
    .all();
  return (
    <section>
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 16 }}>Signalements ({reports.length})</h1>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#9ca3af", borderBottom: "1px solid #2a2d45" }}>
            <th style={{ padding: 8 }}>Date</th><th>Problème</th><th>Joueur</th><th>Statut</th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #1f2237" }}>
              <td style={{ padding: 8 }}>{new Date(r.createdAt).toLocaleDateString("fr-FR")}</td>
              <td>{r.issue}</td>
              <td>{r.reporterMinecraftUsername}</td>
              <td>{STATUS_LABEL[r.status] ?? r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
