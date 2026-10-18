import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-top">
        <div>
          <Link className="brand" href="/">
            Smalltown Boy <span>AI</span>
          </Link>
          <p>A little mischief. A lot of personality.</p>
        </div>
        <a href="mailto:support@smalltownboyai.one">
          support@smalltownboyai.one <ArrowUpRight size={15} />
        </a>
      </div>
      <div className="footer-bottom">
        <span>© {new Date().getFullYear()} Smalltown Boy AI</span>
        <div>
          {[
            ["Privacy", "/privacy"],
            ["Terms", "/terms"],
            ["Refunds", "/refund-policy"],
            ["Acceptable use", "/acceptable-use"],
            ["Contact & report", "/contact"],
          ].map(([n, p]) => (
            <Link key={p} href={p}>
              {n}
            </Link>
          ))}
        </div>
      </div>
      <p className="fineprint">
        Independent project. Not affiliated with the original song or its
        artists. Concept imagery is AI-generated. No commercial soundtrack is
        included.
      </p>
    </footer>
  );
}
