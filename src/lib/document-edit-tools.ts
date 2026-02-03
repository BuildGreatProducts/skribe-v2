import Anthropic from "@anthropic-ai/sdk";
import { SelectionContext } from "./document-ai-prompts";

// Tool definitions for Claude
export const DOCUMENT_EDIT_TOOLS: Anthropic.Tool[] = [
  {
    name: "replace_selection",
    description:
      "Replace the currently selected text with new content. Only use when the user has selected specific text and wants to modify it.",
    input_schema: {
      type: "object" as const,
      properties: {
        new_content: {
          type: "string",
          description: "The new content to replace the selection with",
        },
        explanation: {
          type: "string",
          description: "Brief explanation of the change made (1-2 sentences)",
        },
      },
      required: ["new_content"],
    },
  },
  {
    name: "insert_at_position",
    description:
      "Insert new content at a specific position in the document. Use 'start', 'end', 'after_heading:HeadingText', or 'line:N' for line number.",
    input_schema: {
      type: "object" as const,
      properties: {
        position: {
          type: "string",
          description:
            "Where to insert: 'start', 'end', 'after_heading:HeadingText', or 'line:N'",
        },
        content: {
          type: "string",
          description: "The markdown content to insert",
        },
      },
      required: ["position", "content"],
    },
  },
  {
    name: "replace_section",
    description:
      "Replace an entire section (heading + content until next same-level or higher heading) with new content.",
    input_schema: {
      type: "object" as const,
      properties: {
        section_heading: {
          type: "string",
          description: "The exact text of the section heading to replace",
        },
        new_content: {
          type: "string",
          description: "The new content for the section (include the heading)",
        },
      },
      required: ["section_heading", "new_content"],
    },
  },
  {
    name: "find_and_replace",
    description:
      "Find specific text in the document and replace it. Use for targeted changes when selection is not available.",
    input_schema: {
      type: "object" as const,
      properties: {
        find_text: {
          type: "string",
          description: "The exact text to find (case-sensitive)",
        },
        replace_with: {
          type: "string",
          description: "The text to replace it with",
        },
        replace_all: {
          type: "boolean",
          description:
            "Whether to replace all occurrences (default: false, only first)",
        },
      },
      required: ["find_text", "replace_with"],
    },
  },
  {
    name: "rewrite_document",
    description:
      "Replace the entire document content. Only use when major restructuring is needed and the user has confirmed.",
    input_schema: {
      type: "object" as const,
      properties: {
        new_content: {
          type: "string",
          description: "The complete new document content in markdown",
        },
        summary: {
          type: "string",
          description: "Brief summary of the major changes made",
        },
      },
      required: ["new_content", "summary"],
    },
  },
];

// Tool execution result
export interface ToolExecutionResult {
  success: boolean;
  newContent: string;
  message: string;
}

// Escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Execute a document editing tool
export function executeDocumentTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  documentContent: string,
  selectionContext?: SelectionContext
): ToolExecutionResult {
  switch (toolName) {
    case "replace_selection":
      return handleReplaceSelection(
        documentContent,
        toolInput,
        selectionContext
      );

    case "insert_at_position":
      return handleInsertAtPosition(documentContent, toolInput);

    case "replace_section":
      return handleReplaceSection(documentContent, toolInput);

    case "find_and_replace":
      return handleFindAndReplace(documentContent, toolInput);

    case "rewrite_document":
      return {
        success: true,
        newContent: toolInput.new_content as string,
        message: (toolInput.summary as string) || "Document rewritten",
      };

    default:
      return {
        success: false,
        newContent: documentContent,
        message: `Unknown tool: ${toolName}`,
      };
  }
}

function handleReplaceSelection(
  content: string,
  input: Record<string, unknown>,
  selectionContext?: SelectionContext
): ToolExecutionResult {
  // Validate selectionContext exists
  if (!selectionContext) {
    return {
      success: false,
      newContent: content,
      message: "No text is currently selected. Please select text first.",
    };
  }

  // Validate input.new_content exists and is a string
  if (input.new_content === undefined || input.new_content === null) {
    return {
      success: false,
      newContent: content,
      message: "Missing new_content parameter for replacement.",
    };
  }

  if (typeof input.new_content !== "string") {
    return {
      success: false,
      newContent: content,
      message: "new_content must be a string.",
    };
  }

  // Validate offsets are numbers
  const startOffset = selectionContext.startOffset;
  const endOffset = selectionContext.endOffset;

  if (typeof startOffset !== "number" || typeof endOffset !== "number") {
    return {
      success: false,
      newContent: content,
      message: "Invalid selection offsets.",
    };
  }

  // Validate offset bounds
  if (startOffset < 0 || endOffset < 0) {
    return {
      success: false,
      newContent: content,
      message: "Selection offsets cannot be negative.",
    };
  }

  if (startOffset > endOffset) {
    return {
      success: false,
      newContent: content,
      message: "Invalid selection: start offset is greater than end offset.",
    };
  }

  if (endOffset > content.length) {
    return {
      success: false,
      newContent: content,
      message: "Selection extends beyond document length. The document may have changed since selection.",
    };
  }

  const newContent = input.new_content;
  const before = content.slice(0, startOffset);
  const after = content.slice(endOffset);

  return {
    success: true,
    newContent: before + newContent + after,
    message:
      (input.explanation as string) ||
      `Replaced selection with new content`,
  };
}

function handleInsertAtPosition(
  content: string,
  input: Record<string, unknown>
): ToolExecutionResult {
  const position = input.position as string;
  const insertContent = input.content as string;

  if (position === "start") {
    return {
      success: true,
      newContent: insertContent + "\n\n" + content,
      message: "Content inserted at start of document",
    };
  }

  if (position === "end") {
    return {
      success: true,
      newContent: content + "\n\n" + insertContent,
      message: "Content inserted at end of document",
    };
  }

  if (position.startsWith("after_heading:")) {
    const headingText = position.slice("after_heading:".length);
    const headingRegex = new RegExp(
      `^(#{1,6})\\s*${escapeRegex(headingText)}\\s*$`,
      "m"
    );
    const match = headingRegex.exec(content);

    if (match) {
      const insertPoint = match.index + match[0].length;
      return {
        success: true,
        newContent:
          content.slice(0, insertPoint) +
          "\n\n" +
          insertContent +
          content.slice(insertPoint),
        message: `Content inserted after "${headingText}"`,
      };
    }

    return {
      success: false,
      newContent: content,
      message: `Heading "${headingText}" not found in document`,
    };
  }

  if (position.startsWith("line:")) {
    const lineNum = parseInt(position.slice(5));
    const lines = content.split("\n");

    if (lineNum > 0 && lineNum <= lines.length + 1) {
      lines.splice(lineNum - 1, 0, insertContent);
      return {
        success: true,
        newContent: lines.join("\n"),
        message: `Content inserted at line ${lineNum}`,
      };
    }

    return {
      success: false,
      newContent: content,
      message: `Invalid line number: ${lineNum}. Document has ${lines.length} lines.`,
    };
  }

  return {
    success: false,
    newContent: content,
    message: `Unknown position format: ${position}. Use 'start', 'end', 'after_heading:HeadingText', or 'line:N'.`,
  };
}

function handleReplaceSection(
  content: string,
  input: Record<string, unknown>
): ToolExecutionResult {
  const sectionHeading = input.section_heading as string;
  const newContent = input.new_content as string;

  // Find the section heading
  const headingRegex = new RegExp(
    `^(#{1,6})\\s*${escapeRegex(sectionHeading)}\\s*$`,
    "m"
  );
  const match = headingRegex.exec(content);

  if (!match) {
    return {
      success: false,
      newContent: content,
      message: `Section "${sectionHeading}" not found in document`,
    };
  }

  const headingLevel = match[1].length;
  const sectionStart = match.index;

  // Find the end of this section (next heading of same or higher level)
  const afterHeading = content.slice(sectionStart + match[0].length);
  const endRegex = new RegExp(`^#{1,${headingLevel}}\\s`, "m");
  const endMatch = endRegex.exec(afterHeading);

  const sectionEnd = endMatch
    ? sectionStart + match[0].length + endMatch.index
    : content.length;

  return {
    success: true,
    newContent:
      content.slice(0, sectionStart) + newContent + content.slice(sectionEnd),
    message: `Section "${sectionHeading}" replaced`,
  };
}

function handleFindAndReplace(
  content: string,
  input: Record<string, unknown>
): ToolExecutionResult {
  const findText = input.find_text as string;
  const replaceWith = input.replace_with as string;
  const replaceAll = (input.replace_all as boolean) || false;

  if (!content.includes(findText)) {
    return {
      success: false,
      newContent: content,
      message: `Text "${findText.slice(0, 50)}${findText.length > 50 ? "..." : ""}" not found in document`,
    };
  }

  const newContent = replaceAll
    ? content.split(findText).join(replaceWith)
    : content.replace(findText, replaceWith);

  const count = replaceAll
    ? (content.match(new RegExp(escapeRegex(findText), "g")) || []).length
    : 1;

  return {
    success: true,
    newContent,
    message: `Replaced ${count} occurrence${count > 1 ? "s" : ""}`,
  };
}
