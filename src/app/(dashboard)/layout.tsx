import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "@/components/layout/Sidebar";
import TargetReminder from "@/components/TargetReminder";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const role = (session.user as { role: string }).role;
  const userName = session.user.name || "User";
  const userEmail = session.user.email || "";

  return (
    <div className="min-h-screen bg-surface-dim">
      <Sidebar role={role} userName={userName} userEmail={userEmail} />
      <main className="ml-[260px] transition-all duration-300">
        {children}
      </main>
      <TargetReminder role={role} />
    </div>
  );
}
