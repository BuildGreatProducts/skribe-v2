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

// Verify Polar webhook signature (Standard Webhooks spec)
// See: https://docs.polar.sh/integrate/webhooks#verify-signature
function verifyWebhookSignature(
  payload: string,
  signatureHeader: string,
  timestampHeader: string,
  webhookIdHeader: string,
  secret: string
): boolean {
  try {
    // Secret format is "whsec_<base64-encoded-key>"
    // Extract and decode the base64 key
    const secretKey = secret.startsWith("whsec_")
      ? Buffer.from(secret.slice(6), "base64")
      : Buffer.from(secret, "base64");

    // Construct the signed content per Standard Webhooks spec
    const signedContent = `${webhookIdHeader}.${timestampHeader}.${payload}`;

    // Compute expected signature (base64-encoded HMAC-SHA256)
    const expectedSignature = crypto
      .createHmac("sha256", secretKey)
      .update(signedContent)
      .digest("base64");

    // Parse signature header - format: "v1,<sig1> v1,<sig2> ..."
    // Accept any matching v1 signature
    const signatures = signatureHeader.split(" ");

    for (const sig of signatures) {
      const [version, signature] = sig.split(",");
      if (version !== "v1" || !signature) {
        continue;
      }

      // Convert to buffers for constant-time comparison
      const signatureBuffer = Buffer.from(signature, "base64");
      const expectedBuffer = Buffer.from(expectedSignature, "base64");

      // Check lengths first - timingSafeEqual throws if lengths differ
      if (signatureBuffer.length !== expectedBuffer.length) {
        continue;
      }

      if (crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

// Map Polar product ID to subscription tier
// Returns null for unknown product IDs (fail-closed behavior)
function getSubscriptionTier(productId: string): "starter" | "pro" | null {
  const starterProductId = process.env.POLAR_STARTER_PRODUCT_ID;
  const proProductId = process.env.POLAR_PRO_PRODUCT_ID;

  if (productId === starterProductId) {
    return "starter";
  }
  if (productId === proProductId) {
    return "pro";
  }

  // Return null for unknown product IDs - caller must handle
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.text();
    const signatureHeader = request.headers.get("webhook-signature") || "";
    const timestampHeader = request.headers.get("webhook-timestamp") || "";
    const webhookIdHeader = request.headers.get("webhook-id") || "";
    const webhookSecret = process.env.POLAR_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error("POLAR_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook not configured" },
        { status: 500 }
      );
    }

    // Verify all required headers are present
    if (!signatureHeader || !timestampHeader || !webhookIdHeader) {
      console.error("Missing required webhook headers");
      return NextResponse.json(
        { error: "Missing webhook headers" },
        { status: 400 }
      );
    }

    // Verify signature
    if (
      !verifyWebhookSignature(
        payload,
        signatureHeader,
        timestampHeader,
        webhookIdHeader,
        webhookSecret
      )
    ) {
      console.error("Invalid webhook signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    const event = JSON.parse(payload) as PolarWebhookEvent;
    console.log("Polar webhook event:", event.type, "id:", webhookIdHeader);

    // Extract clerk ID from metadata
    const clerkId =
      event.data.metadata?.clerk_id ||
      event.data.customer?.metadata?.clerk_id;

    if (!clerkId) {
      console.error("No clerk_id in webhook metadata, event:", webhookIdHeader);
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
          console.error("No product_id in subscription event:", webhookIdHeader);
          return NextResponse.json({ error: "Missing product_id" }, { status: 400 });
        }

        const tier = getSubscriptionTier(productId);
        if (tier === null) {
          console.error("Unknown product_id in subscription event:", webhookIdHeader);
          return NextResponse.json(
            { error: "Unknown product_id" },
            { status: 400 }
          );
        }

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

        // For cancellation, we need a valid product ID to determine tier
        if (!productId) {
          console.error("No product_id in cancellation event:", webhookIdHeader);
          return NextResponse.json({ error: "Missing product_id" }, { status: 400 });
        }

        const tier = getSubscriptionTier(productId);
        if (tier === null) {
          console.error("Unknown product_id in cancellation event:", webhookIdHeader);
          return NextResponse.json(
            { error: "Unknown product_id" },
            { status: 400 }
          );
        }

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
        // Checkout initiated - log with event ID only (no PII)
        console.log("Checkout event received, id:", webhookIdHeader);
        break;
      }

      default:
        console.log("Unhandled webhook event type:", event.type, "id:", webhookIdHeader);
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
