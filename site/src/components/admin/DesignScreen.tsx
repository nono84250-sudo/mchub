import Script from "next/script";
import { SCREENS } from "@/app/admin/design/screens";
import { markAllSections, balancedEnd, markNavBadges, escapeHtml } from "@/app/admin/design/bind";
import { countOpenBehaviorReports } from "@/lib/reports";
import { countPendingVerification } from "@/lib/verification";
// Importe la version memoisee (React.cache) depuis guard.ts, pas @/lib/adminSession directement :
// requireAdmin() (appele par chaque page avant DesignScreen) et cet appel doivent partager la
// MEME instance cache() pour qu'un seul des deux declenche vraiment une lecture D1.
import { getCurrentAdmin } from "@/app/admin/design/guard";
import { getStaffRoleLabels } from "@/lib/platformSettings";

// Affiche un écran de la maquette "Omniscient Admin Dashboard" : même markup, même
// style (feuille Nocturne), mêmes icônes (Phosphor). `html` remplace le modèle
// d'origine quand l'écran est rempli avec les vraies données.
export const WRAPPER_VARS = {
  "--muted": "color-mix(in srgb, var(--color-text) 55%, transparent)",
  "--muted2": "color-mix(in srgb, var(--color-text) 40%, transparent)",
  "--raised": "color-mix(in srgb, var(--color-text) 6%, var(--color-surface))",
  "--danger": "#e08a8a",
  "--success": "#5fd3a0",
  background: "var(--color-bg)",
  color: "var(--color-text)",
  fontFamily: "var(--font-body)",
  minHeight: "100vh",
} as React.CSSProperties;

const NAV_LINKS: Record<string, string> = {
  Overview: "/admin/overview",
  Notifications: "/admin/notifications",
  News: "/admin/news",
  Servers: "/admin/servers",
  "Vérification": "/admin/verification",
  Players: "/admin/players",
  Reports: "/admin/reports",
  "Packs curés": "/admin/packs",
  Administration: "/admin/administration",
  "Paramètres": "/admin/parametres",
  Contact: "/admin/contact",
};

// 2026-10-10 : /admin/parametres (identifiants du compte admin + interrupteurs des sources de
// modpacks, voir AdminSourceToggles) existait sans aucun lien pour y acceder — la maquette
// n'a pas d'entree "Paramètres" du tout. On en insere une, juste apres "Administration", avec
// le meme habillage que les autres entrees (repris tel quel depuis screens.ts).
function addSettingsNavItem(html: string): string {
  const marker =
    '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--radius-md);font-size:14px;color:var(--muted);"><i class="ph ph-shield-star" style="font-size:17px;"></i><span style="flex:1">Administration</span></div>';
  const item =
    '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--radius-md);font-size:14px;color:var(--muted);"><i class="ph ph-gear" style="font-size:17px;"></i><span style="flex:1">Paramètres</span></div>';
  return html.split(marker).join(marker + item);
}

// 2026-10-14 : /admin/contact (messages du formulaire de contact public, voir
// lib/contactMessages.ts) — meme raisonnement et meme methode que addSettingsNavItem
// ci-dessus, la maquette d'origine n'a pas d'entree "Contact" non plus. Inseree juste apres
// "Paramètres" (donc apres que addSettingsNavItem ait tourne).
function addContactNavItem(html: string): string {
  const marker =
    '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--radius-md);font-size:14px;color:var(--muted);"><i class="ph ph-gear" style="font-size:17px;"></i><span style="flex:1">Paramètres</span></div>';
  const item =
    '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--radius-md);font-size:14px;color:var(--muted);"><i class="ph ph-envelope" style="font-size:17px;"></i><span style="flex:1">Contact</span></div>';
  return html.split(marker).join(marker + item);
}

// Rend le menu cliquable (même style, même libellés) et marque "Amis" comme non branché.
function linkNav(html: string): string {
  return html.replace(/<span style="flex:1">([^<]+)<\/span>/g, (match, label: string) => {
    if (label === "Amis") return `<span class="nb" style="flex:1">${label}</span>`;
    const href = NAV_LINKS[label];
    return href ? `<a href="${href}" style="flex:1;color:inherit;text-decoration:none">${label}</a>` : match;
  });
}

// 2026-10-11 : panel admin épuré en attendant 30 serveurs publiés (moins de 10 joueurs
// actuellement, voir avis des agents sur le perimetre). Les pages restent codees et
// accessibles par URL directe (aucune route retiree) — seules ces entrees disparaissent
// du menu. Servers/Vérification/Paramètres restent visibles (migration D1 en cours,
// utile de garder un oeil dessus ; Vérification reste la seule porte d'entree des serveurs).
// 2026-10-13 : "Reports" retiree de cette liste (remise dans le menu) — reactivee pour le
// process de recours (point 4 de la checklist), retiree du perimetre reduit du 2026-10-12
// sans que ce soit volontaire.
const HIDDEN_NAV_LABELS = ["Overview", "Notifications", "News", "Players", "Packs curés", "Administration", "Amis"];

function hideNavItems(html: string): string {
  let result = html;
  for (const label of HIDDEN_NAV_LABELS) {
    const at = result.indexOf(`>${label}<`);
    if (at < 0) continue;
    const start = result.lastIndexOf("<div", at);
    const end = balancedEnd(result, start, "div");
    if (start < 0 || end < 0) continue;
    result = result.slice(0, start) + result.slice(end);
  }
  return result;
}

// Remonte l'entree "Players" du menu juste au-dessus de "Servers" — chaque ecran de la
// maquette embarque sa propre copie du menu (meme ordre partout), donc ce reordonnancement
// se fait ici une seule fois plutot que dans chaque ecran de screens.ts.
function reorderNav(html: string): string {
  const playersAt = html.indexOf(">Players<");
  if (playersAt < 0) return html;
  const playersStart = html.lastIndexOf("<div", playersAt);
  const playersEnd = balancedEnd(html, playersStart, "div");
  if (playersStart < 0 || playersEnd < 0) return html;
  const item = html.slice(playersStart, playersEnd);
  const without = html.slice(0, playersStart) + html.slice(playersEnd);

  const serversAt = without.indexOf(">Servers<");
  if (serversAt < 0) return html;
  const serversStart = without.lastIndexOf("<div", serversAt);
  if (serversStart < 0) return html;
  return without.slice(0, serversStart) + item + without.slice(serversStart);
}

// Retire la barre de recherche de l'en-tete : purement visuelle (aucune recherche ne marche
// depuis la, contrairement aux vraies barres de recherche des listes elles-memes). La cloche
// de notification juste a cote reste.
function removeTopbarSearch(html: string): string {
  const marker = 'class="ph ph-magnifying-glass"';
  const at = html.indexOf(marker);
  if (at < 0) return html;
  const start = html.lastIndexOf("<div", at);
  const end = balancedEnd(html, start, "div");
  if (start < 0 || end < 0) return html;
  return html.slice(0, start) + html.slice(end);
}

// Icone de cloche : ne menait nulle part et n'etait pas marquee, alors que la page
// Notifications qu'elle devrait ouvrir est elle-meme entierement maquette (non branchee).
// On la relie a cette page et on la marque en rouge, pour que rien ne paraisse fonctionnel
// sans l'etre.
function markTopbarBell(html: string): string {
  const marker =
    '<span style="width:32px;height:32px;border-radius:var(--radius-md);border:1px solid var(--color-divider);display:flex;align-items:center;justify-content:center;color:var(--muted);"><i class="ph ph-bell" style="font-size:15px;"></i></span>';
  return html.split(marker).join(
    '<a href="/admin/notifications" style="width:32px;height:32px;border-radius:var(--radius-md);border:1px solid var(--color-divider);display:flex;align-items:center;justify-content:center;color:var(--muted);text-decoration:none;"><i class="ph ph-bell" style="font-size:15px;"></i></a>',
  );
}

// Carte utilisateur en bas de la sidebar : la maquette affiche en dur "Alex Kade" / "Owner"
// avec une icone de deconnexion qui ne fait rien. On remplace par l'admin reellement connecte
// et son libelle de role (reutilise getStaffRoleLabels — le libelle renomme depuis
// Administration > Renommer les roles, pas "Administrateur"/"Modérateur" en dur), et on
// branche l'icone sur /api/admin/logout.
function markUserCard(html: string, admin: Awaited<ReturnType<typeof getCurrentAdmin>>, roleLabels: Awaited<ReturnType<typeof getStaffRoleLabels>>): string {
  const marker =
    '<div style="margin-top:auto;display:flex;align-items:center;gap:10px;padding:12px 10px 0;border-top:1px solid var(--color-divider);"><span style="width:30px;height:30px;flex-shrink:0;border-radius:50%;background:var(--color-accent-800);color:var(--color-accent-100);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;">A</span><div style="min-width:0;flex:1;"><div style="display:flex;flex-direction:column;gap:2px;min-width:0;"><span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Alex Kade</span><span style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Owner</span></div></div><i class="ph ph-sign-out" style="font-size:16px;color:var(--muted)"></i></div>';
  if (!admin || !html.includes(marker)) return html;
  const initial = escapeHtml(admin.username.charAt(0).toUpperCase());
  const roleLabel = escapeHtml(roleLabels[admin.role]);
  const replacement =
    `<div style="margin-top:auto;display:flex;align-items:center;gap:10px;padding:12px 10px 0;border-top:1px solid var(--color-divider);"><span style="width:30px;height:30px;flex-shrink:0;border-radius:50%;background:var(--color-accent-800);color:var(--color-accent-100);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;">${initial}</span><div style="min-width:0;flex:1;"><div style="display:flex;flex-direction:column;gap:2px;min-width:0;"><span style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(admin.username)}</span><span style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${roleLabel}</span></div></div><button type="button" onclick="fetch('/api/admin/logout',{method:'POST'}).then(()=>{location.href='/admin/login'})" style="background:none;border:none;padding:0;cursor:pointer;display:flex;align-items:center;" aria-label="Se déconnecter"><i class="ph ph-sign-out" style="font-size:16px;color:var(--muted)"></i></button></div>`;
  return html.split(marker).join(replacement);
}

// Extrait du composant pour etre reutilisee par AdminChrome.tsx (pages avec de vrais
// composants client interactifs, injectes via un portail React plutot que du HTML statique —
// voir le commentaire la-bas) sans dupliquer tout ce pipeline de transformation.
export async function buildScreenContent({ name, html, markAll }: { name: keyof typeof SCREENS; html?: string; markAll?: boolean | "proposal" }): Promise<string> {
  const [verificationPending, reportsOpen, admin, roleLabels] = await Promise.all([
    countPendingVerification(),
    countOpenBehaviorReports(),
    getCurrentAdmin(),
    getStaffRoleLabels(),
  ]);
  // markNavBadges, addSettingsNavItem et addContactNavItem doivent tourner avant linkNav :
  // celui-ci transforme le <span style="flex:1"> du libelle en <a>, ce qui change sa balise
  // fermante et casse tout remplacement litteral fait apres coup.
  let content = markUserCard(
    markTopbarBell(
      removeTopbarSearch(
        hideNavItems(reorderNav(linkNav(addContactNavItem(addSettingsNavItem(markNavBadges(html ?? SCREENS[name], { verificationPending, reportsOpen })))))),
      ),
    ),
    admin,
    roleLabels,
  );
  if (markAll) content = markAllSections(content, markAll === "proposal" ? "pr" : "nb");
  return content;
}

export async function DesignScreen({ name, html, markAll }: { name: keyof typeof SCREENS; html?: string; markAll?: boolean | "proposal" }) {
  const content = await buildScreenContent({ name, html, markAll });
  return (
    <>
      <link rel="stylesheet" href="/admin/nocturne.css" />
      <link rel="stylesheet" href="/admin/nb.css" />
      <Script src="https://unpkg.com/@phosphor-icons/web@2.1.1" strategy="afterInteractive" />
      <div style={WRAPPER_VARS} dangerouslySetInnerHTML={{ __html: content }} />
    </>
  );
}
