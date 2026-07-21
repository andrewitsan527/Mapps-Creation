"use client";

import { useActionState } from "react";
import { MessageCircle, ShieldCheck } from "lucide-react";
import { loginAction, type AuthActionState } from "@/server/actions/auth";
import { buttonClass, Field, inputClass } from "@/components/ui";

const initial: AuthActionState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <div className="login-weave relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      <div
        className="pointer-events-none absolute -left-16 top-16 h-56 w-56 rounded-full bg-(--accent)/30 blur-3xl"
        style={{ animation: "soft-pulse 6s ease-in-out infinite" }}
      />
      <div
        className="pointer-events-none absolute -right-10 bottom-10 h-64 w-64 rounded-full bg-(--copper)/25 blur-3xl"
        style={{ animation: "soft-pulse 7s ease-in-out infinite 1s" }}
      />

      <div className="animate-fade-up relative z-10 w-full max-w-md">
        <div className="mb-6 text-center text-white">
          <p className="font-serif text-[42px] leading-none tracking-tight sm:text-[48px]">
            Mapps Creation
          </p>
          <p className="mt-2 text-[13px] text-white/70">
            RFD fabric operations — grey to mill, QC, stock, sale, delivery.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/95 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-(--muted) uppercase">
                Secure sign in
              </p>
              <h1 className="mt-0.5 text-[18px] font-semibold tracking-tight text-(--ink)">
                Operations desk
              </h1>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-(--accent-soft) px-2 py-1 text-[10px] font-semibold text-(--accent-strong)">
              <ShieldCheck className="h-3 w-3" />
              ERP
            </span>
          </div>

          <form action={action} className="space-y-2.5">
            <Field label="Email">
              <input
                className={inputClass}
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@mapps.local"
                required
              />
            </Field>
            <Field label="Password">
              <input
                className={inputClass}
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            {state.error ? (
              <p className="rounded-md bg-(--danger-soft) px-2 py-1.5 text-[12px] text-(--danger)">
                {state.error}
              </p>
            ) : null}
            <button className={`${buttonClass} w-full py-2`} disabled={pending}>
              {pending ? "Signing in…" : "Enter workspace"}
            </button>
          </form>

          <p className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-(--muted)">
            <MessageCircle className="h-3 w-3 text-(--wa)" />
            WhatsApp workflows for mill, delivery & payment reminders
          </p>
        </div>
      </div>
    </div>
  );
}
