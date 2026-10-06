export const dynamic = "force-dynamic";
export const metadata = { title: "Packs curés — Admin Omniscient" };

export default function Page() {
  return (
    <section>
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 12 }}>Packs curés</h1>
      <p style={{ color: "#9ca3af", maxWidth: 640 }}>Les packs de mods préconfigurés (solo, amis, ou les deux) seront gérés ici. Pas encore branché : la table des packs n'est pas encore créée.</p>
    </section>
  );
}
