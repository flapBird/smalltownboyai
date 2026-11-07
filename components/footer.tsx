import Link from "next/link";
import { Brand } from "@/components/brand";
export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <Brand />
        <nav className="footer-links" aria-label="Footer">
          {[
            ["Privacy", "/privacy"],
            ["Terms", "/terms"],
            ["Refunds", "/refund-policy"],
            ["Acceptable use", "/acceptable-use"],
            ["Contact", "/contact"],
          ].map(([n, p]) => (
            <Link key={p} href={p}>
              {n}
            </Link>
          ))}
        </nav>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Smalltown Boy AI</span>
        <p>
          Independent project. Not affiliated with the original song or its
          artists.
        </p>
      </div>
    </footer>
  );
}
