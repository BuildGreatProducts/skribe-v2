"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ProjectSelectorProps {
  currentProjectId: string;
  collapsed?: boolean;
}

export function ProjectSelector({ currentProjectId, collapsed = false }: ProjectSelectorProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const projects = useQuery(api.projects.getByUser);
  const currentProject = useQuery(
    api.projects.getById,
    currentProjectId ? { projectId: currentProjectId as Id<"projects"> } : "skip"
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectProject = (projectId: string) => {
    setIsOpen(false);
    router.push(`/p/${projectId}`);
  };

  const handleNewProject = () => {
    setIsOpen(false);
    router.push("/p/new");
  };

  if (projects === undefined || currentProject === undefined) {
    return (
      <div className={cn("py-2", collapsed ? "px-2" : "px-3")}>
        <div className={cn("animate-pulse rounded-lg bg-muted", collapsed ? "h-10 w-10" : "h-10 w-full")}></div>
      </div>
    );
  }

  return (
    <div className={cn("relative py-2", collapsed ? "px-2" : "px-3")} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center rounded-lg border border-border bg-white transition-colors hover:bg-muted",
          collapsed ? "w-full justify-center p-2" : "w-full justify-between px-3 py-2 text-left",
          isOpen && "ring-2 ring-primary ring-offset-1"
        )}
        title={collapsed ? currentProject?.name : undefined}
      >
        {collapsed ? (
          <FolderIcon className="h-5 w-5 text-muted-foreground" />
        ) : (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-foreground">
                {currentProject?.name || "Select Project"}
              </p>
              {currentProject?.githubRepoName && (
                <p className="truncate text-xs text-muted-foreground">
                  {currentProject.githubRepoName}
                </p>
              )}
            </div>
            <ChevronIcon className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
          </>
        )}
      </button>

      {isOpen && (
        <div className={cn(
          "absolute top-full z-50 mt-1 rounded-lg border border-border bg-white shadow-lg",
          collapsed ? "left-0 w-48" : "left-3 right-3"
        )}>
          <div className="max-h-64 overflow-y-auto py-1">
            {projects.map((project) => (
              <button
                key={project._id}
                onClick={() => handleSelectProject(project._id)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-muted",
                  project._id === currentProjectId && "bg-muted"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{project.name}</p>
                  {project.githubRepoName && (
                    <p className="truncate text-xs text-muted-foreground">
                      {project.githubRepoName}
                    </p>
                  )}
                </div>
                {project._id === currentProjectId && (
                  <CheckIcon className="h-4 w-4 flex-shrink-0 text-foreground" />
                )}
              </button>
            ))}
          </div>
          <div className="border-t border-border p-1">
            <button
              onClick={handleNewProject}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted"
            >
              <PlusIcon className="h-4 w-4" />
              New Project
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
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
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
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
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

function FolderIcon({ className }: { className?: string }) {
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
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}
