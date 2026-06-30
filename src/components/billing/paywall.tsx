"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

interface Props {
  feature: string;
  description: string;
  requiredPlan: "pro" | "scale";
  slug: string;
}

export default function Paywall({ feature, description, requiredPlan, slug }: Props) {
  const planName = requiredPlan === "pro" ? "Pro" : "Scale";
  const price = requiredPlan === "pro" ? "€19/mo" : "€39/mo";

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-sm text-center space-y-5">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground mb-2">{feature}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Available on {planName} plan
          </p>
          <p className="text-2xl font-extrabold text-foreground">{price}</p>
          <p className="text-xs text-muted-foreground">per property · cancel anytime</p>
        </div>
        <div className="flex flex-col gap-2">
          <Link href={`/${slug}/settings/billing`}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white text-center transition-all"
            style={{ background: "linear-gradient(135deg, #7c3aed, #a855f7)", boxShadow: "0 4px 20px rgba(124,58,237,0.3)" }}>
            Upgrade to {planName} — {price}
          </Link>
          <Link href={`/${slug}/dashboard`}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Back to dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
