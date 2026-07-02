import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    /** HS256 JWT that the FastAPI backend accepts as Bearer token. */
    accessToken?: string;
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }
  interface User {
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    /** Signed backend JWT stored inside the NextAuth cookie. */
    backendToken?: string;
  }
}
