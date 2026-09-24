"use client";

import { useActionState } from "react";
import { loginAction, type AuthActionState } from "@/server/actions/auth";
import { buttonClass, Field } from "@/components/ui";
import { LoginRecord } from "./login-record";

const initial: AuthActionState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <div className="login-weave relative flex min-h-svh items-center justify-center px-4 py-6">
      <LoginRecord />
      <div className="relative z-10 w-full max-w-[440px]">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full border border-[#c9a227]/70 bg-[#0c0a08] font-serif text-[14px] font-bold tracking-wide text-[#e8c547]">
            MC
          </span>
          <h1 className="font-serif text-[30px] font-semibold leading-none tracking-tight text-white">
            Mapps Creation
          </h1>
          <div className="login-gold-line mx-auto mt-5 max-w-[88px]" />
        </div>

        <div className="login-panel mx-auto w-full max-w-[368px] px-6 pt-8 pb-6 sm:px-7">
          <h2 className="login-heading font-serif">Sign in</h2>

          <form action={action} className="login-form">
            <Field label="Email">
              <input
                className="login-input"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="you@mapps.local"
                required
              />
            </Field>
            <Field label="Password">
              <input
                className="login-input"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>
            {state.error ? (
              <p className="rounded-sm border border-(--danger)/25 bg-(--danger-soft) px-2.5 py-2 text-[12px] text-(--danger)">
                {state.error}
              </p>
            ) : null}
            <button
              className={`${buttonClass} login-submit`}
              disabled={pending}
            >
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
