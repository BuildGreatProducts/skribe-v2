import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Create a Polar checkout session
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { tier } = body as { tier: "starter" | "pro" };

    if (!tier || !["starter", "pro"].includes(tier)) {
      return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
    }

    const polarAccessToken = process.env.POLAR_ACCESS_TOKEN;
    if (!polarAccessToken) {
      return NextResponse.json(
        { error: "Polar not configured" },
        { status: 500 }
      );
    }

    // Validate app URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      console.error("NEXT_PUBLIC_APP_URL is not configured");
      return NextResponse.json(
        { error: "App URL not configured" },
        { status: 500 }
      );
    }

    // Get product ID based on tier
    const productId =
      tier === "starter"
        ? process.env.POLAR_STARTER_PRODUCT_ID
        : process.env.POLAR_PRO_PRODUCT_ID;

    if (!productId) {
      return NextResponse.json(
        { error: "Product not configured" },
        { status: 500 }
      );
    }

    // Create checkout session with Polar API
    const response = await fetch("https://api.polar.sh/v1/checkouts/custom", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${polarAccessToken}`,
      },
      body: JSON.stringify({
        product_id: productId,
        success_url: `${appUrl}/dashboard?subscription=success`,
        metadata: {
          clerk_id: userId,
        },
        customer_metadata: {
          clerk_id: userId,
        },
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Polar checkout error:", errorData);
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500 }
      );
    }

    const checkout = await response.json();

    return NextResponse.json({ url: checkout.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
