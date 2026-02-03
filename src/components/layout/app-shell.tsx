"use client";

import { ProjectSelector } from "./project-selector";
import { GitHubNavLink } from "./github-nav-link";
import { SidebarNav } from "./sidebar-nav";
import { RecentAgentsList } from "./recent-agents-list";
import { UserNav } from "./user-nav";
import { useStoreUser } from "@/hooks/use-store-user";
import Link from "next/link";
import { useState, useEffect } from "react";

interface AppShellProps {
  projectId: string;
  children: React.ReactNode;
}

export function AppShell({ projectId, children }: AppShellProps) {
  const { user: storedUser } = useStoreUser();
  const [now, setNow] = useState<number | null>(null);

  // Set current time after mount to avoid hydration issues
  useEffect(() => {
    setNow(Date.now());
  }, []);

  // Check for trial status
  const isOnTrial =
    now !== null &&
    storedUser?.subscriptionStatus === "trial" &&
    storedUser?.trialEndsAt &&
    now < storedUser.trialEndsAt;

  const trialDaysLeft = storedUser?.trialEndsAt && now !== null
    ? Math.max(0, Math.ceil((storedUser.trialEndsAt - now) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div className="flex min-h-screen bg-muted">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 z-30 flex h-full w-64 flex-col bg-white shadow-[0_2px_8px_-2px_rgb(0_0_0/0.08),0_4px_12px_-4px_rgb(0_0_0/0.05)]">
        {/* Logo */}
        <div className="px-4 py-4">
          <Link href={`/p/${projectId}`} className="flex items-center gap-2">
            <span className="logo-text text-xl text-foreground">Skribe</span>
          </Link>
        </div>

        {/* Project Selector */}
        <ProjectSelector currentProjectId={projectId} />

        {/* GitHub Link */}
        <GitHubNavLink currentProjectId={projectId} />

        {/* Navigation */}
        <SidebarNav projectId={projectId} />

        {/* Recent Agents */}
        <div className="flex-1 overflow-y-auto">
          <RecentAgentsList projectId={projectId} />
        </div>

        {/* User Nav */}
        <UserNav />
      </aside>

      {/* Main Content */}
      <div className="flex-1 pl-64">
        {/* Trial Banner */}
        {isOnTrial && trialDaysLeft > 0 && (
          <div className="bg-warning/10 border-b border-warning/30 px-6 py-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-warning">
                <span className="font-medium">{trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""}</span>{" "}
                left in your free trial
              </p>
              <Link
                href="/pricing"
                className="text-sm font-medium text-warning underline hover:no-underline"
              >
                Upgrade now
              </Link>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}
