import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { BrandMark } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — AptPilot" },
      {
        name: "description",
        content:
          "Request a secure password reset link for your AptPilot owner, manager or tenant account.",
      },
      { property: "og:title", content: "Reset your password — AptPilot" },
      {
        property: "og:description",
        content: "Request a password reset link for your AptPilot account.",
      },
    ],
  }),
  component: ForgotPasswordPage,
});

const schema = z.object({
  email: z.string().trim().email({ message: "Enter a valid email address" }).max(255),
});

const GENERIC_MESSAGE =
  "If an account exists for this email, a password reset link has been sent.";

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (status === "sending" || cooldown > 0) return;

    const parsed = schema.safeParse({ email });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Enter a valid email address");
      return;
    }

    setStatus("sending");
    try {
      // Redirect target is always this app's own reset route — never user input.
      await supabase.auth.resetPasswordForEmail(parsed.data.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      // Never surface provider errors: they can reveal whether an account exists.
      setStatus("sent");
      setCooldown(45);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-6xl items-center px-4 py-5 sm:px-6">
        <BrandMark />
      </div>
      <main className="mx-auto w-full max-w-md px-4 pb-16 sm:px-6">
        <div className="panel p-6 sm:p-8">
          <h1 className="text-2xl font-semibold">Forgot password</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enter your account email and we'll send a secure reset link.
          </p>

          {status === "sent" ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-xl border border-border/60 bg-secondary p-4 text-sm">
                {GENERIC_MESSAGE}
              </div>
              <p className="text-xs text-muted-foreground">
                The link expires shortly for your security. Check your spam folder if it
                doesn't arrive.
              </p>
              <Button
                variant="outline"
                className="w-full"
                disabled={cooldown > 0}
                onClick={() => setStatus("idle")}
              >
                {cooldown > 0 ? `Resend available in ${cooldown}s` : "Send another link"}
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/login">Back to login</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={255}
                  required
                />
              </div>

              {status === "error" ? (
                <p className="text-sm text-destructive">
                  We couldn't reach the server. Check your connection and try again.
                </p>
              ) : null}

              <Button
                type="submit"
                className="w-full"
                disabled={status === "sending" || cooldown > 0}
              >
                {status === "sending"
                  ? "Sending…"
                  : cooldown > 0
                    ? `Try again in ${cooldown}s`
                    : "Send reset link"}
              </Button>

              <Button asChild variant="ghost" className="w-full">
                <Link to="/login">Back to login</Link>
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
