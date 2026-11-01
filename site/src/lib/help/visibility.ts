import "server-only";
import { cache } from "react";
import { unstable_rethrow } from "next/navigation";
import { featureVisibleOnSite, featuresFor, siteViewer } from "@/lib/features";
import { getCurrentAdmin } from "@/lib/adminSession";
import { HELP_ARTICLES, HELP_CATEGORIES } from "@/lib/help/articles";
import type { HelpArticle, HelpCategory } from "@/lib/help/types";

// Page « Bugs connus » (Laboratoire « bugCatalog ») : même règle que les pages du centre d'aide.
export const bugsVisible = cache(async (): Promise<boolean> => {
  if (!!(await getCurrentAdmin().catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  }))) return true;
  return featureVisibleOnSite("bugCatalog").catch((error: unknown) => {
    unstable_rethrow(error);
    return false;
  });
});

// hidden : page montrée seulement parce que le visiteur est admin (fonction pas encore visible).
export type VisibleArticle = HelpArticle & { beta: boolean; hidden: boolean };

// Quelles pages ce visiteur peut voir. Même règle que le reste du site : c'est le Laboratoire qui
// décide (featuresFor + siteViewer). Une fonction inconnue (pas encore dans le catalogue) ou en
// erreur de lecture = page cachée : on ne documente jamais une fonction invisible.
export const visibleHelp = cache(async (): Promise<{ articles: VisibleArticle[]; categories: HelpCategory[]; isAdmin: boolean }> => {
  const needsLab = HELP_ARTICLES.some((a) => a.feature);
  const features = needsLab
    ? await featuresFor(await siteViewer()).catch((error: unknown) => {
        unstable_rethrow(error);
        return {} as Awaited<ReturnType<typeof featuresFor>>;
      })
    : {};
  const isAdmin = !!(await getCurrentAdmin().catch((error: unknown) => {
    unstable_rethrow(error);
    return null;
  }));

  const articles: VisibleArticle[] = [];
  for (const a of HELP_ARTICLES) {
    if (a.adminOnly && !isAdmin) continue;
    if (a.feature) {
      const access = features[a.feature];
      // Un admin voit aussi les pages des fonctions en test, pour les relire avant de les ouvrir.
      if (!access?.visible && !isAdmin) continue;
      articles.push({ ...a, beta: !access || access.state !== "all", hidden: !access?.visible });
      continue;
    }
    articles.push({ ...a, beta: false, hidden: !!a.adminOnly });
  }
  const categories = HELP_CATEGORIES.filter((c) => articles.some((a) => a.cat === c.id));
  return { articles, categories, isAdmin };
});
