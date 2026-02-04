import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// CORS headers for cross-origin requests (embeddable widget support)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

interface FeedbackRequestBody {
  content: string;
  email?: string;
  metadata?: Record<string, unknown>;
  source?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ apiKey: string }> }
) {
  try {
    const { apiKey } = await params;

    // Validate API key format
    if (!apiKey || !apiKey.startsWith("fb_")) {
      return NextResponse.json(
        { error: "Invalid API key format" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Look up project by API key
    const projectResult = await convex.query(api.feedback.getProjectByApiKey, {
      apiKey,
    });

    if (!projectResult) {
      return NextResponse.json(
        { error: "Invalid API key" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Parse request body
    let body: FeedbackRequestBody;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate required fields
    if (!body.content || typeof body.content !== "string") {
      return NextResponse.json(
        { error: "Missing required field: content" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate content length
    if (body.content.length > 10000) {
      return NextResponse.json(
        { error: "Content exceeds maximum length of 10000 characters" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate email format if provided
    if (body.email && typeof body.email === "string") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(body.email)) {
        return NextResponse.json(
          { error: "Invalid email format" },
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // Create feedback entry
    const feedbackId = await convex.mutation(api.feedback.create, {
      projectId: projectResult.projectId,
      content: body.content.trim(),
      email: body.email?.trim(),
      metadata: body.metadata,
      source: body.source || "api",
    });

    return NextResponse.json(
      { success: true, id: feedbackId },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Feedback submission error:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500, headers: corsHeaders }
    );
  }
}
