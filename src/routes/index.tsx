import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, ClipboardList, Receipt, ShieldCheck, Users, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PublicHeader } from "@/components/navigation";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AptPilot — Smart Apartment Building Management" },
      {
        name: "description",
        content:
          "AptPilot digitises apartment building management in Bangladesh, connecting owners, managers and tenants in one calm workspace.",
      },
      { property: "og:title", content: "AptPilot — Smart Apartment Building Management" },
      {
        property: "og:description",
        content:
          "One platform for owners, managers and tenants: records, requests and reporting without the paperwork.",
      },
    ],
  }),
  component: Landing,
});

const roles = [
  {
    icon: Building2,
    title: "Owners",
    body: "See your buildings, managers and tenants in one place with a clear record of everything that happens.",
    tone: "bg-sage-light",
  },
  {
    icon: ClipboardList,
    title: "Managers",
    body: "Run day-to-day building operations from a single workspace instead of notebooks and group chats.",
    tone: "bg-peach",
  },
  {
    icon: Users,
    title: "Tenants",
    body: "Keep your flat details, notices and requests together, accessible from your phone.",
    tone: "bg-lavender",
  },
];

const features = [
  { icon: ShieldCheck, title: "Secure by role", body: "Every account only sees what it should." },
  {
    icon: Receipt,
    title: "Built for Bangladesh",
    body: "Designed around how buildings here work.",
  },
  { icon: Wrench, title: "Grows with you", body: "Operations modules arrive step by step." },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />

      <main>
        <section className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <div>
              <span className="inline-flex items-center rounded-full bg-accent px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent-foreground">
                Apartment management, digitised
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl">
                The calm way to run an apartment building
              </h1>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted-foreground">
                AptPilot replaces scattered registers, receipts and phone calls with one shared
                workspace for owners, managers and tenants.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/register">Create your account</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/login">I already have an account</Link>
                </Button>
              </div>
            </div>

            <div className="panel p-6 sm:p-8">
              <h2 className="font-display text-lg font-semibold">Three roles, one platform</h2>
              <ul className="mt-5 space-y-4">
                {roles.map((role) => (
                  <li key={role.title} className="flex gap-4">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${role.tone} text-foreground`}
                    >
                      <role.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold">{role.title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{role.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-y border-border/60 bg-surface">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-12 sm:grid-cols-3 sm:px-6">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-xl bg-card p-5 shadow-card">
                <feature.icon className="h-5 w-5 text-primary" />
                <p className="mt-3 text-sm font-semibold">{feature.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{feature.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted-foreground sm:px-6">
        © {new Date().getFullYear()} AptPilot. Built for apartment buildings in Bangladesh.
      </footer>
    </div>
  );
}
