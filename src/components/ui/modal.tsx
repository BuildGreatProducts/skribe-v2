"use client";

import { cn } from "@/lib/utils";
import {
  HTMLAttributes,
  forwardRef,
  useEffect,
  useCallback,
  ReactNode,
  useId,
} from "react";
import { createPortal } from "react-dom";

export interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const Modal = forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      className,
      isOpen,
      onClose,
      title,
      description,
      children,
      size = "md",
      ...props
    },
    ref
  ) => {
    const uniqueId = useId();
    const titleId = `${uniqueId}-title`;
    const descriptionId = `${uniqueId}-description`;

    const handleEscape = useCallback(
      (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          onClose();
        }
      },
      [onClose]
    );

    useEffect(() => {
      if (isOpen) {
        document.addEventListener("keydown", handleEscape);
        document.body.style.overflow = "hidden";
      }
      return () => {
        document.removeEventListener("keydown", handleEscape);
        document.body.style.overflow = "unset";
      };
    }, [isOpen, handleEscape]);

    if (!isOpen) return null;

    const sizes = {
      sm: "max-w-sm",
      md: "max-w-md",
      lg: "max-w-lg",
      xl: "max-w-xl",
    };

    const modalContent = (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal */}
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          aria-describedby={description ? descriptionId : undefined}
          className={cn(
            "relative z-50 w-full rounded-2xl bg-white p-6 shadow-lg",
            "animate-in fade-in-0 zoom-in-95",
            sizes[size],
            className
          )}
          {...props}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute right-4 top-4 rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>

          {/* Header */}
          {(title || description) && (
            <div className="mb-4">
              {title && (
                <h2
                  id={titleId}
                  className="font-serif text-xl font-semibold"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p id={descriptionId} className="mt-1 text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
          )}

          {/* Content */}
          {children}
        </div>
      </div>
    );

    // Only use portal on client side
    if (typeof window === "undefined") return null;

    return createPortal(modalContent, document.body);
  }
);

Modal.displayName = "Modal";

export { Modal };
