"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Menu,
  X,
  ArrowUpRight,
  Coins,
  Plus,
  UserRound,
  Clapperboard,
  Receipt,
  LogOut,
} from "lucide-react";
import { Brand } from "@/components/brand";
type Account = {
  name: string;
  email?: string;
  image?: string | null;
  wallet: { balance: number };
};
export function Header() {
  const account = useRef<HTMLDetailsElement>(null);
  const [signingOut, setSigningOut] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [avatarFailed, setAvatarFailed] = useState(false);
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (account.current && !account.current.contains(e.target as Node))
        account.current.open = false;
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && account.current?.open) {
        account.current.open = false;
        account.current.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  async function signOut() {
    setSigningOut(true);
    setAccountError("");
    try {
      const r = await fetch("/api/logout", { method: "POST" });
      if (!r.ok) throw new Error();
      location.href = "/";
    } catch {
      setAccountError("Couldn’t sign out. Please try again.");
      setSigningOut(false);
    }
  }

  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<Account | null>(null);
  useEffect(() => {
    const refresh = () =>
      fetch("/api/me")
        .then((r) => (r.ok ? (r.json() as Promise<Account>) : null))
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
  const balance = user?.wallet.balance.toLocaleString();
  const closeAccount = () => {
    if (account.current) account.current.open = false;
  };
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Brand />
        <nav aria-label="Main navigation" className={open ? "nav open" : "nav"}>
          {[
            ["Templates", "/#templates"],
            ["Create", "/#create"],
            ["Pricing", "/pricing"],
            ["How it works", "/#how-to"],
            ...(user ? [] : [["My Videos", "/dashboard/videos"]]),
          ].map(([name, path]) => (
            <Link key={name} href={path} onClick={() => setOpen(false)}>
              {name}
            </Link>
          ))}
        </nav>
        <div className="nav-end">
          {user ? (
            <div className="account-tools">
              <Link
                href="/pricing"
                className="account-wallet"
                aria-label={`${balance} credits available. Buy credits`}
                title="Buy credits"
                onClick={() => setOpen(false)}
              >
                <Coins size={15} aria-hidden="true" />
                <span className="account-wallet-amount">{balance}</span>
                <span className="account-wallet-label">credits</span>
                <Plus
                  className="account-wallet-add"
                  size={14}
                  aria-hidden="true"
                />
              </Link>
              <Link
                href="/dashboard/videos"
                className="account-videos-link"
                aria-label="My Videos"
                onClick={() => setOpen(false)}
              >
                <Clapperboard size={16} aria-hidden="true" />
                <span>My Videos</span>
              </Link>
              <details className="account-menu" ref={account}>
                <summary
                  aria-label="Open account menu"
                  onClick={() => setOpen(false)}
                >
                  <span className="account-avatar">
                    {user.image && !avatarFailed ? (
                      <img
                        src={user.image}
                        alt=""
                        referrerPolicy="no-referrer"
                        onError={() => setAvatarFailed(true)}
                      />
                    ) : (
                      (user.name.trim()[0] || "U").toUpperCase()
                    )}
                  </span>
                </summary>
                <div className="account-dropdown">
                  <div className="account-identity">
                    <strong>{user.name || "My account"}</strong>
                    {user.email && <span>{user.email}</span>}
                  </div>
                  <nav aria-label="Account navigation">
                    <Link href="/dashboard/videos" onClick={closeAccount}>
                      <Clapperboard size={16} /> My Videos
                    </Link>
                    <Link
                      href="/pricing"
                      className="account-buy-link"
                      onClick={closeAccount}
                    >
                      <Coins size={16} /> Buy credits{" "}
                      <ArrowUpRight className="account-buy-arrow" size={14} />
                    </Link>
                    <Link href="/dashboard" onClick={closeAccount}>
                      <UserRound size={16} /> Account overview
                    </Link>
                    <Link href="/dashboard/billing" onClick={closeAccount}>
                      <Receipt size={16} /> Billing
                    </Link>
                  </nav>
                  <button
                    className="account-signout"
                    onClick={signOut}
                    disabled={signingOut}
                  >
                    <LogOut size={16} />
                    {signingOut ? "Signing out…" : "Sign out"}
                  </button>
                  {accountError && (
                    <p role="alert" className="account-error">
                      {accountError}
                    </p>
                  )}
                </div>
              </details>
            </div>
          ) : (
            <Link className="login-link" href="/login">
              <UserRound size={16} /> Sign in <ArrowUpRight size={15} />
            </Link>
          )}
          <button
            className="menu-toggle"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => {
              setOpen(!open);
              if (account.current) account.current.open = false;
            }}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
