import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { BrandMark } from "@/components/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { dashboardPathFor, type AppRole } from "@/hooks/useAuth";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create your AptPilot account" },
      {
        name: "description",
        content:
          "Register on AptPilot as an owner, manager or tenant to start managing your apartment building.",
      },
      { property: "og:title", content: "Create your AptPilot account" },
      {
        property: "og:description",
        content: "Register as an owner, manager or tenant and get started with AptPilot.",
      },
    ],
  }),
  component: RegisterPage,
});

const schema = z
  .object({
    full_name: z.string().trim().min(2, { message: "Enter your full name" }).max(120),
    email: z.string().trim().email({ message: "Enter a valid email address" }).max(255),
    phone: z
      .string()
      .trim()
      .min(6, { message: "Enter a valid phone number" })
      .max(20)
      .regex(/^[0-9+\-\s]+$/, { message: "Phone number can contain digits, +, - and spaces" }),
    password: z.string().min(8, { message: "Password must be at least 8 characters" }).max(128),
    confirmPassword: z.string(),
    role: z.enum(["owner", "manager", "tenant"]),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    role: "tenant" as AppRole,
  });
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check your details");
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/login`,
        data: {
          full_name: parsed.data.full_name,
          phone: parsed.data.phone,
          role: parsed.data.role,
        },
      },
    });
    setSubmitting(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!data.session) {
      setEmailSent(true);
      return;
    }

    toast.success("Account created");
    navigate({ to: dashboardPathFor(parsed.data.role), replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex max-w-6xl items-center px-4 py-5 sm:px-6">
        <BrandMark />
      </div>
      <main className="mx-auto w-full max-w-xl px-4 pb-16 sm:px-6">
        <div className="panel p-6 sm:p-8">
          {emailSent ? (
            <div>
              <h1 className="text-2xl font-semibold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                We sent a confirmation link to <strong>{form.email}</strong>. Confirm your address,
                then log in to reach your dashboard.
              </p>
              <Button asChild className="mt-6">
                <Link to="/login">Go to log in</Link>
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-semibold">Create your account</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Tell us who you are and how you use your building.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input
                    id="full_name"
                    value={form.full_name}
                    onChange={(event) => update("full_name", event.target.value)}
                    maxLength={120}
                    autoComplete="name"
                    required
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(event) => update("email", event.target.value)}
                      maxLength={255}
                      autoComplete="email"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="01XXXXXXXXX"
                      value={form.phone}
                      onChange={(event) => update("phone", event.target.value)}
                      maxLength={20}
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={form.password}
                      onChange={(event) => update("password", event.target.value)}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm password</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={form.confirmPassword}
                      onChange={(event) => update("confirmPassword", event.target.value)}
                      maxLength={128}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={form.role}
                    onValueChange={(value) => update("role", value as AppRole)}
                  >
                    <SelectTrigger id="role">
                      <SelectValue placeholder="Select your role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner</SelectItem>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="tenant">Tenant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? "Creating account…" : "Create account"}
                </Button>
              </form>

              <p className="mt-6 text-sm text-muted-foreground">
                Already registered?{" "}
                <Link to="/login" className="font-semibold text-primary hover:underline">
                  Log in
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
