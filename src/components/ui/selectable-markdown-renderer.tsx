"use client";

import { useMemo } from "react";
import DOMPurify from "dompurify";
import { useTextSelection, SelectionContext } from "@/hooks/use-text-selection";

interface SelectableMarkdownRendererProps {
  content: string;
  onSelectionChange: (selection: SelectionContext | null) => void;
  selectionEnabled?: boolean;
}

export function SelectableMarkdownRenderer({
  content,
  onSelectionChange,
  selectionEnabled = true,
}: SelectableMarkdownRendererProps) {
  const { containerRef } = useTextSelection({
    content,
    enabled: selectionEnabled,
    onSelect: onSelectionChange,
  });

  const html = useMemo(() => {
    // First, escape HTML entities to preserve literal < and > characters
    let result = content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Headers
    result = result.replace(
      /^### (.*$)/gm,
      '<h3 class="text-lg font-semibold mt-6 mb-3">$1</h3>'
    );
    result = result.replace(
      /^## (.*$)/gm,
      '<h2 class="text-xl font-semibold mt-8 mb-4">$1</h2>'
    );
    result = result.replace(
      /^# (.*$)/gm,
      '<h1 class="text-2xl font-bold mt-8 mb-4">$1</h1>'
    );

    // Bold and italic
    result = result.replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>");
    result = result.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    result = result.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Inline code
    result = result.replace(
      /`(.*?)`/g,
      '<code class="rounded bg-muted px-1.5 py-0.5 text-sm font-mono">$1</code>'
    );

    // Unordered lists
    result = result.replace(/^\s*[-*]\s+(.*$)/gm, '<li class="ul-item">$1</li>');
    result = result.replace(
      /(<li class="ul-item">.*?<\/li>\n?)+/g,
      '<ul class="list-disc pl-6 my-4">$&</ul>'
    );
    result = result.replace(/class="ul-item"/g, 'class="ml-4"');

    // Ordered lists
    result = result.replace(/^\s*\d+\.\s+(.*$)/gm, '<li class="ol-item">$1</li>');
    result = result.replace(
      /(<li class="ol-item">.*?<\/li>\n?)+/g,
      '<ol class="list-decimal pl-6 my-4">$&</ol>'
    );
    result = result.replace(/class="ol-item"/g, 'class="ml-4"');

    // Blockquotes
    result = result.replace(
      /^>\s+(.*$)/gm,
      '<blockquote class="border-l-4 border-primary pl-4 italic my-4">$1</blockquote>'
    );

    // Horizontal rules
    result = result.replace(/^---$/gm, '<hr class="my-8 border-border" />');

    // Paragraphs
    result = result.replace(/\n\n/g, '</p><p class="my-4">');
    result = '<p class="my-4">' + result + "</p>";

    // Clean up paragraph wrapping around block elements
    result = result.replace(/<p class="my-4"><\/p>/g, "");
    result = result.replace(/<p class="my-4">(<h[1-3])/g, "$1");
    result = result.replace(/(<\/h[1-3]>)<\/p>/g, "$1");
    result = result.replace(/<p class="my-4">(<ul)/g, "$1");
    result = result.replace(/(<\/ul>)<\/p>/g, "$1");
    result = result.replace(/<p class="my-4">(<ol)/g, "$1");
    result = result.replace(/(<\/ol>)<\/p>/g, "$1");
    result = result.replace(/<p class="my-4">(<blockquote)/g, "$1");
    result = result.replace(/(<\/blockquote>)<\/p>/g, "$1");
    result = result.replace(/<p class="my-4">(<hr)/g, "$1");

    return DOMPurify.sanitize(result, {
      ALLOWED_TAGS: [
        "h1",
        "h2",
        "h3",
        "p",
        "strong",
        "em",
        "code",
        "ul",
        "ol",
        "li",
        "blockquote",
        "hr",
        "br",
      ],
      ALLOWED_ATTR: ["class"],
    });
  }, [content]);

  return (
    <div
      ref={containerRef}
      className="select-text cursor-text"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export type { SelectionContext };
