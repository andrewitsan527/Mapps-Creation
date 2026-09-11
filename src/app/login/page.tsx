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
    <div className="login-weave relative flex min-h-screen items-center justify-center overflow-hidden px-3 py-6 sm:px-4 sm:py-8">
      <div className="animate-soft-rise relative z-10 grid w-full max-w-[880px] overflow-hidden rounded-xl border border-white/10 login-card sm:rounded-2xl lg:grid-cols-[1.08fr_1fr]">
        <div className="relative hidden flex-col justify-between overflow-hidden p-8 text-white lg:flex">
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 20% 0%, rgba(201,162,39,0.18), transparent 55%)",
            }}
          />
          <div className="relative">
            <div className="mb-5 flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-full border border-[#c9a227]/60 bg-linear-to-br from-[#2f281f] to-[#0c0a08] font-serif text-[13px] font-bold tracking-wide text-[#e8c547]">
                MC
              </span>
              <div>
                <p className="text-[10px] font-semibold tracking-[0.18em] text-white/45 uppercase">
                  Est. Surat
                </p>
                <p className="text-[11px] text-[#e8c547]/90">
                  Knitting dreams into reality
                </p>
              </div>
            </div>
            <p className="font-serif text-[44px] leading-[0.95] tracking-tight">
              Mapps
              <span className="mt-1 block text-[28px] text-white/65">
                Creation
              </span>
            </p>
            <div className="login-gold-line my-5 max-w-[220px]" />
            <p className="max-w-sm text-[13.5px] leading-relaxed text-white/68">
              One connected desk for RFD fabric — grey purchase through mill
              programs, quality, stock, sale, delivery and recovery.
            </p>
          </div>

          <div className="relative">
            <p className="mb-2.5 text-[10px] font-semibold tracking-[0.16em] text-white/40 uppercase">
              Order-to-cash
            </p>
            <ul className="flex flex-wrap items-center gap-1.5">
              {chain.map((step, i) => {
                const Icon = step.icon;
                return (
                  <li key={step.label} className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-white/10 bg-white/6 px-2 py-1 text-[11.5px] text-white/85 backdrop-blur-sm">
                      <Icon className="h-3 w-3 text-[#7ddec8]" />
                      {step.label}
                    </span>
                    {i < chain.length - 1 ? (
                      <ArrowRight className="h-3 w-3 text-white/20" />
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <p className="mt-5 flex items-center gap-1.5 text-[11.5px] text-white/50">
              <MessageCircle className="h-3.5 w-3.5 text-[#7ddec8]" />
              WhatsApp on every handoff — mill cards, bills, RF & reminders
            </p>
          </div>
        </div>

        <div className="relative bg-[#fcfdfd] p-5 sm:p-8">
          <div className="mb-5 flex items-center gap-2.5 lg:hidden">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-[#c9a227]/55 bg-linear-to-br from-[#2f281f] to-[#0c0a08] font-serif text-[11px] font-bold text-[#e8c547]">
              MC
            </span>
            <div>
              <p className="font-serif text-[18px] leading-none font-semibold tracking-tight text-(--ink)">
                Mapps Creation
              </p>
              <p className="mt-0.5 text-[10px] tracking-[0.12em] text-(--muted) uppercase">
                RFD ERP
              </p>
            </div>
          </div>

          <div className="mb-6 flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.16em] text-(--muted) uppercase">
                Secure sign in
              </p>
              <h1 className="mt-1 font-serif text-[22px] font-semibold tracking-tight text-(--ink) sm:text-[26px]">
                Operations desk
              </h1>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-(--accent)/15 bg-(--accent-soft) px-2.5 py-1 text-[10px] font-semibold text-(--accent-strong)">
              <ShieldCheck className="h-3 w-3" />
              ERP
            </span>
          </div>

          <form action={action} className="space-y-3">
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
              <p className="rounded-md border border-(--danger)/25 bg-(--danger-soft) px-2.5 py-2 text-[12px] text-(--danger)">
                {state.error}
              </p>
            ) : null}
            <button
              className={`${buttonClass} pressable w-full py-2.5 text-[13px]`}
              disabled={pending}
            >
              {pending ? "Signing in…" : "Enter workspace"}
              {pending ? null : <ArrowRight className="h-3.5 w-3.5" />}
            </button>
          </form>

          <p className="mt-6 border-t border-(--line-soft) pt-3.5 text-center text-[10.5px] text-(--faint)">
            Authorised users only · every action is logged to your account
          </p>
        </div>
      </div>
    </div>
  );
}
