import { notFound } from "next/navigation";
import { Login, PricingPage, Checkout } from "@/components/account";
import { LEGAL } from "@/lib/legal";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return {
    title:
      LEGAL[slug]?.title ||
      { pricing: "Pricing", login: "Sign in", checkout: "Checkout" }[slug] ||
      "Page",
    alternates: { canonical: "/" + slug },
    ...(["login", "checkout"].includes(slug)
      ? { robots: { index: false, follow: false } }
      : {}),
  };
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const legal = LEGAL[slug];
  if (!legal && !["pricing", "login", "checkout"].includes(slug)) notFound();
  return (
    <main className="page-container" id="main">
      {slug === "pricing" ? (
        <PricingPage />
      ) : slug === "login" ? (
        <Login />
      ) : slug === "checkout" ? (
        <Checkout />
      ) : (
        <article className="prose">
          <span className="eyebrow">SMALLTOWN BOY AI</span>
          <h1 style={{ marginTop: 18 }}>{legal.title}</h1>
          <p>{legal.intro}</p>
          {legal.sections.map(([title, content]) => (
            <section key={title}>
              <h2>{title}</h2>
              <p>{content}</p>
            </section>
          ))}
          <p style={{ marginTop: 30 }}>
            <a href="mailto:support@smalltownboyai.one">
              support@smalltownboyai.one
            </a>
          </p>
        </article>
      )}
    </main>
  );
}
