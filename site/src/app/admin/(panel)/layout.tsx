// Coque du panel : les écrans de la maquette ont leur propre menu latéral, donc
// aucune mise en page supplémentaire ici. La garde de connexion est dans chaque page.
import { AdminConfirmBridge } from "@/components/admin/AdminConfirmBridge";

export default function PanelLayout({ children }: { children: React.ReactNode }) {
  // Fenetre de confirmation commune (lot 4) pour les formulaires des ecrans de la maquette.
  return (
    <>
      {children}
      <AdminConfirmBridge />
    </>
  );
}
