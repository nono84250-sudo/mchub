// Coque du panel : les écrans de la maquette ont leur propre menu latéral, donc
// aucune mise en page supplémentaire ici. La garde de connexion est dans chaque page.
export default function PanelLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
