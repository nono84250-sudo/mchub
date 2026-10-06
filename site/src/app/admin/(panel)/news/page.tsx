export const dynamic = "force-dynamic";
export const metadata = { title: "Actualités — Admin Omniscient" };

export default function Page() {
  return (
    <section>
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 12 }}>Actualités</h1>
      <p style={{ color: "#9ca3af", maxWidth: 640 }}>Les annonces visibles par tous les joueurs seront publiées ici. Pas encore branché.</p>
    </section>
  );
}
