import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateWorkspace } from "@/lib/supabase/workspace";
import { AppShell } from "@/components/layout/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Generation and scoring both depend on the sender profile, so nothing in the
  // dashboard is useful until onboarding is done. /onboarding sits outside this
  // route group, so this cannot loop.
  const workspace = await getOrCreateWorkspace(supabase, user);
  if (workspace && !workspace.onboarded_at) {
    redirect("/onboarding");
  }

  return <AppShell>{children}</AppShell>;
}
