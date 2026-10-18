"use client";
import { useEffect, useState } from "react";
import { Check, ArrowUpRight, Loader2 } from "lucide-react";
import { PACKAGES } from "@/lib/catalog";
import { Button } from "./ui/button";
export function Pricing({
  mock: initialMock = false,
  standalone = false,
}: {
  mock?: boolean;
  standalone?: boolean;
}) {
  const [mock, setMock] = useState(initialMock);
  const [payments, setPayments] = useState(false);
  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c: any) => {
        setMock(c.mock);
        setPayments(c.payments);
      })
      .catch(() => {});
  }, []);
  const Heading = standalone ? "h1" : "h2";
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function buy(id: string) {
    setBusy(id);
    setError("");
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: id }),
      });
      const d: any = await r.json();
      if (r.status === 401) {
        location.href = "/login?next=/pricing";
        return;
      }
      if (!r.ok) throw new Error(d.error);
      location.href = d.url;
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section id="pricing" className="section pricing">
      <div className="section-head">
        <span className="eyebrow">A LITTLE CREDIT GOES A LONG WAY</span>
        <Heading>Your duo. Your resolution.</Heading>
        <p>One-time credit packs. No subscriptions. No expiry.</p>
        <span className="status-note">
          {mock
            ? "Local demo · test credits only, no payment"
            : payments
              ? "One-time purchases · secure checkout"
              : "Planned pricing · purchases are not yet available"}
        </span>
      </div>
      <div className="pricing-grid">
        {PACKAGES.map((p, i) => (
          <article
            className={"plan " + (i === 1 ? "plan-featured" : "")}
            key={p.id}
          >
            <div className="plan-top">
              <h3>{p.name}</h3>
              {i === 1 && <span className="plan-tag">THE SWEET SPOT</span>}
            </div>
            <p>{p.description}</p>
            <div className="price">
              ${(p.cents / 100).toFixed(2)}
              <span> / one time</span>
            </div>
            <div className="plan-credits">{p.credits} credits</div>
            <ul>
              <li>
                <Check size={16} />
                Up to {p.resolution} resolution
              </li>
              <li>
                <Check size={16} />
                Credits never expire
              </li>
              <li>
                <Check size={16} />
                Private video downloads
              </li>
              <li>
                <Check size={16} />
                Keep your resolution access*
              </li>
            </ul>
            <Button
              variant={i === 1 ? "default" : "outline"}
              disabled={!!busy}
              onClick={() => buy(p.id)}
            >
              {busy === p.id ? (
                <Loader2 className="spin" size={17} />
              ) : (
                <>
                  {mock
                    ? "Try " + p.name + " test pack"
                    : payments
                      ? "Get " + p.name
                      : "View availability"}
                  <ArrowUpRight size={17} />
                </>
              )}
            </Button>
          </article>
        ))}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="pricing-note">
        Per video: 480p · 100 credits &nbsp; / &nbsp; 720p · 200 credits &nbsp;
        / &nbsp; 1080p · 500 credits
        <br />
        *Higher packs unlock higher resolutions. Refunds and chargebacks can
        affect access. Final video specifications require live validation.
      </p>
    </section>
  );
}
