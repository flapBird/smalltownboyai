import Link from "next/link";

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Smalltown Boy AI home">
      <img src="/icon.svg" width={32} height={32} alt="" className="brand-icon" />
      <span className="brand-name">
        Smalltown Boy <span className="brand-accent">AI</span>
      </span>
    </Link>
  );
}
