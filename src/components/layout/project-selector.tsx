"use client";

import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ProjectSelectorProps {
  currentProjectId: string;
}

export function ProjectSelector({ currentProjectId }: ProjectSelectorProps) {
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
      <div className="px-3 py-2">
        <div className="h-10 animate-pulse rounded-lg bg-muted"></div>
      </div>
    );
  }

  return (
    <div className="relative px-3 py-2" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border border-border bg-white px-3 py-2 text-left transition-colors hover:bg-muted",
          isOpen && "ring-2 ring-primary ring-offset-1"
        )}
      >
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
      </button>

      {isOpen && (
        <div className="absolute left-3 right-3 top-full z-50 mt-1 rounded-lg border border-border bg-white shadow-lg">
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
