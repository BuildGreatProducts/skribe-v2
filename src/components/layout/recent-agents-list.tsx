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
}

export function RecentAgentsList({ projectId }: RecentAgentsListProps) {
  const pathname = usePathname();

  const recentAgents = useQuery(
    api.agents.getRecentByProject,
    projectId ? { projectId: projectId as Id<"projects">, limit: 10 } : "skip"
  );

  if (recentAgents === undefined) {
    return (
      <div className="px-3 py-2">
        <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Recent Agents
        </h3>
        <div className="space-y-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-lg bg-muted"></div>
          ))}
        </div>
      </div>
    );
  }

  if (recentAgents.length === 0) {
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
    <div className="px-3 py-2">
      <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Recent Agents
      </h3>
      <ul className="space-y-1">
        {recentAgents.map((agent, index) => {
          const agentPath = `/p/${projectId}/agent/${agent._id}`;
          const isActive = pathname === agentPath;
          const colorClass = getAgentColor(index);

          return (
            <li key={agent._id}>
              <Link
                href={agentPath}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <span className={cn("flex h-5 w-5 flex-shrink-0 items-center justify-center rounded", colorClass)}>
                  <AgentIcon className="h-3 w-3 text-foreground/70" />
                </span>
                <span className="truncate">{agent.title}</span>
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
