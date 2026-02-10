import Anthropic from "@anthropic-ai/sdk";

// GitHub codebase tool definitions for the AI agent
export const GITHUB_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_repo_tree",
    description:
      "Get the full directory tree of the connected GitHub repository. Use this first to understand the project structure before reading specific files. Returns file paths and types.",
    input_schema: {
      type: "object" as const,
      properties: {
        branch: {
          type: "string",
          description:
            "The branch to get the tree from. Defaults to the repository's default branch if not specified.",
        },
      },
      required: [],
    },
  },
  {
    name: "list_repo_directory",
    description:
      "List files and folders at a specific path in the repository. Use to browse into specific directories.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description:
            "Directory path relative to repo root, e.g. 'src/components'. Use empty string or '/' for root.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "read_repo_file",
    description:
      "Read the contents of a specific file from the connected GitHub repository. Use when you need to understand implementation details, configurations, or code patterns.",
    input_schema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string",
          description:
            "File path relative to repo root, e.g. 'src/index.ts' or 'package.json'",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "search_repo_code",
    description:
      "Search for code patterns, function names, or keywords across the entire repository. Use when looking for specific implementations, usages, or TODOs.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description:
            "Search query — function names, keywords, patterns, etc. GitHub code search syntax supported.",
        },
      },
      required: ["query"],
    },
  },
];

// Maximum content sizes to prevent context window bloat
const MAX_FILE_CONTENT_CHARS = 30000;
const MAX_TREE_ENTRIES = 500;
const MAX_SEARCH_RESULTS = 20;

interface GitHubApiOptions {
  token: string;
  repoName: string; // owner/repo format
}

async function githubFetch(
  url: string,
  token: string,
  accept?: string
): Promise<Response> {
  return fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept || "application/vnd.github.v3+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
}

function formatError(status: number, message: string): string {
  switch (status) {
    case 401:
      return "Error: GitHub authentication failed. The user may need to reconnect their GitHub account.";
    case 403:
      return `Error: Access forbidden. ${message.includes("rate limit") ? "GitHub API rate limit exceeded. Try again shortly." : "The token may not have access to this repository."}`;
    case 404:
      return "Error: Not found. The file, directory, or repository does not exist, or the token lacks access.";
    default:
      return `Error: GitHub API returned status ${status}. ${message}`;
  }
}

export async function executeGitHubTool(
  toolName: string,
  input: Record<string, unknown>,
  options: GitHubApiOptions
): Promise<string> {
  const { token, repoName } = options;

  try {
    switch (toolName) {
      case "get_repo_tree": {
        const branch = (input.branch as string) || "";

        // If no branch specified, get the default branch first
        let treeBranch = branch;
        if (!treeBranch) {
          const repoResp = await githubFetch(
            `https://api.github.com/repos/${repoName}`,
            token
          );
          if (!repoResp.ok) {
            const errBody = await repoResp.text();
            return formatError(repoResp.status, errBody);
          }
          const repoData = await repoResp.json();
          treeBranch = repoData.default_branch || "main";
        }

        const resp = await githubFetch(
          `https://api.github.com/repos/${repoName}/git/trees/${treeBranch}?recursive=1`,
          token
        );

        if (!resp.ok) {
          const errBody = await resp.text();
          return formatError(resp.status, errBody);
        }

        const data = await resp.json();
        const tree = data.tree as Array<{
          path: string;
          type: string;
          size?: number;
        }>;

        if (!tree || tree.length === 0) {
          return "The repository appears to be empty.";
        }

        const truncated = tree.length > MAX_TREE_ENTRIES;
        const entries = tree.slice(0, MAX_TREE_ENTRIES);

        let result = `Repository tree for ${repoName} (branch: ${treeBranch}):\n\n`;
        for (const entry of entries) {
          const prefix = entry.type === "tree" ? "[dir]  " : "[file] ";
          const size =
            entry.size !== undefined ? ` (${formatFileSize(entry.size)})` : "";
          result += `${prefix}${entry.path}${size}\n`;
        }

        if (truncated) {
          result += `\n... truncated (showing ${MAX_TREE_ENTRIES} of ${tree.length} entries). Use list_repo_directory to browse specific folders.`;
        }

        return result;
      }

      case "list_repo_directory": {
        const path = ((input.path as string) || "").replace(/^\/+/, "");

        const resp = await githubFetch(
          `https://api.github.com/repos/${repoName}/contents/${path}`,
          token
        );

        if (!resp.ok) {
          const errBody = await resp.text();
          return formatError(resp.status, errBody);
        }

        const data = await resp.json();

        if (!Array.isArray(data)) {
          // It's a file, not a directory
          return `"${path}" is a file, not a directory. Use read_repo_file to read its contents.`;
        }

        const entries = data as Array<{
          name: string;
          type: string;
          size: number;
          path: string;
        }>;

        if (entries.length === 0) {
          return `Directory "${path || "/"}" is empty.`;
        }

        // Sort: directories first, then files
        entries.sort((a, b) => {
          if (a.type === "dir" && b.type !== "dir") return -1;
          if (a.type !== "dir" && b.type === "dir") return 1;
          return a.name.localeCompare(b.name);
        });

        let result = `Contents of ${path || "/"}:\n\n`;
        for (const entry of entries) {
          const prefix = entry.type === "dir" ? "[dir]  " : "[file] ";
          const size =
            entry.type !== "dir" ? ` (${formatFileSize(entry.size)})` : "";
          result += `${prefix}${entry.name}${size}\n`;
        }

        return result;
      }

      case "read_repo_file": {
        const path = (input.path as string) || "";

        if (!path) {
          return "Error: path is required. Provide a file path relative to the repo root.";
        }

        const resp = await githubFetch(
          `https://api.github.com/repos/${repoName}/contents/${path}`,
          token,
          "application/vnd.github.v3.raw"
        );

        if (!resp.ok) {
          const errBody = await resp.text();
          return formatError(resp.status, errBody);
        }

        let content = await resp.text();
        const truncated = content.length > MAX_FILE_CONTENT_CHARS;

        if (truncated) {
          content = content.slice(0, MAX_FILE_CONTENT_CHARS);
          content += `\n\n... file truncated (showing first ${MAX_FILE_CONTENT_CHARS} characters). The file is larger than the display limit.`;
        }

        return `File: ${path}\n\n${content}`;
      }

      case "search_repo_code": {
        const query = (input.query as string) || "";

        if (!query) {
          return "Error: query is required. Provide a search term or pattern.";
        }

        const searchQuery = encodeURIComponent(`${query} repo:${repoName}`);
        const resp = await githubFetch(
          `https://api.github.com/search/code?q=${searchQuery}&per_page=${MAX_SEARCH_RESULTS}`,
          token,
          "application/vnd.github.v3.text-match+json"
        );

        if (!resp.ok) {
          const errBody = await resp.text();
          if (resp.status === 422) {
            return "Error: Search query is invalid. Try a simpler search term.";
          }
          return formatError(resp.status, errBody);
        }

        const data = await resp.json();
        const items = data.items as Array<{
          name: string;
          path: string;
          text_matches?: Array<{
            fragment: string;
          }>;
        }>;

        if (!items || items.length === 0) {
          return `No results found for "${query}" in ${repoName}.`;
        }

        let result = `Search results for "${query}" in ${repoName} (${data.total_count} total matches, showing ${items.length}):\n\n`;

        for (const item of items) {
          result += `--- ${item.path} ---\n`;
          if (item.text_matches && item.text_matches.length > 0) {
            for (const match of item.text_matches) {
              result += `${match.fragment}\n`;
            }
          }
          result += "\n";
        }

        return result;
      }

      default:
        return `Error: Unknown GitHub tool "${toolName}".`;
    }
  } catch (error) {
    return `Error executing ${toolName}: ${error instanceof Error ? error.message : "Unknown error"}`;
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
