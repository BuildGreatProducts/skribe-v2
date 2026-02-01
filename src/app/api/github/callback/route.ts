import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

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

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      return NextResponse.redirect(
        new URL(
          `/dashboard?github_error=${encodeURIComponent(tokenData.error_description || tokenData.error)}`,
          request.url
        )
      );
    }

    const accessToken = tokenData.access_token;

    // Get GitHub user info
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
      },
    });

    const userData = await userResponse.json();

    // Store GitHub connection in Convex
    const convex = getConvexClient();
    await convex.mutation(api.users.updateGitHubConnection, {
      clerkId: userId,
      githubAccessToken: accessToken,
      githubUsername: userData.login,
    });

    // Clear the state cookie
    const response = NextResponse.redirect(
      new URL("/dashboard?github_connected=true", request.url)
    );
    response.cookies.delete("github_oauth_state");

    return response;
  } catch (err) {
    console.error("GitHub OAuth error:", err);
    return NextResponse.redirect(
      new URL("/dashboard?github_error=token_exchange_failed", request.url)
    );
  }
}
