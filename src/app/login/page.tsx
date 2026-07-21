"use client";

import { useActionState } from "react";
import { loginAction, type AuthActionState } from "@/server/actions/auth";
import { buttonClass, Field, inputClass, Panel } from "@/components/ui";

const initial: AuthActionState = {};

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, initial);

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--surface) px-3">
      <div className="w-full max-w-xs">
        <p className="text-center text-[10px] font-semibold tracking-[0.16em] text-(--muted) uppercase">
          Mapps Creation
        </p>
        <h1 className="mt-0.5 text-center text-xl font-semibold tracking-tight">
          RFD ERP
        </h1>
        <Panel className="mt-3" compact>
          <form action={action} className="space-y-1.5">
            <Field label="Email">
              <input
                className={inputClass}
                name="email"
                type="email"
                defaultValue="owner@mapps.local"
                required
              />
            </Field>
            <Field label="Password">
              <input
                className={inputClass}
                name="password"
                type="password"
                defaultValue="mapps123"
                required
              />
            </Field>
            {state.error ? (
              <p className="text-[12px] text-(--danger)">{state.error}</p>
            ) : null}
            <button className={`${buttonClass} w-full`} disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </Panel>
      </div>
    </div>
  );
}
