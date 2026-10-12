import { db } from "@/lib/db";
import { getT } from "@/i18n/getDictionary";

export const dynamic = "force-dynamic";
export const metadata = { title: "Actualités — Omniscient" };

export default async function NewsPage() {
  const { dict } = await getT();

  const posts = await db.orm.public.News.select("id", "title", "body", "publishedAt")
    .where({ published: true })
    .orderBy((n) => n.publishedAt.desc())
    .all();

  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{dict.dashboard.newsTitle}</h1>

      {posts.length === 0 ? (
        <div className="panel mt-8 p-8 text-center text-muted">{dict.dashboard.newsEmpty}</div>
      ) : (
        <ul className="mt-8 flex flex-col gap-4">
          {posts.map((post) => (
            <li key={post.id} className="panel p-6">
              <p className="text-[13px] text-muted">
                {new Date(post.publishedAt as string).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-foreground">{post.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{post.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
