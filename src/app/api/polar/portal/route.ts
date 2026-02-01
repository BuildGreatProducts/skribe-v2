import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Get Polar customer portal URL
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user to find Polar customer ID
    const user = await convex.query(api.users.getByClerkId, { clerkId: userId });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.polarCustomerId) {
      return NextResponse.json(
        { error: "No subscription found" },
        { status: 404 }
      );
    }

    const polarAccessToken = process.env.POLAR_ACCESS_TOKEN;
    if (!polarAccessToken) {
      return NextResponse.json(
        { error: "Polar not configured" },
        { status: 500 }
      );
    }

    // Create customer portal session
    const response = await fetch(
      "https://api.polar.sh/v1/customer-sessions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${polarAccessToken}`,
        },
        body: JSON.stringify({
          customer_id: user.polarCustomerId,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Polar portal error:", errorData);
      return NextResponse.json(
        { error: "Failed to create portal session" },
        { status: 500 }
      );
    }

    const session = await response.json();

    return NextResponse.json({ url: session.customer_portal_url });
  } catch (error) {
    console.error("Portal error:", error);
    return NextResponse.json(
      { error: "Failed to create portal session" },
      { status: 500 }
    );
  }
}
