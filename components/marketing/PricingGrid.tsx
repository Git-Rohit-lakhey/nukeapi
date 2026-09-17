"use client";

import { useState } from "react";
import Link from "next/link";
import { PLANS } from "@/lib/constants/compliance";

type Billing = "monthly" | "annual";

interface PricingGridProps {
  /** "marketing" → CTA links to /signup. "billing" → calls onSelect. */
  mode?: "marketing" | "billing";
  /** Currently active plan slug (billing mode highlights/disabled it). */
  currentPlan?: string;
  /** Called with (basePlan, billing) when a card is chosen in billing mode. */
  onSelect?: (plan: string, billing: "monthly" | "yearly") => void;
}

const ORDER = ["free", "startup", "business", "enterprise"] as const;

export default function PricingGrid({
  mode = "marketing",
  currentPlan = "free",
  onSelect,
}: PricingGridProps) {
  // Annual is the prioritized default (2 months free).
  const [billing, setBilling] = useState<Billing>("annual");

  return (
    <div>
      {/* Monthly / Annual toggle + savings badge */}
      <div className="flex items-center gap-16 wrap" style={{ marginBottom: 28 }}>
        <div
          className="flex"
          style={{ border: "1px solid var(--b2)", borderRadius: 10, overflow: "hidden" }}
          role="group"
          aria-label="Billing period"
        >
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            aria-pressed={billing === "monthly"}
            className="btn-sm"
            style={{
              borderRadius: 0,
              border: "none",
              background: billing === "monthly" ? "var(--lime)" : "transparent",
              color: billing === "monthly" ? "var(--void)" : "var(--t2)",
              fontWeight: 700,
            }}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling("annual")}
            aria-pressed={billing === "annual"}
            className="btn-sm"
            style={{
              borderRadius: 0,
              border: "none",
              background: billing === "annual" ? "var(--lime)" : "transparent",
              color: billing === "annual" ? "var(--void)" : "var(--t2)",
              fontWeight: 700,
            }}
          >
            Annual
          </button>
        </div>
        <span className="badge badge-lime">2 months free</span>
      </div>

      <div className="grid grid-4">
        {ORDER.map((slug) => {
          const def = PLANS[slug];
          const isFeatured = slug === "business";
          const isFree = slug === "free";
          const isCurrent =
            currentPlan === slug ||
            currentPlan === `${slug}_yearly` ||
            currentPlan === `${slug}_monthly`;
          const price = billing === "annual" ? def.priceYearly : def.priceMonthly;
          const period = billing === "annual" ? "/yr" : "/mo";
          const monthlyEquiv =
            billing === "annual" && !isFree
              ? `$${(def.priceYearly / 12).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}/mo billed annually · 2 months free`
              : null;

          return (
            <div
              className={`card card-hover${isFeatured ? " card-featured" : ""}${isCurrent ? " card-featured" : ""}`}
              key={slug}
              style={{ display: "flex", flexDirection: "column", position: "relative" }}
            >
              {isFeatured && (
                <span className="badge badge-lime" style={{ marginBottom: 12, alignSelf: "flex-start" }}>
                  <span className="dot" />Most popular
                </span>
              )}
              {isCurrent && mode === "billing" && (
                <span className="badge badge-success" style={{ marginBottom: 12, alignSelf: "flex-start" }}>current</span>
              )}
              <h3 style={{ fontSize: 17, letterSpacing: "-.01em", marginBottom: 6 }}>{def.label}</h3>
              <div className="stat" style={{ fontSize: 30, letterSpacing: "-.03em" }}>
                {isFree ? "Free" : `$${price.toLocaleString("en-US")}`}
                {!isFree && <span className="dim" style={{ fontSize: 13, fontWeight: 500 }}>{period}</span>}
              </div>
              {monthlyEquiv && (
                <div className="dim" style={{ fontSize: 12, marginTop: 4 }}>
                  {monthlyEquiv}
                </div>
              )}
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "16px 0 20px",
                  fontSize: 13.5,
                  color: "var(--t2)",
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <li><span style={{ color: "var(--lime)", marginRight: 8 }}>✓</span>{def.includedDeletions === Infinity ? "Unlimited" : def.includedDeletions} deletions/mo</li>
                <li><span style={{ color: "var(--lime)", marginRight: 8 }}>✓</span>{def.maxIntegrations === Infinity ? "Unlimited integrations" : `Up to ${def.maxIntegrations} integrations`}</li>
                {def.overageRate ? <li><span style={{ color: "var(--lime)", marginRight: 8 }}>✓</span>${def.overageRate}/extra deletion</li> : <li><span style={{ color: "var(--lime)", marginRight: 8 }}>✓</span>No overage fees</li>}
                {!isFree && <li><span style={{ color: "var(--lime)", marginRight: 8 }}>✓</span>Signed PDF audit trail</li>}
              </ul>

              {mode === "marketing" ? (
                <Link
                  href="/signup"
                  className={isFeatured ? "btn btn-primary" : "btn"}
                  style={{ width: "100%" }}
                >
                  {isFree ? "Start free" : "Choose " + def.label}
                </Link>
              ) : (
                <button
                  type="button"
                  className={isFeatured ? "btn btn-primary" : "btn"}
                  style={{ width: "100%" }}
                  disabled={isCurrent}
                  onClick={() => onSelect?.(slug, billing === "annual" ? "yearly" : "monthly")}
                >
                  {isCurrent
                    ? "Current plan"
                    : isFree
                      ? "Downgrade to free"
                      : `Upgrade ${def.label}`}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
