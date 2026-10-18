import { Admin } from "@/components/account";
export const metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};
export default function Page() {
  return (
    <main className="page-container" id="main">
      <Admin />
    </main>
  );
}
