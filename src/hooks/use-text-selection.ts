"use client";

import { useEffect, useCallback, useRef } from "react";

export interface SelectionContext {
  text: string;
  startOffset: number;
  endOffset: number;
  contentSnapshot: string;
}

interface UseTextSelectionOptions {
  content: string;
  enabled: boolean;
  onSelect: (selection: SelectionContext | null) => void;
}

export function useTextSelection({
  content,
  enabled,
  onSelect,
}: UseTextSelectionOptions) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isSelectingRef = useRef(false);

  // Calculate the text offset within the content from a DOM node and offset
  const getTextOffset = useCallback(
    (container: HTMLElement, targetNode: Node, targetOffset: number): number => {
      let offset = 0;
      const walker = document.createTreeWalker(
        container,
        NodeFilter.SHOW_TEXT,
        null
      );

      let node = walker.nextNode();
      while (node) {
        if (node === targetNode) {
          return offset + targetOffset;
        }
        offset += node.textContent?.length || 0;
        node = walker.nextNode();
      }

      return offset;
    },
    []
  );

  // Find the closest matching position in the markdown content
  const findMarkdownOffset = useCallback(
    (selectedText: string, approximateOffset: number): { start: number; end: number } | null => {
      // Search within a window around the approximate offset
      const windowSize = 500;
      const searchStart = Math.max(0, approximateOffset - windowSize);
      const searchEnd = Math.min(content.length, approximateOffset + selectedText.length + windowSize);
      const searchArea = content.slice(searchStart, searchEnd);

      // Find the selected text in the search area
      const index = searchArea.indexOf(selectedText);
      if (index !== -1) {
        const start = searchStart + index;
        return { start, end: start + selectedText.length };
      }

      // Try a fuzzy match - sometimes whitespace differs between rendered and source
      const normalizedSelected = selectedText.replace(/\s+/g, " ").trim();
      const normalizedContent = content.replace(/\s+/g, " ");
      const normalizedIndex = normalizedContent.indexOf(normalizedSelected);

      if (normalizedIndex !== -1) {
        // Map back to original positions (approximate)
        let originalPos = 0;
        let normalizedPos = 0;

        while (normalizedPos < normalizedIndex && originalPos < content.length) {
          if (/\s/.test(content[originalPos])) {
            // Skip whitespace in original, count as 1 in normalized
            while (originalPos < content.length && /\s/.test(content[originalPos])) {
              originalPos++;
            }
            normalizedPos++;
          } else {
            originalPos++;
            normalizedPos++;
          }
        }

        const start = originalPos;
        // Find end similarly
        let endPos = start;
        let selectedPos = 0;
        while (selectedPos < selectedText.length && endPos < content.length) {
          if (/\s/.test(content[endPos]) && /\s/.test(selectedText[selectedPos])) {
            while (endPos < content.length && /\s/.test(content[endPos])) endPos++;
            while (selectedPos < selectedText.length && /\s/.test(selectedText[selectedPos])) selectedPos++;
          } else if (content[endPos] === selectedText[selectedPos]) {
            endPos++;
            selectedPos++;
          } else {
            break;
          }
        }

        return { start, end: endPos };
      }

      return null;
    },
    [content]
  );

  const handleSelectionChange = useCallback(() => {
    if (!enabled || !containerRef.current) {
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    // Check if selection is within our container
    if (
      !containerRef.current.contains(selection.anchorNode) ||
      !containerRef.current.contains(selection.focusNode)
    ) {
      return;
    }

    const selectedText = selection.toString();
    if (!selectedText.trim()) {
      return;
    }

    // Get approximate offset from DOM
    const range = selection.getRangeAt(0);
    const approximateOffset = getTextOffset(
      containerRef.current,
      range.startContainer,
      range.startOffset
    );

    // Find the actual position in markdown content
    const offsets = findMarkdownOffset(selectedText, approximateOffset);

    if (offsets) {
      onSelect({
        text: selectedText,
        startOffset: offsets.start,
        endOffset: offsets.end,
        contentSnapshot: content,
      });
    }
  }, [enabled, content, getTextOffset, findMarkdownOffset, onSelect]);

  const handleMouseUp = useCallback(() => {
    if (isSelectingRef.current) {
      // Small delay to let the selection settle
      setTimeout(handleSelectionChange, 10);
      isSelectingRef.current = false;
    }
  }, [handleSelectionChange]);

  const handleMouseDown = useCallback(() => {
    isSelectingRef.current = true;
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !enabled) return;

    container.addEventListener("mousedown", handleMouseDown);
    container.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      container.removeEventListener("mouseup", handleMouseUp);
    };
  }, [enabled, handleMouseDown, handleMouseUp]);

  return { containerRef };
}
