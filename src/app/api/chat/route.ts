import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { buildSystemPrompt } from "@/lib/system-prompts";
import Anthropic from "@anthropic-ai/sdk";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { chatId, projectId, message } = body;

    if (!chatId || !projectId || !message) {
      return NextResponse.json(
        { error: "Missing required fields: chatId, projectId, message" },
        { status: 400 }
      );
    }

    // Resolve the Convex user from Clerk ID
    const user = await convex.query(api.users.getByClerkId, {
      clerkId: clerkUserId,
    });

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 403 }
      );
    }

    // Verify project ownership
    const project = await convex.query(api.projects.getById, {
      projectId: projectId as Id<"projects">,
    });

    if (!project) {
      return NextResponse.json(
        { error: "Forbidden: Project not found or you do not have access" },
        { status: 403 }
      );
    }

    // Verify chat belongs to project and user has access
    const chat = await convex.query(api.chats.getById, {
      chatId: chatId as Id<"chats">,
    });

    if (!chat) {
      return NextResponse.json(
        { error: "Forbidden: Chat not found or you do not have access" },
        { status: 403 }
      );
    }

    // Verify chat belongs to the specified project
    if (chat.projectId !== projectId) {
      return NextResponse.json(
        { error: "Forbidden: Chat does not belong to this project" },
        { status: 403 }
      );
    }

    // Get project documents for context (already ownership-checked)
    const documents = await convex.query(api.documents.getContextForProject, {
      projectId: projectId as Id<"projects">,
    });

    // Get chat history (already ownership-checked)
    const messages = await convex.query(api.messages.getByChat, {
      chatId: chatId as Id<"chats">,
    });

    // Build system prompt with document context
    const systemPrompt = chat.systemPrompt || buildSystemPrompt(chat.type, documents);

    // Format messages for Claude API
    const claudeMessages = messages
      .filter((m) => m.role !== "system" && m.content.trim() !== "")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Add the new user message
    claudeMessages.push({
      role: "user" as const,
      content: message,
    });

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Claude API key not configured" },
        { status: 500 }
      );
    }

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey,
    });

    // Create streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 4096,
            system: systemPrompt,
            messages: claudeMessages,
            stream: true,
          });

          for await (const event of response) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }

          controller.close();
        } catch (error) {
          console.error("Claude API error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
