import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import {
  buildDocumentEditPrompt,
  SelectionContext,
} from "@/lib/document-ai-prompts";
import {
  DOCUMENT_EDIT_TOOLS,
  executeDocumentTool,
} from "@/lib/document-edit-tools";
import Anthropic from "@anthropic-ai/sdk";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await auth();
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get Clerk JWT token to authenticate with Convex
    const token = await authResult.getToken({ template: "convex" });
    if (!token) {
      return NextResponse.json(
        { error: "Failed to get authentication token" },
        { status: 401 }
      );
    }

    // Set the auth token on the Convex client
    convex.setAuth(token);

    const body = await request.json();
    const {
      documentId,
      projectId,
      message,
      documentContent,
      selectionContext,
      messageHistory,
      imageIds,
    } = body as {
      documentId: string;
      projectId: string;
      message: string;
      documentContent: string;
      selectionContext?: SelectionContext;
      messageHistory: ChatMessage[];
      imageIds?: string[];
    };

    if (!documentId || !projectId || (message === undefined && (!imageIds || imageIds.length === 0)) || documentContent === undefined) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: documentId, projectId, message or imageIds, documentContent",
        },
        { status: 400 }
      );
    }

    // Verify project ownership using authenticated query
    const project = await convex.query(api.projects.getById, {
      projectId: projectId as Id<"projects">,
    });

    if (!project) {
      return NextResponse.json(
        { error: "Forbidden: Project not found or you do not have access" },
        { status: 403 }
      );
    }

    // Verify document belongs to project using authenticated query
    const document = await convex.query(api.documents.getById, {
      documentId: documentId as Id<"documents">,
    });

    if (!document) {
      return NextResponse.json(
        { error: "Forbidden: Document not found or you do not have access" },
        { status: 403 }
      );
    }

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Claude API key not configured" },
        { status: 500 }
      );
    }

    // Fetch image URLs if images are attached
    let imageUrls: string[] = [];
    if (imageIds && imageIds.length > 0) {
      const urls = await convex.query(api.storage.getImageUrls, {
        storageIds: imageIds as Id<"_storage">[],
      });
      imageUrls = urls.filter((url): url is string => url !== null);
    }

    // Format messages for Claude API
    const claudeMessages: Anthropic.MessageParam[] = (messageHistory || [])
      .filter((m) => m.content.trim() !== "")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Build user message content with optional images
    const userMessageContent: Anthropic.ContentBlockParam[] = [];

    // Add images first (if any)
    for (const url of imageUrls) {
      userMessageContent.push({
        type: "image",
        source: {
          type: "url",
          url,
        },
      });
    }

    // Add text message (if any)
    if (message && message.trim()) {
      userMessageContent.push({
        type: "text",
        text: message,
      });
    }

    // Add the new user message
    claudeMessages.push({
      role: "user" as const,
      content: userMessageContent,
    });

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey,
    });

    // Create streaming response with tool support
    const encoder = new TextEncoder();
    let currentDocumentContent = documentContent;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          let currentMessages = claudeMessages;
          let continueLoop = true;

          while (continueLoop) {
            // Rebuild system prompt with current document content on each iteration
            // This ensures the AI sees the latest content after tool-driven edits
            const loopSystemPrompt = buildDocumentEditPrompt(
              {
                title: document.title,
                content: currentDocumentContent,
                type: document.type,
              },
              selectionContext
            );

            const response = await anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 4096,
              system: loopSystemPrompt,
              messages: currentMessages,
              tools: DOCUMENT_EDIT_TOOLS,
              stream: true,
            });

            let currentToolUse: {
              id: string;
              name: string;
              input: string;
            } | null = null;
            let stopReason: string | null = null;

            for await (const event of response) {
              if (event.type === "content_block_start") {
                if (event.content_block.type === "tool_use") {
                  currentToolUse = {
                    id: event.content_block.id,
                    name: event.content_block.name,
                    input: "",
                  };
                }
              } else if (event.type === "content_block_delta") {
                if (event.delta.type === "text_delta") {
                  controller.enqueue(encoder.encode(event.delta.text));
                } else if (
                  event.delta.type === "input_json_delta" &&
                  currentToolUse
                ) {
                  currentToolUse.input += event.delta.partial_json;
                }
              } else if (event.type === "message_delta") {
                stopReason = event.delta.stop_reason;
              }
            }

            // If the model used a tool, process it and continue
            if (stopReason === "tool_use" && currentToolUse) {
              let toolInput: Record<string, unknown>;
              let toolResult: string;

              try {
                toolInput = JSON.parse(currentToolUse.input);
              } catch (parseError) {
                toolResult = `Error: Failed to parse tool input - ${parseError instanceof Error ? parseError.message : "Invalid JSON"}`;

                currentMessages = [
                  ...currentMessages,
                  {
                    role: "assistant" as const,
                    content: [
                      {
                        type: "tool_use" as const,
                        id: currentToolUse.id,
                        name: currentToolUse.name,
                        input: {},
                      },
                    ],
                  },
                  {
                    role: "user" as const,
                    content: [
                      {
                        type: "tool_result" as const,
                        tool_use_id: currentToolUse.id,
                        content: toolResult,
                        is_error: true,
                      },
                    ],
                  },
                ];
                currentToolUse = null;
                continue;
              }

              // Execute the tool
              const result = executeDocumentTool(
                currentToolUse.name,
                toolInput,
                currentDocumentContent,
                selectionContext
              );

              if (result.success) {
                currentDocumentContent = result.newContent;

                // Send document update as JSONL (one JSON object per line)
                // This is safer than HTML comments which can break if content contains -->
                const updatePayload = JSON.stringify({
                  type: "DOCUMENT_UPDATE",
                  content: result.newContent,
                });
                controller.enqueue(encoder.encode(`\n${updatePayload}\n`));

                toolResult = result.message;
              } else {
                toolResult = `Error: ${result.message}`;
              }

              // Add the assistant's tool use and the result to messages
              currentMessages = [
                ...currentMessages,
                {
                  role: "assistant" as const,
                  content: [
                    {
                      type: "tool_use" as const,
                      id: currentToolUse.id,
                      name: currentToolUse.name,
                      input: toolInput,
                    },
                  ],
                },
                {
                  role: "user" as const,
                  content: [
                    {
                      type: "tool_result" as const,
                      tool_use_id: currentToolUse.id,
                      content: toolResult,
                      is_error: !result.success,
                    },
                  ],
                },
              ];

              currentToolUse = null;
            } else {
              // No tool use, we're done
              continueLoop = false;
            }
          }

          controller.close();
        } catch (error) {
          console.error("Document AI error:", error);
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
    console.error("Document AI API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
