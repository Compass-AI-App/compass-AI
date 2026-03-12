import { Mark, mergeAttributes } from "@tiptap/core";

export interface CitationAttributes {
  evidenceId: string;
  source: string;
}

/**
 * Tiptap mark extension for inline evidence citations.
 * Renders as a styled span with evidence metadata.
 */
export const Citation = Mark.create({
  name: "citation",

  addAttributes() {
    return {
      evidenceId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-evidence-id"),
        renderHTML: (attributes) => ({
          "data-evidence-id": attributes.evidenceId as string,
        }),
      },
      source: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-source"),
        renderHTML: (attributes) => ({
          "data-source": attributes.source as string,
        }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-evidence-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, {
        class: "citation-mark",
        style:
          "background: rgba(99, 102, 241, 0.15); color: rgb(129, 140, 248); border-radius: 3px; padding: 1px 4px; font-size: 0.85em; cursor: pointer;",
      }),
      0,
    ];
  },
});
