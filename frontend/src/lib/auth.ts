import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

// Fail loudly at module load so the Vercel function log surfaces the problem
// rather than a silent "Invalid email or password" on every login attempt.
const _NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;
if (!_NEXTAUTH_SECRET) {
  console.error(
    "[auth] FATAL: NEXTAUTH_SECRET is not set. " +
    "NextAuth cannot sign or verify session JWTs. " +
    "Set NEXTAUTH_SECRET in Vercel Environment Variables. " +
    "Generate one with: openssl rand -base64 32"
  );
}

// Read once at module load so the value is visible in cold-start logs.
const _API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

        // Development-only mock admin — never active in production (NODE_ENV=production).
        if (process.env.NODE_ENV === "development") {
          const email = credentials.email.toLowerCase().trim();
          if (email === "admin@sentinel.local" && credentials.password === "Admin@123") {
            return {
              id: "mock-admin-001",
              email: "admin@sentinel.local",
              name: "System Administrator",
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

          // Carry the FastAPI-signed token so the JWT callback can store it directly.
          // FastAPI verifies it with its own SECRET_KEY — no re-signing needed here.
          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.name ?? "",
            role: data.user.role,
            _backendToken: data.access_token,
          };
        } catch (err) {
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
        // Store the token FastAPI already signed — it's ready for use as Bearer.
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
