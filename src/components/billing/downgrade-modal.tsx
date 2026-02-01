"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button, Modal } from "@/components/ui";

interface Project {
  _id: Id<"projects">;
  name: string;
  description?: string;
}

interface DowngradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  projects: Project[];
}

export function DowngradeModal({
  isOpen,
  onClose,
  onComplete,
  projects,
}: DowngradeModalProps) {
  const [selectedProjectId, setSelectedProjectId] = useState<Id<"projects"> | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const deleteForDowngrade = useMutation(api.projects.deleteForDowngrade);

  const projectsToDelete = projects.filter((p) => p._id !== selectedProjectId);

  const handleConfirm = async () => {
    if (!selectedProjectId || projectsToDelete.length === 0) return;

    setIsDeleting(true);
    try {
      await deleteForDowngrade({
        projectIdsToDelete: projectsToDelete.map((p) => p._id),
      });
      onComplete();
    } catch (error) {
      console.error("Failed to delete projects:", error);
      alert("Failed to delete projects. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleClose = () => {
    if (!isDeleting) {
      setSelectedProjectId(null);
      setIsConfirming(false);
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Select Project to Keep"
      description={
        isConfirming
          ? "This action cannot be undone."
          : "Your Starter plan allows 1 project. Please select which project you want to keep."
      }
    >
      <div className="space-y-4">
        {!isConfirming ? (
          <>
            {/* Project Selection */}
            <div className="space-y-2">
              {projects.map((project) => (
                <button
                  key={project._id}
                  onClick={() => setSelectedProjectId(project._id)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors ${
                    selectedProjectId === project._id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{project.name}</p>
                      {project.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                          {project.description}
                        </p>
                      )}
                    </div>
                    {selectedProjectId === project._id && (
                      <div className="flex-shrink-0 ml-3">
                        <CheckCircleIcon className="h-6 w-6 text-primary" />
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={() => setIsConfirming(true)}
                disabled={!selectedProjectId}
              >
                Continue
              </Button>
            </div>
          </>
        ) : (
          <>
            {/* Confirmation View */}
            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/5">
              <div className="flex items-start gap-3">
                <WarningIcon className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">
                    The following projects will be permanently deleted:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {projectsToDelete.map((project) => (
                      <li key={project._id} className="text-sm text-muted-foreground">
                        &bull; {project.name}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted">
              <p className="text-sm">
                <strong>You will keep:</strong>{" "}
                {projects.find((p) => p._id === selectedProjectId)?.name}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setIsConfirming(false)}
                disabled={isDeleting}
              >
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleConfirm}
                isLoading={isDeleting}
              >
                Delete Projects & Downgrade
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// Icons
function CheckCircleIcon({ className }: { className?: string }) {
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
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function WarningIcon({ className }: { className?: string }) {
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
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
