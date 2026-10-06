export const dynamic = "force-dynamic";
export const metadata = { title: "Vérification des serveurs — Admin Omniscient" };

export default function Page() {
  return (
    <section>
      <h1 style={{ fontSize: 20, fontWeight: 500, marginBottom: 12 }}>Vérification des serveurs</h1>
      <p style={{ color: "#9ca3af", maxWidth: 640 }}>Les serveurs que le contrôle automatique retient (doute) attendront ici une décision humaine. Pas encore branché : la file et les décisions du robot ne sont pas encore construites.</p>
    </section>
  );
}
