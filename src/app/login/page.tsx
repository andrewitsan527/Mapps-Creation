"use client";

import { useActionState } from "react";
import {
  ArrowRight,
  Banknote,
  Boxes,
  ClipboardCheck,
  MessageCircle,
  Package,
  ScrollText,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { loginAction, type AuthActionState } from "@/server/actions/auth";
import { buttonClass, Field, inputClass } from "@/components/ui";

const initial: AuthActionState = {};

const chain = [
  { icon: Package, label: "Grey" },
  { icon: ScrollText, label: "Program" },
  { icon: ClipboardCheck, label: "QC" },
  { icon: Boxes, label: "Stock" },
  { icon: Truck, label: "Delivery" },
  { icon: Banknote, label: "Payment" },
];

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <div className="login-weave relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      <div
        className="pointer-events-none absolute top-10 -left-20 h-72 w-72 rounded-full bg-(--accent)/30 blur-3xl"
        style={{ animation: "soft-pulse 6s ease-in-out infinite" }}
      />
      <div
        className="pointer-events-none absolute -right-16 bottom-6 h-80 w-80 rounded-full bg-(--copper)/25 blur-3xl"
        style={{ animation: "soft-pulse 7s ease-in-out infinite 1s" }}
      />

      <div className="animate-fade-up relative z-10 grid w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 shadow-[0_28px_70px_rgba(0,0,0,0.45)] lg:grid-cols-[1.05fr_1fr]">
        <div className="hidden flex-col justify-between bg-white/5 p-7 text-white backdrop-blur lg:flex">
          <div>
            <p className="font-serif text-[40px] leading-none tracking-tight">
              Mapps
              <span className="block text-[26px] text-white/70">Creation</span>
            </p>
            <p className="mt-4 max-w-xs text-[13px] leading-relaxed text-white/65">
              One connected desk for RFD fabric operations — grey purchase
              through mill programs, quality, stock, sale, delivery and
              recovery.
            </p>
          </div>

          <ul className="my-7 space-y-2">
            {chain.map((step, i) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.label}
                  className="flex items-center gap-2 text-[12.5px] text-white/80"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {step.label}
                  {i < chain.length - 1 ? (
                    <ArrowRight className="h-3 w-3 text-white/25" />
                  ) : null}
                </li>
              );
            })}
          </ul>

          <p className="flex items-center gap-1.5 text-[11px] text-white/50">
            <MessageCircle className="h-3.5 w-3.5 text-[#7ddec8]" />
            WhatsApp built into every handoff — mill cards, sale bills, RF
            notices and payment reminders.
          </p>
        </div>

        <div className="bg-white/95 p-6 backdrop-blur sm:p-7">
          <div className="mb-5 flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.14em] text-(--muted) uppercase">
                Secure sign in
              </p>
              <h1 className="mt-0.5 font-serif text-[22px] font-semibold tracking-tight text-(--ink)">
                Operations desk
              </h1>
              <p className="mt-1 text-[11.5px] text-(--muted) lg:hidden">
                Mapps Creation · RFD ERP
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-(--accent-soft) px-2 py-1 text-[10px] font-semibold text-(--accent-strong)">
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
              <p className="rounded-md border border-(--danger)/25 bg-(--danger-soft) px-2 py-1.5 text-[12px] text-(--danger)">
                {state.error}
              </p>
            ) : null}
            <button
              className={`${buttonClass} w-full py-2.5 text-[13px]`}
              disabled={pending}
            >
              {pending ? "Signing in…" : "Enter workspace"}
              {pending ? null : <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </form>

          <p className="mt-5 border-t border-(--line-soft) pt-3 text-center text-[10px] text-(--faint)">
            Authorised users only. Every action is logged against your account.
          </p>
        </div>
      </div>
    </div>
  );
}
