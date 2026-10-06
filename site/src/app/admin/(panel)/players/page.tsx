import { db } from "@/prisma/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Joueurs — Admin Omniscient" };

export default async function AdminPlayers() {
  const users = await db.orm.public.User.select("id", "name", "minecraftUsername", "createdAt")
    .orderBy((u) => u.createdAt.desc())
    .all();
  return (
    <section>
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 16 }}>Joueurs ({users.length})</h1>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: "left", color: "#9ca3af", borderBottom: "1px solid #2a2d45" }}>
            <th style={{ padding: 8 }}>Nom</th><th>Pseudo Minecraft</th><th>Inscription</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} style={{ borderBottom: "1px solid #1f2237" }}>
              <td style={{ padding: 8 }}>{u.name}</td>
              <td>{u.minecraftUsername ?? "—"}</td>
              <td>{new Date(u.createdAt).toLocaleDateString("fr-FR")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
