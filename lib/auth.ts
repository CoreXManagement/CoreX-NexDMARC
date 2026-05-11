import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { getDb, type UserRow } from "./db";
import { verifyPassword } from "./passwords";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = String(credentials?.email || "").toLowerCase().trim();
        const password = String(credentials?.password || "");
        if (!email || !password) return null;
        const row = getDb()
          .prepare("SELECT * FROM users WHERE email = ? OR username = ?")
          .get(email, email) as UserRow | undefined;
        if (!row) return null;
        const ok = await verifyPassword(password, row.password_hash);
        if (!ok) return null;
        return { id: row.id, email: row.email, role: row.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id: number }).id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.uid) {
        session.user.id = token.uid as number;
        session.user.role = (token.role as string) || "user";
      }
      return session;
    },
  },
};
