"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Menu, X, ArrowUpRight, Coins } from "lucide-react";
export function Header() {
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<{
    name: string;
    wallet: { balance: number };
  } | null>(null);
  useEffect(() => {
    const refresh = () =>
      fetch("/api/me")
        .then((r) =>
          r.ok
            ? (r.json() as Promise<{
                name: string;
                wallet: { balance: number };
              }>)
            : null,
        )
        .then(setUser)
        .catch(() => {});
    refresh();
    window.addEventListener("wallet-updated", refresh);
    window.addEventListener("focus", refresh);
    const timer = setInterval(refresh, 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("wallet-updated", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Link href="/" className="brand">
          Smalltown Boy <span>AI</span>
          <span className="brand-dot" />
        </Link>
        <nav aria-label="Main navigation" className={open ? "nav open" : "nav"}>
          {[
            ["Home", "/"],
            ["Create", "/#create"],
            ["Pricing", "/pricing"],
            ["FAQ", "/#faq"],
            ["My Videos", "/dashboard/videos"],
          ].map(([name, path]) => (
            <Link key={name} href={path} onClick={() => setOpen(false)}>
              {name}
            </Link>
          ))}
        </nav>
        <div className="nav-end">
          {user ? (
            <Link className="balance-chip" href="/dashboard">
              <Coins size={15} />
              {user.wallet.balance} credits
            </Link>
          ) : (
            <Link className="login-link" href="/login">
              Sign in <ArrowUpRight size={15} />
            </Link>
          )}
          <button
            className="menu-toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
