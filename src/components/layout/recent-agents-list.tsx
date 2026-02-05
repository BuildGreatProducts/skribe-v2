"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

// Pastel colors for agent icons - cycles through 6 colors
const PASTEL_COLORS = [
  "bg-pastel-rose",
  "bg-pastel-lavender",
  "bg-pastel-sky",
  "bg-pastel-mint",
  "bg-pastel-peach",
  "bg-pastel-lemon",
] as const;

function getAgentColor(index: number): string {
  return PASTEL_COLORS[index % PASTEL_COLORS.length];
}

interface RecentAgentsListProps {
  projectId: string;
  collapsed?: boolean;
}

export function RecentAgentsList({ projectId, collapsed = false }: RecentAgentsListProps) {
  const pathname = usePathname();

  const recentAgents = useQuery(
    api.agents.getRecentByProject,
    projectId ? { projectId: projectId as Id<"projects">, limit: 10 } : "skip"
  );

  if (recentAgents === undefined) {
    return (
      <div className={cn("py-2", collapsed ? "px-2" : "px-3")}>
        {!collapsed && (
          <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Agents
          </h3>
        )}
        <div className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "animate-pulse rounded-lg bg-muted",
                collapsed ? "h-8 w-8" : "h-8 w-full"
              )}
            ></div>
          ))}
        </div>
      </div>
    );
  }

  if (recentAgents.length === 0) {
    if (collapsed) {
      return null;
    }
    return (
      <div className="px-3 py-2">
        <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Agents
        </h3>
        <p className="px-3 text-xs text-muted-foreground">
          No agents yet. Start a new conversation above.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("py-2", collapsed ? "px-2" : "px-3")}>
      {!collapsed && (
        <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Agents
        </h3>
      )}
      <ul className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
        {recentAgents.map((agent, index) => {
          const agentPath = `/p/${projectId}/agent/${agent._id}`;
          const isActive = pathname === agentPath;
          const colorClass = getAgentColor(index);

          return (
            <li key={agent._id}>
              <Link
                href={agentPath}
                className={cn(
                  "flex items-center rounded-lg text-sm transition-colors",
                  collapsed ? "justify-center p-1.5" : "gap-2 px-3 py-2",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title={collapsed ? agent.title : undefined}
              >
                <span className={cn("flex h-5 w-5 flex-shrink-0 items-center justify-center rounded", colorClass)}>
                  <AgentIcon className="h-3 w-3 text-foreground/70" />
                </span>
                <span
                  className={cn(
                    "truncate transition-[opacity,width] duration-300 ease-in-out",
                    collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100 w-auto"
                  )}
                >
                  {agent.title}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function AgentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
