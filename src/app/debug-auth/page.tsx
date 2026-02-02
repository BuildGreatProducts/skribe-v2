"use client";

import { useQuery } from "convex/react";
import { useAuth, useUser } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";

export default function DebugAuthPage() {
  const { isLoaded: clerkLoaded, isSignedIn, userId } = useAuth();
  const { user: clerkUser } = useUser();
  const authDebug = useQuery(api.users.debugAuth);

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Authentication Debug</h1>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Clerk Status</h2>
        <div className="bg-gray-100 p-4 rounded-lg space-y-2 text-sm font-mono">
          <p>Loaded: {String(clerkLoaded)}</p>
          <p>Signed In: {String(isSignedIn)}</p>
          <p>User ID: {userId || "null"}</p>
          <p>Email: {clerkUser?.emailAddresses?.[0]?.emailAddress || "null"}</p>
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Convex Auth Identity</h2>
        <div className="bg-gray-100 p-4 rounded-lg space-y-2 text-sm font-mono">
          {authDebug === undefined ? (
            <p>Loading...</p>
          ) : (
            <>
              <p>Has Identity: {String(authDebug.hasIdentity)}</p>
              {authDebug.identity ? (
                <>
                  <p>Subject: {authDebug.identity.subject}</p>
                  <p>Issuer: {authDebug.identity.issuer}</p>
                  <p>Email: {authDebug.identity.email || "null"}</p>
                  <p>Token ID: {authDebug.identity.tokenIdentifier}</p>
                </>
              ) : (
                <p className="text-red-600 font-bold">
                  ⚠️ No identity - JWT token not being passed to Convex!
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-2">Troubleshooting</h2>
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-sm">
          <p className="font-semibold mb-2">If &quot;Has Identity&quot; is false:</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>
              Go to{" "}
              <a
                href="https://dashboard.clerk.com"
                className="text-blue-600 underline"
                target="_blank"
                rel="noopener noreferrer"
              >
                Clerk Dashboard
              </a>{" "}
              → JWT Templates
            </li>
            <li>Create a new template using the &quot;Convex&quot; preset</li>
            <li>
              <strong>The template MUST be named &quot;convex&quot;</strong> (lowercase,
              exactly)
            </li>
            <li>Copy the Issuer URL from the template</li>
            <li>
              Update <code>convex/auth.config.ts</code> with the correct domain
            </li>
            <li>
              Run <code>npx convex dev</code> to push changes
            </li>
            <li>Refresh this page</li>
          </ol>
        </div>
      </section>
    </div>
  );
}
