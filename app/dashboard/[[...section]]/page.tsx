import { Dashboard } from "@/components/account";
import { notFound } from "next/navigation";
export const metadata = {
  title: "Your account",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section } = await params;
  const selected = section?.[0] || "overview";
  if (
    (section?.length || 0) > 1 ||
    !["overview", "videos", "billing"].includes(selected)
  )
    notFound();
  return (
    <main className="page-container" id="main">
      <Dashboard section={selected} />
    </main>
  );
}
