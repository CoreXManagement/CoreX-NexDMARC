import { requireSession } from "@/lib/auth-helpers";
import { Sidebar } from "@/components/Sidebar";
import { UpdateBanner } from "@/components/UpdateBanner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return (
    <div className="flex min-h-screen">
      <Sidebar user={{ email: session.user.email, role: session.user.role }} />
      <main className="relative z-0 flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl p-6">
          <UpdateBanner />
          {children}
        </div>
      </main>
    </div>
  );
}
