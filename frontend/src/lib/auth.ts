import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Creates an HS256 JWT compatible with the FastAPI backend's python-jose decoder.
 * Uses Node.js built-in crypto — no additional dependencies.
 * The secret MUST match the backend's SECRET_KEY env var.
 */
function createBackendJWT(
  payload: Record<string, unknown>,
  secret: string
): string {
  const b64url = (str: string) =>
    Buffer.from(str)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = b64url(
    JSON.stringify({ ...payload, iat: now, exp: now + 7 * 24 * 3600 })
  );
  const data = `${header}.${body}`;
  const sig = createHmac("sha256", secret)
    .update(data)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
  return `${data}.${sig}`;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Development-only mock admin — removed in production builds automatically
        // because NODE_ENV is "production" and this branch is never entered.
        if (process.env.NODE_ENV === "development") {
          const email = credentials.email.toLowerCase().trim();
          if (email === "admin@sentinel.local" && credentials.password === "Admin@123") {
            return {
              id: "mock-admin-001",
              email: "admin@sentinel.local",
              name: "System Administrator",
              role: "ADMIN",
            };
          }
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email.toLowerCase().trim() },
          });
          if (!user) return null;
          const valid = await bcrypt.compare(credentials.password, user.password);
          if (!valid) return null;
          return { id: user.id, email: user.email, name: user.name ?? "", role: user.role };
        } catch {
          return null;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        // Generate a FastAPI-compatible HS256 JWT once on login.
        // NEXTAUTH_SECRET must equal the backend SECRET_KEY for validation to pass.
        token.backendToken = createBackendJWT(
          {
            sub: user.id,
            email: token.email ?? "",
            role: (user as { role: string }).role,
          },
          process.env.NEXTAUTH_SECRET ?? ""
        );
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      session.accessToken = token.backendToken as string | undefined;
      return session;
    },
  },
};
