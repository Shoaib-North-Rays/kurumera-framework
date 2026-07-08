import { notFound } from "next/navigation";
import { KurumeraError } from "@kurumera/storefront";
import { getStore } from "@/lib/kurumera";

/** page template — CMS content pages (about, contact, policies…) */
export default async function CmsPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const kurumera = await getStore();

  let page;
  try {
    page = await kurumera.pages.getByHandle(handle);
  } catch (e) {
    if (e instanceof KurumeraError && e.status === 404) notFound();
    throw e;
  }

  const html = (page.body_html as string) ?? "";
  return (
    <article className="section prose">
      <h1 className="section__title">{page.title}</h1>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
