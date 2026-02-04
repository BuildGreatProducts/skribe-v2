import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { buildSystemPrompt } from "@/lib/system-prompts";
import {
  DOCUMENT_EDIT_TOOLS,
  executeDocumentTool,
} from "@/lib/document-edit-tools";
import { SelectionContext } from "@/lib/document-ai-prompts";
import Anthropic from "@anthropic-ai/sdk";

// Agent types that benefit from web search capability
const WEB_SEARCH_ENABLED_AGENTS = new Set([
  "market_validation", // Research competitors, market size, trends
  "tech_stack", // Latest frameworks, documentation, best practices
  "go_to_market", // Industry trends, marketing strategies
  "new_features", // Competitor features, industry standards
  "custom", // General research capability
]);

// Web search tool definition (Anthropic native)
const WEB_SEARCH_TOOL: Anthropic.WebSearchTool20250305 = {
  type: "web_search_20250305",
  name: "web_search",
  max_uses: 5, // Limit searches per request to control costs
};

// Type for citation in web search results
interface WebSearchCitation {
  type: "web_search_result_location";
  url: string;
  title: string;
  cited_text: string;
  encrypted_index?: string;
}

// Document type mapping from agent type to document type
const AGENT_TYPE_TO_DOC_TYPE: Record<string, string> = {
  idea_refinement: "prd",
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

    // Create a per-request Convex client to avoid auth leaking between requests
    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(token);

    const body = await request.json();
    const {
      agentId,
      projectId,
      message,
      activeDocumentId,
      activeDocumentContent,
      selectionContext,
    } = body as {
      agentId: string;
      projectId: string;
      message: string;
      activeDocumentId?: string;
      activeDocumentContent?: string;
      selectionContext?: SelectionContext;
    };

    if (!agentId || !projectId || !message) {
      return NextResponse.json(
        { error: "Missing required fields: agentId, projectId, message" },
        { status: 400 }
      );
    }

    // Resolve the Convex user from Clerk ID
    const user = await convex.query(api.users.getByClerkId, {
      clerkId: authResult.userId,
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

    // Track the active document content for editing (mutable for tool loop)
    let currentDocumentContent = activeDocumentContent || "";

    // Build system prompt with document context and tool instructions
    const baseSystemPrompt =
      agent.systemPrompt || buildSystemPrompt(agent.type, documents);

    // Check if web search is enabled for this agent type (needed for prompt building)
    const webSearchEnabledForPrompt = WEB_SEARCH_ENABLED_AGENTS.has(agent.type);

    // Build tool instructions based on context
    const buildToolInstructions = () => {
      let instructions = `

## Available Tools

You have access to the following tools for document management:

1. **create_document**: Create a new document when you have enough information from the conversation. Always ask the user for confirmation before creating a document. After gathering sufficient information, say something like "I can create a [Document Type] document based on our discussion. Would you like me to create it now?"

2. **update_document**: Update an existing document when the user wants to make changes. Reference the document by its ID.`;

      // Add web search instructions if enabled
      if (webSearchEnabledForPrompt) {
        instructions += `

### Web Search

You have access to **web_search** to find current information from the internet. Use this tool when:
- The user asks about current market trends, competitors, or industry data
- You need up-to-date information about technologies, frameworks, or tools
- Research is needed for market validation, competitive analysis, or go-to-market strategies
- The user explicitly asks you to search for something online

When using web search:
- Be specific with your search queries for better results
- Cite your sources when presenting information from search results
- Synthesize information from multiple sources when relevant
- Clearly indicate when information comes from web search vs. your training data`;
      }

      // Add editing tools if a document is actively being edited
      if (activeDocumentId) {
        const activeDoc = fullDocuments.find((d) => d._id === activeDocumentId);
        instructions += `

### Active Document for Editing

The user has the following document open for editing:
- **Title:** ${activeDoc?.title || "Unknown"}
- **Type:** ${activeDoc?.type || "unknown"}
- **ID:** ${activeDocumentId}

**Current Document Content:**
\`\`\`markdown
${currentDocumentContent}
\`\`\``;

        if (selectionContext) {
          instructions += `

**Currently Selected Text:**
"${selectionContext.text}"
(Position: characters ${selectionContext.startOffset} to ${selectionContext.endOffset})

When the user asks to edit, rewrite, or change the selected text, use the **replace_selection** tool.`;
        }

        instructions += `

### Document Editing Tools (for the active document)

You also have access to these editing tools for the active document:

3. **replace_selection**: Replace the currently selected text with new content. Only use when text is selected.

4. **insert_at_position**: Insert new content at a specific position. Use 'start', 'end', 'after_heading:HeadingText', or 'line:N'.

5. **replace_section**: Replace an entire section by its heading.

6. **find_and_replace**: Find and replace specific text in the document.

7. **rewrite_document**: Replace the entire document content. Only use for major restructuring after user confirmation.`;
      }

      instructions += `

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

      return instructions;
    };

    // Function to rebuild system prompt with current document content
    const buildCurrentSystemPrompt = () =>
      baseSystemPrompt + buildToolInstructions();

    let systemPrompt = buildCurrentSystemPrompt();

    // Determine which tools to provide
    const baseTools: Anthropic.Tool[] = activeDocumentId
      ? [...DOCUMENT_TOOLS, ...DOCUMENT_EDIT_TOOLS]
      : DOCUMENT_TOOLS;

    // Check if web search is enabled for this agent type
    const webSearchEnabled = WEB_SEARCH_ENABLED_AGENTS.has(agent.type);

    // Build tools array with optional web search
    // Note: web_search uses a different type format than regular tools
    const tools: Anthropic.Messages.ToolUnion[] = webSearchEnabled
      ? [...baseTools, WEB_SEARCH_TOOL]
      : baseTools;

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
            // Rebuild system prompt with latest document content
            systemPrompt = buildCurrentSystemPrompt();

            const response = await anthropic.messages.create({
              model: "claude-sonnet-4-20250514",
              max_tokens: 4096,
              system: systemPrompt,
              messages: currentMessages,
              tools,
              stream: true,
            });

            let currentToolUse: {
              id: string;
              name: string;
              input: string;
            } | null = null;
            let stopReason: string | null = null;
            // Track citations from web search for the frontend
            const collectedCitations: WebSearchCitation[] = [];
            // Track current text block for citation handling
            let currentTextBlockIndex: number | null = null;
            // Store content blocks for continuation (needed for pause_turn)
            const responseContentBlocks: Anthropic.ContentBlock[] = [];

            for await (const event of response) {
              if (event.type === "content_block_start") {
                if (event.content_block.type === "tool_use") {
                  currentToolUse = {
                    id: event.content_block.id,
                    name: event.content_block.name,
                    input: "",
                  };
                  responseContentBlocks.push(event.content_block);
                } else if (event.content_block.type === "server_tool_use") {
                  // Web search is a server-executed tool - track it for response continuation
                  responseContentBlocks.push(event.content_block);
                  // Notify frontend that a web search is happening
                  const searchMarker = JSON.stringify({
                    type: "WEB_SEARCH_STARTED",
                    query: "", // Will be filled in by delta
                  });
                  controller.enqueue(encoder.encode(`\n${searchMarker}\n`));
                } else if (event.content_block.type === "web_search_tool_result") {
                  // Web search results received
                  responseContentBlocks.push(event.content_block);
                } else if (event.content_block.type === "text") {
                  currentTextBlockIndex = responseContentBlocks.length;
                  responseContentBlocks.push(event.content_block);
                }
              } else if (event.type === "content_block_delta") {
                if (event.delta.type === "text_delta") {
                  controller.enqueue(encoder.encode(event.delta.text));
                  // Check for citations in the delta (they come with text blocks)
                  const delta = event.delta as Anthropic.TextDelta & {
                    citations?: WebSearchCitation[];
                  };
                  if (delta.citations && delta.citations.length > 0) {
                    collectedCitations.push(...delta.citations);
                  }
                } else if (
                  event.delta.type === "input_json_delta" &&
                  currentToolUse
                ) {
                  currentToolUse.input += event.delta.partial_json;
                }
              } else if (event.type === "content_block_stop") {
                // When a text block with citations finishes, send citations to frontend
                if (
                  currentTextBlockIndex !== null &&
                  collectedCitations.length > 0
                ) {
                  const citationMarker = JSON.stringify({
                    type: "WEB_SEARCH_CITATIONS",
                    citations: collectedCitations.map((c) => ({
                      url: c.url,
                      title: c.title,
                      citedText: c.cited_text,
                    })),
                  });
                  controller.enqueue(encoder.encode(`\n${citationMarker}\n`));
                  collectedCitations.length = 0; // Clear for next block
                }
                currentTextBlockIndex = null;
              } else if (event.type === "message_delta") {
                stopReason = event.delta.stop_reason;
              }
            }

            // Handle pause_turn - continue the conversation with accumulated content
            if (stopReason === "pause_turn") {
              // The API paused a long-running turn, continue with accumulated content
              currentMessages = [
                ...currentMessages,
                {
                  role: "assistant" as const,
                  content: responseContentBlocks,
                },
              ];
              // Continue the loop to let Claude finish its turn
              currentToolUse = null;
              continue;
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
                  const newDocumentId = await convex.mutation(
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

                  toolResult = `Document "${title}" created successfully with ID: ${newDocumentId}. The document is now available in the project dashboard.`;

                  // Send JSONL marker so client knows a document was created
                  const createMarker = JSON.stringify({
                    type: "DOCUMENT_CREATED",
                    documentId: newDocumentId,
                    title,
                    documentType: docType,
                  });
                  controller.enqueue(encoder.encode(`\n${createMarker}\n`));
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

                  // Send JSONL marker so client knows a document was updated
                  const updateMarker = JSON.stringify({
                    type: "DOCUMENT_UPDATED",
                    documentId: documentIdStr,
                    title: title || "Document",
                  });
                  controller.enqueue(encoder.encode(`\n${updateMarker}\n`));
                } else if (
                  // Handle document editing tools
                  [
                    "replace_selection",
                    "insert_at_position",
                    "replace_section",
                    "find_and_replace",
                    "rewrite_document",
                  ].includes(currentToolUse.name)
                ) {
                  if (!activeDocumentId) {
                    toolResult =
                      "Error: No document is currently open for editing.";
                  } else {
                    // Execute the document editing tool
                    const editResult = executeDocumentTool(
                      currentToolUse.name,
                      toolInput,
                      currentDocumentContent,
                      selectionContext
                    );

                    if (editResult.success) {
                      // Update the document content in memory
                      currentDocumentContent = editResult.newContent;

                      // Update the document in Convex
                      await convex.mutation(api.documents.update, {
                        documentId: activeDocumentId as Id<"documents">,
                        content: currentDocumentContent,
                      });

                      toolResult = editResult.message;

                      // Send JSONL marker so client can update document preview
                      const editMarker = JSON.stringify({
                        type: "DOCUMENT_EDIT",
                        documentId: activeDocumentId,
                        content: currentDocumentContent,
                        message: editResult.message,
                      });
                      controller.enqueue(encoder.encode(`\n${editMarker}\n`));
                    } else {
                      toolResult = `Error: ${editResult.message}`;
                    }
                  }
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
