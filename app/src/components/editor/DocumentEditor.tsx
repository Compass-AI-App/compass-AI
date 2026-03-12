import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Placeholder from "@tiptap/extension-placeholder";
import EditorToolbar from "./EditorToolbar";

interface DocumentEditorProps {
  content?: string;
  onChange?: (json: Record<string, unknown>, markdown: string) => void;
  placeholder?: string;
  editable?: boolean;
}

/**
 * Convert Tiptap JSON to simple markdown.
 * This is a basic converter — handles headings, paragraphs, lists, code, images, etc.
 */
function tiptapToMarkdown(doc: Record<string, unknown>): string {
  const content = (doc.content || []) as Record<string, unknown>[];
  return content.map((node) => nodeToMarkdown(node)).join("\n\n");
}

function nodeToMarkdown(node: Record<string, unknown>, depth = 0): string {
  const type = node.type as string;
  const attrs = (node.attrs || {}) as Record<string, unknown>;
  const content = (node.content || []) as Record<string, unknown>[];

  switch (type) {
    case "heading": {
      const level = (attrs.level as number) || 1;
      const prefix = "#".repeat(level);
      return `${prefix} ${inlineContent(content)}`;
    }
    case "paragraph":
      return inlineContent(content);
    case "bulletList":
      return content.map((item) => `${"  ".repeat(depth)}- ${nodeToMarkdown(item, depth + 1)}`).join("\n");
    case "orderedList":
      return content.map((item, i) => `${"  ".repeat(depth)}${i + 1}. ${nodeToMarkdown(item, depth + 1)}`).join("\n");
    case "listItem":
      return content.map((c) => nodeToMarkdown(c, depth)).join("\n");
    case "taskList":
      return content.map((item) => {
        const checked = ((item.attrs || {}) as Record<string, unknown>).checked ? "x" : " ";
        return `- [${checked}] ${nodeToMarkdown(item, depth)}`;
      }).join("\n");
    case "taskItem":
      return content.map((c) => nodeToMarkdown(c, depth)).join("\n");
    case "blockquote":
      return content.map((c) => `> ${nodeToMarkdown(c)}`).join("\n");
    case "codeBlock": {
      const lang = (attrs.language as string) || "";
      const code = inlineContent(content);
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }
    case "horizontalRule":
      return "---";
    case "image":
      return `![${attrs.alt || ""}](${attrs.src || ""})`;
    default:
      return inlineContent(content);
  }
}

function inlineContent(nodes: Record<string, unknown>[]): string {
  return nodes
    .map((node) => {
      if (node.type === "text") {
        let text = node.text as string;
        const marks = (node.marks || []) as Record<string, unknown>[];
        for (const mark of marks) {
          switch (mark.type) {
            case "bold":
              text = `**${text}**`;
              break;
            case "italic":
              text = `*${text}*`;
              break;
            case "strike":
              text = `~~${text}~~`;
              break;
            case "code":
              text = `\`${text}\``;
              break;
          }
        }
        return text;
      }
      if (node.type === "hardBreak") return "\n";
      return nodeToMarkdown(node);
    })
    .join("");
}

export default function DocumentEditor({
  content = "",
  onChange,
  placeholder = "Start writing...",
  editable = true,
}: DocumentEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: {
          HTMLAttributes: {
            class: "bg-neutral-900 rounded-lg p-3 font-mono text-sm",
          },
        },
      }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: content
      ? content
      : undefined,
    editable,
    editorProps: {
      attributes: {
        class:
          "prose prose-invert prose-sm max-w-none px-4 py-3 min-h-[200px] focus:outline-none " +
          "prose-headings:text-compass-text prose-p:text-compass-text/90 " +
          "prose-strong:text-compass-text prose-code:text-compass-accent " +
          "prose-blockquote:border-compass-accent/30 prose-hr:border-compass-border " +
          "prose-li:text-compass-text/90 prose-a:text-compass-accent",
      },
    },
    onUpdate: ({ editor: e }) => {
      if (onChange) {
        const json = e.getJSON();
        const md = tiptapToMarkdown(json);
        onChange(json, md);
      }
    },
  });

  return (
    <div className="rounded-xl bg-compass-card border border-compass-border overflow-hidden">
      {editable && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
