import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

const _NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
if (!_NEXTAUTH_SECRET) {
  console.error(
    "[auth] FATAL: NEXTAUTH_SECRET is not set. " +
    "NextAuth cannot sign or verify session JWTs. " +
    "Set NEXTAUTH_SECRET in Vercel Environment Variables. " +
    "Generate one with: openssl rand -base64 32"
  );
}

// In production, fall back to the known Render deployment when NEXT_PUBLIC_API_URL
// is not configured — so the app works on Vercel without any env var changes.
// Set NEXT_PUBLIC_API_URL to override (e.g. a different Render service or local dev).
const _API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  (process.env.NODE_ENV === "production"
    ? "https://sentinel-ai-2uo3.onrender.com"
    : "http://localhost:8000");

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

        // Development-only mock admin so the app is usable without a running backend.
        // Never active in production (NODE_ENV=production on Vercel).
        if (process.env.NODE_ENV === "development") {
          const email = credentials.email.toLowerCase().trim();
          if (email === "admin@gmail.com" && credentials.password === "Admin@123") {
            return {
              id: "mock-admin-001",
              email: "admin@gmail.com",
              name: "Admin User",
              role: "ADMIN",
              _backendToken: "",
            };
          }
        }

        try {
          const res = await fetch(`${_API_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email.toLowerCase().trim(),
              password: credentials.password,
            }),
          });

          if (!res.ok) {
            console.log("[auth] authorize: backend returned", res.status, "for", credentials.email);
            return null;
          }

          const data = await res.json() as {
            access_token: string;
            user: { id: string; email: string; name: string; role: string };
          };
          console.log("[auth] authorize: OK for", data.user.email, "role:", data.user.role);

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name ?? "",
            role: data.user.role,
            _backendToken: data.access_token,
          };
        } catch (err) {
          console.error("[auth] authorize: unexpected error calling", _API_URL, "—", err);
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
        token.backendToken = (user as { _backendToken?: string })._backendToken ?? "";
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
