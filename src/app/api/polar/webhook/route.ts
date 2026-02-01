import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import crypto from "crypto";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Polar webhook event types
interface PolarWebhookEvent {
  type: string;
  data: {
    id: string;
    customer_id?: string;
    user_id?: string;
    product_id?: string;
    status?: string;
    current_period_end?: string;
    metadata?: {
      clerk_id?: string;
    };
    customer?: {
      id: string;
      email: string;
      metadata?: {
        clerk_id?: string;
      };
    };
    subscription?: {
      id: string;
      status: string;
      product_id: string;
      current_period_end?: string;
    };
  };
}

// Verify Polar webhook signature
function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}

// Map Polar product ID to subscription tier
function getSubscriptionTier(productId: string): "starter" | "pro" {
  const starterProductId = process.env.POLAR_STARTER_PRODUCT_ID;
  const proProductId = process.env.POLAR_PRO_PRODUCT_ID;

  if (productId === starterProductId) {
    return "starter";
  }
  if (productId === proProductId) {
    return "pro";
  }

  // Default to starter if unknown
  return "starter";
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signature = request.headers.get("webhook-signature") || "";
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("POLAR_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    // Verify signature
    if (!verifyWebhookSignature(payload, signature, webhookSecret)) {
      console.error("Invalid webhook signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const event = JSON.parse(payload) as PolarWebhookEvent;
    console.log("Polar webhook event:", event.type);

    // Extract clerk ID from metadata
    const clerkId =
      event.data.metadata?.clerk_id ||
      event.data.customer?.metadata?.clerk_id;

    if (!clerkId) {
      console.error("No clerk_id in webhook metadata");
      return NextResponse.json(
        { error: "Missing clerk_id in metadata" },
        { status: 400 }
      );
    }

    switch (event.type) {
      case "subscription.created":
      case "subscription.updated":
      case "subscription.active": {
        const productId = event.data.product_id || event.data.subscription?.product_id;
        if (!productId) {
          console.error("No product_id in subscription event");
          return NextResponse.json({ error: "Missing product_id" }, { status: 400 });
        }

        const tier = getSubscriptionTier(productId);
        const periodEnd = event.data.current_period_end || event.data.subscription?.current_period_end;
        const subscriptionEndsAt = periodEnd ? new Date(periodEnd).getTime() : undefined;

        await convex.mutation(api.users.updateSubscription, {
          clerkId,
          subscriptionTier: tier,
          subscriptionStatus: "active",
          subscriptionEndsAt,
          polarCustomerId: event.data.customer_id || event.data.customer?.id,
        });
        break;
      }

      case "subscription.canceled":
      case "subscription.cancelled": {
        // Subscription cancelled but still active until period end
        const productId = event.data.product_id || event.data.subscription?.product_id;
        const tier = productId ? getSubscriptionTier(productId) : "starter";
        const periodEnd = event.data.current_period_end || event.data.subscription?.current_period_end;
        const subscriptionEndsAt = periodEnd ? new Date(periodEnd).getTime() : undefined;

        await convex.mutation(api.users.updateSubscription, {
          clerkId,
          subscriptionTier: tier,
          subscriptionStatus: "cancelled",
          subscriptionEndsAt,
        });
        break;
      }

      case "subscription.revoked":
      case "subscription.expired": {
        // Subscription fully expired
        await convex.mutation(api.users.updateSubscription, {
          clerkId,
          subscriptionTier: "free",
          subscriptionStatus: "expired",
        });
        break;
      }

      case "checkout.created":
      case "order.created": {
        // Checkout initiated - no action needed
        console.log("Checkout created for clerk_id:", clerkId);
        break;
      }

      default:
        console.log("Unhandled webhook event type:", event.type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}
