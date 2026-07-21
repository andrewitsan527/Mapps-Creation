"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSession,
  destroySession,
  verifyPassword,
} from "@/lib/auth";
import { prisma } from "@/lib/db";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(4),
});

export type AuthActionState = {
  error?: string;
};

export async function loginAction(
  _prev: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password" };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  if (!user || !user.active) {
    return { error: "Invalid email or password" };
  }

  const ok = await verifyPassword(parsed.data.password, user.passwordHash);
  if (!ok) {
    return { error: "Invalid email or password" };
  }

  await createSession(user.id);
  redirect("/dashboard");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
