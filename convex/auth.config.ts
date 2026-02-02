// Clerk JWT issuer domain - this must match the JWT template issuer in Clerk
// IMPORTANT: The JWT template in Clerk MUST be named "convex" (do not rename it)

const clerkIssuer = process.env.CLERK_ISSUER;

if (!clerkIssuer) {
  throw new Error(
    "Missing CLERK_ISSUER environment variable. " +
      "Set this to your Clerk JWT issuer domain (e.g., https://your-app.clerk.accounts.dev for development " +
      "or https://clerk.yourdomain.com for production)."
  );
}

export default {
  providers: [
    {
      domain: clerkIssuer,
      applicationID: "convex",
    },
  ],
};
