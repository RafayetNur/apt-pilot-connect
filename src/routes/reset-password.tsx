import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { BrandMark } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password — AptPilot" },
      {
        name: "description",
        content: "Choose a new password for your AptPilot account using your secure reset link.",
      },
      { property: "og:title", content: "Set a new password — AptPilot" },
      {
        property: "og:description",
        content: "Choose a new password for your AptPilot account.",
      },
    ],
  }),
  component: ResetPasswordPage,
});

type Phase = "validating" | "ready" | "invalid" | "updating" | "done";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("validating");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setPhase((current) => (current === "validating" ? "ready" : current));
      }
    });

    void (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const code = url.searchParams.get("code");

      // PKCE-style link: exchange the one-time code for a recovery session.
      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!active) return;
        setPhase(exchangeError ? "invalid" : "ready");
        return;
      }

      // Implicit-style link: tokens arrive in the URL fragment.
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      if (accessToken && refreshToken) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!active) return;
        setPhase(sessionError ? "invalid" : "ready");
        return;
      }

      if (hash.get("error") || url.searchParams.get("error")) {
        if (active) setPhase("invalid");
        return;
      }

      // Fall back to a session already established by the SDK from the link.
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      setPhase(data.session ? "ready" : "invalid");
    })();

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords do not match.");
      return;
    }

    setPhase("updating");
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setPhase("ready");
      return;
    }

    setPhase("done");
    toast.success("Password updated");
    await supabase.auth.signOut();
    window.setTimeout(() => navigate({ to: "/login", replace: true }), 1200);
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-6xl items-center px-4 py-5 sm:px-6">
        <BrandMark />
      </div>
      <main className="mx-auto w-full max-w-md px-4 pb-16 sm:px-6">
        <div className="panel p-6 sm:p-8">
          <h1 className="text-2xl font-semibold">Set a new password</h1>

          {phase === "validating" ? (
            <p className="mt-4 text-sm text-muted-foreground">Checking your reset link…</p>
          ) : phase === "invalid" ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-destructive">This reset link is invalid or expired.</p>
              <Button asChild className="w-full">
                <Link to="/forgot-password">Request a new link</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/login">Back to login</Link>
              </Button>
            </div>
          ) : phase === "done" ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-border/60 bg-secondary p-4 text-sm">
                Your password has been updated. Taking you to the login page…
              </div>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/login">Go to login now</Link>
              </Button>
            </div>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a password with at least 8 characters.
              </p>
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">New password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      maxLength={128}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <div className="relative">
                    <Input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      maxLength={128}
                      className="pr-10"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((value) => !value)}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showConfirm ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {error ? <p className="text-sm text-destructive">{error}</p> : null}

                <Button type="submit" className="w-full" disabled={phase === "updating"}>
                  {phase === "updating" ? "Updating…" : "Update password"}
                </Button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
