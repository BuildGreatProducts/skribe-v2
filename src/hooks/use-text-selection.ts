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

      // Find the selected text in the search area (exact match first)
      const index = searchArea.indexOf(selectedText);
      if (index !== -1) {
        const start = searchStart + index;
        return { start, end: start + selectedText.length };
      }

      // Try a fuzzy match within a scoped window to avoid matching duplicates elsewhere
      // Only normalize the search window, not the entire document
      const normalizedSelected = selectedText.replace(/\s+/g, " ").trim();
      const normalizedSearchArea = searchArea.replace(/\s+/g, " ");
      const normalizedIndex = normalizedSearchArea.indexOf(normalizedSelected);

      if (normalizedIndex !== -1) {
        // Map back to original positions within the search area
        let originalPos = 0;
        let normalizedPos = 0;

        while (normalizedPos < normalizedIndex && originalPos < searchArea.length) {
          if (/\s/.test(searchArea[originalPos])) {
            // Skip whitespace in original, count as 1 in normalized
            while (originalPos < searchArea.length && /\s/.test(searchArea[originalPos])) {
              originalPos++;
            }
            normalizedPos++;
          } else {
            originalPos++;
            normalizedPos++;
          }
        }

        const start = searchStart + originalPos;
        // Find end similarly
        let endPos = originalPos;
        let selectedPos = 0;
        while (selectedPos < selectedText.length && endPos < searchArea.length) {
          if (/\s/.test(searchArea[endPos]) && /\s/.test(selectedText[selectedPos])) {
            while (endPos < searchArea.length && /\s/.test(searchArea[endPos])) endPos++;
            while (selectedPos < selectedText.length && /\s/.test(selectedText[selectedPos])) selectedPos++;
          } else if (searchArea[endPos] === selectedText[selectedPos]) {
            endPos++;
            selectedPos++;
          } else {
            break;
          }
        }

        return { start, end: searchStart + endPos };
      }

      return null;
    },
    [content]
  );

  const handleSelectionChange = useCallback(() => {
    if (!enabled || !containerRef.current) {
      onSelect(null);
      return;
    }

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      onSelect(null);
      return;
    }

    // Check if selection is within our container
    if (
      !containerRef.current.contains(selection.anchorNode) ||
      !containerRef.current.contains(selection.focusNode)
    ) {
      onSelect(null);
      return;
    }

    const selectedText = selection.toString();
    if (!selectedText.trim()) {
      onSelect(null);
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
    } else {
      onSelect(null);
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
