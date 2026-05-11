import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: number;
      email: string;
      role: string;
    };
  }
  interface User {
    id: number;
    email: string;
    role: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: number;
    role?: string;
  }
}
