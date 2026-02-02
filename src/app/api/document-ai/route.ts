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
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      documentId,
      projectId,
      message,
      documentContent,
      selectionContext,
      messageHistory,
    } = body as {
      documentId: string;
      projectId: string;
      message: string;
      documentContent: string;
      selectionContext?: SelectionContext;
      messageHistory: ChatMessage[];
    };

    if (!documentId || !projectId || !message || documentContent === undefined) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: documentId, projectId, message, documentContent",
        },
        { status: 400 }
      );
    }

    // Resolve the Convex user from Clerk ID
    const user = await convex.query(api.users.getByClerkId, {
      clerkId: clerkUserId,
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 403 });
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

    // Verify document belongs to project
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

    // Build system prompt with document context
    const systemPrompt = buildDocumentEditPrompt(
      {
        title: document.title,
        content: documentContent, // Use the passed content (may have unsaved edits)
        type: document.type,
      },
      selectionContext
    );

    // Format messages for Claude API
    const claudeMessages: Anthropic.MessageParam[] = (messageHistory || [])
      .filter((m) => m.content.trim() !== "")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Add the new user message
    claudeMessages.push({
      role: "user" as const,
      content: message,
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
            const response = await anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 4096,
              system: systemPrompt,
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

                // Send document update marker to client
                controller.enqueue(
                  encoder.encode(
                    `\n\n<!-- DOCUMENT_UPDATE:${JSON.stringify({ content: result.newContent })} -->\n\n`
                  )
                );

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
