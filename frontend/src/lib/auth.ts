import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

/**
 * Creates an HS256 JWT compatible with the FastAPI backend's python-jose decoder.
 * Uses Node.js built-in crypto — no additional dependencies.
 * NEXTAUTH_SECRET **must** equal the backend SECRET_KEY env var or FastAPI will
 * reject every request with 401.
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

// Fail loudly at module load time so the Vercel function log shows the problem
// rather than surfacing as a silent "Invalid email or password".
const _NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
if (!_NEXTAUTH_SECRET) {
  console.error(
    "[auth] FATAL: NEXTAUTH_SECRET is not set. " +
    "NextAuth cannot sign or verify JWTs. " +
    "Set NEXTAUTH_SECRET in Vercel Environment Variables " +
    "to the same value as SECRET_KEY on Render. " +
    "Generate one with: openssl rand -base64 32"
  );
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  secret: _NEXTAUTH_SECRET,
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

        // Development-only mock admin — never entered in production (NODE_ENV=production).
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
          const email = credentials.email.toLowerCase().trim();
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user) {
            console.log("[auth] authorize: no user found for", email);
            return null;
          }
          const valid = await bcrypt.compare(credentials.password, user.password);
          if (!valid) {
            console.log("[auth] authorize: wrong password for", email);
            return null;
          }
          console.log("[auth] authorize: OK for", email, "role:", user.role);
          return { id: user.id, email: user.email, name: user.name ?? "", role: user.role };
        } catch (err) {
          // Log the real error — this appears in Vercel's function logs and makes
          // "Invalid email or password" diagnosable instead of mysterious.
          console.error("[auth] authorize: unexpected error:", err);
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
        // Sign a FastAPI-compatible HS256 token.
        // NEXTAUTH_SECRET must equal the backend SECRET_KEY or FastAPI will 401.
        if (!_NEXTAUTH_SECRET) {
          console.error("[auth] jwt: NEXTAUTH_SECRET missing — backendToken will be invalid");
        }
        token.backendToken = createBackendJWT(
          {
            sub: user.id,
            email: token.email ?? "",
            role: (user as { role: string }).role,
          },
          _NEXTAUTH_SECRET ?? ""
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
