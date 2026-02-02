import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { buildSystemPrompt } from "@/lib/system-prompts";
import Anthropic from "@anthropic-ai/sdk";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Document type mapping from agent type to document type
const AGENT_TYPE_TO_DOC_TYPE: Record<string, string> = {
  product_refinement: "prd",
  market_validation: "market",
  customer_persona: "persona",
  brand_strategy: "brand",
  business_model: "business",
  new_features: "feature",
  tech_stack: "tech",
  create_prd: "prd",
  go_to_market: "gtm",
  custom: "custom",
};

// Claude tool definitions for document management
const DOCUMENT_TOOLS: Anthropic.Tool[] = [
  {
    name: "create_document",
    description:
      "Create a new document for the project. Use this when you've gathered enough information from the conversation to create a comprehensive document. The document will be saved to the project and can be viewed/edited by the user.",
    input_schema: {
      type: "object" as const,
      properties: {
        title: {
          type: "string",
          description:
            "The title of the document (e.g., 'Product Vision', 'Market Analysis', 'Customer Personas')",
        },
        content: {
          type: "string",
          description:
            "The full markdown content of the document. Use proper markdown formatting with headers, lists, etc.",
        },
        type: {
          type: "string",
          enum: [
            "prd",
            "persona",
            "market",
            "brand",
            "business",
            "feature",
            "tech",
            "gtm",
            "custom",
          ],
          description: "The type of document being created",
        },
      },
      required: ["title", "content", "type"],
    },
  },
  {
    name: "update_document",
    description:
      "Update an existing document. Use this when the user wants to edit, revise, or add to an existing document. Provide the complete updated content.",
    input_schema: {
      type: "object" as const,
      properties: {
        document_id: {
          type: "string",
          description: "The ID of the document to update",
        },
        title: {
          type: "string",
          description:
            "The new title for the document (optional, only include if changing)",
        },
        content: {
          type: "string",
          description: "The complete updated markdown content of the document",
        },
      },
      required: ["document_id", "content"],
    },
  },
];

export async function POST(request: NextRequest) {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { agentId, projectId, message } = body;

    if (!agentId || !projectId || !message) {
      return NextResponse.json(
        { error: "Missing required fields: agentId, projectId, message" },
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

    // Verify agent belongs to project and user has access
    const agent = await convex.query(api.agents.getById, {
      agentId: agentId as Id<"agents">,
    });

    if (!agent) {
      return NextResponse.json(
        { error: "Forbidden: Agent not found or you do not have access" },
        { status: 403 }
      );
    }

    // Verify agent belongs to the specified project
    if (agent.projectId !== projectId) {
      return NextResponse.json(
        { error: "Forbidden: Agent does not belong to this project" },
        { status: 403 }
      );
    }

    // Get project documents for context (already ownership-checked)
    const documents = await convex.query(api.documents.getContextForProject, {
      projectId: projectId as Id<"projects">,
    });

    // Get full documents for tool use (need IDs)
    const fullDocuments = await convex.query(api.documents.getByProject, {
      projectId: projectId as Id<"projects">,
    });

    // Get agent history (already ownership-checked)
    const messages = await convex.query(api.messages.getByAgent, {
      agentId: agentId as Id<"agents">,
    });

    // Build system prompt with document context and tool instructions
    const baseSystemPrompt =
      agent.systemPrompt || buildSystemPrompt(agent.type, documents);
    const toolInstructions = `

## Available Tools

You have access to the following tools for document management:

1. **create_document**: Create a new document when you have enough information from the conversation. Always ask the user for confirmation before creating a document. After gathering sufficient information, say something like "I can create a [Document Type] document based on our discussion. Would you like me to create it now?"

2. **update_document**: Update an existing document when the user wants to make changes. Reference the document by its ID.

### Existing Documents

${
  fullDocuments.length > 0
    ? fullDocuments
        .map((doc) => `- **${doc.title}** (ID: ${doc._id}, Type: ${doc.type})`)
        .join("\n")
    : "No documents have been created yet for this project."
}

When creating or updating documents:
- Use clear, well-structured markdown formatting
- Include relevant sections with headers
- Be comprehensive but concise
- Ask clarifying questions if needed before creating`;

    const systemPrompt = baseSystemPrompt + toolInstructions;

    // Format messages for Claude API
    const claudeMessages: Anthropic.MessageParam[] = messages
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

    // Create streaming response with tool support
    const encoder = new TextEncoder();
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
              tools: DOCUMENT_TOOLS,
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
                // Parse tool input - handle malformed JSON gracefully
                toolInput = JSON.parse(currentToolUse.input);
              } catch (parseError) {
                toolResult = `Error: Failed to parse tool input - ${parseError instanceof Error ? parseError.message : "Invalid JSON"}`;

                // Add error response and continue
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

              try {
                if (currentToolUse.name === "create_document") {
                  // Get appropriate document type
                  const docType =
                    (toolInput.type as string) ||
                    AGENT_TYPE_TO_DOC_TYPE[agent.type] ||
                    "custom";
                  const title = toolInput.title as string;
                  const content = toolInput.content as string;

                  // Create the document
                  const documentId = await convex.mutation(
                    api.documents.create,
                    {
                      projectId: projectId as Id<"projects">,
                      title,
                      content,
                      type: docType as
                        | "prd"
                        | "persona"
                        | "market"
                        | "brand"
                        | "business"
                        | "feature"
                        | "tech"
                        | "gtm"
                        | "custom",
                    }
                  );

                  toolResult = `Document "${title}" created successfully with ID: ${documentId}. The document is now available in the project dashboard.`;

                  // Send a special marker to the client so it knows a document was created
                  controller.enqueue(
                    encoder.encode(
                      `\n\n---\n**Document Created:** ${title}\n---\n\n`
                    )
                  );
                } else if (currentToolUse.name === "update_document") {
                  const documentIdStr = toolInput.document_id as string;
                  const title = toolInput.title as string | undefined;
                  const content = toolInput.content as string;

                  // Update the document
                  await convex.mutation(api.documents.update, {
                    documentId: documentIdStr as Id<"documents">,
                    title,
                    content,
                  });

                  toolResult = `Document updated successfully.`;

                  // Send a special marker to the client
                  controller.enqueue(
                    encoder.encode(
                      `\n\n---\n**Document Updated:** ${title || "Document"}\n---\n\n`
                    )
                  );
                } else {
                  toolResult = `Unknown tool: ${currentToolUse.name}`;
                }
              } catch (error) {
                toolResult = `Error: ${error instanceof Error ? error.message : "Failed to execute tool"}`;
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
                    },
                  ],
                },
              ];

              // Continue the loop to get Claude's response to the tool result
              currentToolUse = null;
            } else {
              // No tool use, we're done
              continueLoop = false;
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
    console.error("Agent API error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
