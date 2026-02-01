import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { encryptToken } from "@/lib/encryption";

function getConvexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
  }
  return new ConvexHttpClient(url);
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.redirect(
      new URL("/sign-in?error=auth_required", request.url)
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Check for GitHub OAuth errors
  if (error) {
    const errorDescription =
      searchParams.get("error_description") || "Unknown error";
    return NextResponse.redirect(
      new URL(
        `/dashboard?github_error=${encodeURIComponent(errorDescription)}`,
        request.url
      )
    );
  }

  // Verify state parameter for CSRF protection
  const storedState = request.cookies.get("github_oauth_state")?.value;
  if (!state || state !== storedState) {
    return NextResponse.redirect(
      new URL("/dashboard?github_error=invalid_state", request.url)
    );
  }

  if (!code) {
    return NextResponse.redirect(
      new URL("/dashboard?github_error=no_code", request.url)
    );
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      }
    );

    // Validate token response
    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text();
      console.error(
        "GitHub token exchange failed:",
        tokenResponse.status,
        tokenResponse.statusText,
        errorBody
      );
      return NextResponse.redirect(
        new URL(
          `/dashboard?github_error=${encodeURIComponent(`Token exchange failed: ${tokenResponse.status} ${tokenResponse.statusText}`)}`,
          request.url
        )
      );
    }

    const tokenData = await tokenResponse.json();

    // Check for OAuth errors in response body
    if (tokenData.error) {
      return NextResponse.redirect(
        new URL(
          `/dashboard?github_error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`,
          request.url
        )
      );
    }

    // Validate access token exists
    const accessToken = tokenData.access_token;
    if (!accessToken || typeof accessToken !== "string" || !accessToken.trim()) {
      return NextResponse.redirect(
        new URL(
          `/dashboard?github_error=${encodeURIComponent("No access token received from GitHub")}`,
          request.url
        )
      );
    }

    // Get GitHub user info
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });

    // Validate user response
    if (!userResponse.ok) {
      const errorBody = await userResponse.text();
      console.error(
        "GitHub user fetch failed:",
        userResponse.status,
        userResponse.statusText,
        errorBody
      );
      return NextResponse.redirect(
        new URL(
          `/dashboard?github_error=${encodeURIComponent(`Failed to fetch GitHub user: ${userResponse.status}`)}`,
          request.url
        )
      );
    }

    const userData = await userResponse.json();

    // Validate username exists
    if (!userData.login || typeof userData.login !== "string") {
      return NextResponse.redirect(
        new URL(
          `/dashboard?github_error=${encodeURIComponent("Invalid GitHub user data received")}`,
          request.url
        )
      );
    }

    // Encrypt the access token before storing
    const { encrypted, iv } = await encryptToken(accessToken);

    // Store GitHub connection in Convex with encrypted token
    const convex = getConvexClient();
    await convex.mutation(api.users.updateGitHubConnection, {
      clerkId: userId,
      encryptedGitHubToken: encrypted,
      githubTokenIv: iv,
      githubUsername: userData.login,
    });

    // Clear the state cookie and redirect to dashboard
    const response = NextResponse.redirect(
      new URL("/dashboard?github_connected=true", request.url)
    );
    response.cookies.delete("github_oauth_state");

    return response;
  } catch (err) {
    console.error("GitHub OAuth error:", err);
    const errorMessage =
      err instanceof Error ? err.message : "Unknown error occurred";
    return NextResponse.redirect(
      new URL(
        `/dashboard?github_error=${encodeURIComponent(`OAuth failed: ${errorMessage}`)}`,
        request.url
      )
    );
  }
}
