// Clerk JWT issuer domain - this must match the JWT template issuer in Clerk
// IMPORTANT: The JWT template in Clerk MUST be named "convex" (do not rename it)
export default {
  providers: [
    {
      // In development: https://verb-noun-00.clerk.accounts.dev
      // In production: https://clerk.yourdomain.com
      domain: "https://possible-doe-92.clerk.accounts.dev",
      applicationID: "convex",
    },
  ],
};
