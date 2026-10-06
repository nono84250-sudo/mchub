import Link from "next/link";
import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Serveurs — Admin Omniscient" };

export default async function AdminServers() {
  const servers = await db.orm.public.Server.select("id", "name", "slug", "type", "minecraftVersion", "published", "isPrivate", "viewCount", "launchCount", "createdAt")
    .orderBy((s) => s.createdAt.desc())
    .all();
  return (
    <section>
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 16 }}>Serveurs ({servers.length})</h1>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#9ca3af", borderBottom: "1px solid #2a2d45" }}>
            <th style={{ padding: 8 }}>Nom</th><th>Type</th><th>Version</th><th>Statut</th><th>Vues</th><th>Lancements</th><th />
          </tr>
        </thead>
        <tbody>
          {servers.map((s) => (
            <tr key={s.id} style={{ borderBottom: "1px solid #1f2237" }}>
              <td style={{ padding: 8 }}>{s.name}</td>
              <td>{s.type}</td>
              <td>{s.minecraftVersion}</td>
              <td>{s.published ? (s.isPrivate ? "Publié (privé)" : "Publié") : "Non publié"}</td>
              <td>{s.viewCount}</td>
              <td>{s.launchCount}</td>
              <td><Link href={`/servers/${s.slug}`} style={{ color: "#9184d9" }}>Voir la fiche</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
