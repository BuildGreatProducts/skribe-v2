"use client";

import { ClerkProvider as ClerkProviderBase } from "@clerk/nextjs";
import { ReactNode } from "react";

export function ClerkProvider({ children }: { children: ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  // If no valid Clerk key, render children without Clerk auth
  // This allows the app to build without Clerk configured
  if (!publishableKey || publishableKey.includes("placeholder")) {
    return <>{children}</>;
  }

  return (
    <ClerkProviderBase
      appearance={{
        variables: {
          colorPrimary: "#166534",
          colorBackground: "#ffffff",
          colorText: "#171717",
          colorInputBackground: "#ffffff",
          colorInputText: "#171717",
          borderRadius: "0.75rem",
        },
        elements: {
          formButtonPrimary:
            "bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md hover:shadow-lg",
          card: "rounded-2xl shadow-lg",
          socialButtonsBlockButton: "rounded-xl border-border hover:bg-muted",
          formFieldInput: "rounded-xl border-border",
          footerActionLink: "text-primary hover:text-primary-hover",
        },
      }}
    >
      {children}
    </ClerkProviderBase>
  );
}
