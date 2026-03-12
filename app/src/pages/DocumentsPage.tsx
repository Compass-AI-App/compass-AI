import { useEffect, useState } from "react";
import {
  FileText,
  Plus,
  Trash2,
  Clock,
  Tag,
  ChevronLeft,
} from "lucide-react";
import { clsx } from "clsx";
import { useWorkspaceStore } from "../stores/workspace";
import {
  useDocumentsStore,
  type StoredDocument,
} from "../stores/documents";
import DocumentEditor from "../components/editor/DocumentEditor";
import ExportMenu from "../components/editor/ExportMenu";
import ShareButton from "../components/editor/ShareButton";

const DOC_TYPES = [
  { value: "brief", label: "Product Brief" },
  { value: "prd", label: "PRD" },
  { value: "update", label: "Stakeholder Update" },
  { value: "email", label: "Email" },
  { value: "strategy", label: "Strategy" },
  { value: "custom", label: "Custom" },
];

const typeBadgeColor: Record<string, string> = {
  brief: "bg-blue-500/20 text-blue-400",
  prd: "bg-purple-500/20 text-purple-400",
  update: "bg-green-500/20 text-green-400",
  email: "bg-yellow-500/20 text-yellow-400",
  strategy: "bg-red-500/20 text-red-400",
  custom: "bg-gray-500/20 text-gray-400",
};

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function NewDocumentModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (title: string, docType: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("custom");

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-compass-card border border-compass-border rounded-xl p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-compass-text mb-4">
          New Document
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-compass-muted mb-1">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled document"
              autoFocus
              className="w-full px-3 py-2 rounded-lg bg-compass-bg border border-compass-border text-compass-text text-sm focus:outline-none focus:border-compass-accent"
            />
          </div>
          <div>
            <label className="block text-sm text-compass-muted mb-1">
              Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DOC_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setDocType(t.value)}
                  className={clsx(
                    "px-3 py-2 rounded-lg text-sm border transition-colors",
                    docType === t.value
                      ? "border-compass-accent bg-compass-accent/10 text-compass-accent"
                      : "border-compass-border text-compass-muted hover:text-compass-text hover:bg-white/5",
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-compass-muted hover:text-compass-text transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onCreate(title || "Untitled document", docType)}
            className="px-4 py-2 text-sm bg-compass-accent text-white rounded-lg hover:bg-compass-accent/90 transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

function DocumentList({
  documents,
  onSelect,
  onDelete,
  onNew,
}: {
  documents: StoredDocument[];
  onSelect: (doc: StoredDocument) => void;
  onDelete: (docId: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-compass-text">Documents</h2>
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-compass-accent text-white rounded-lg hover:bg-compass-accent/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Document
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-compass-muted/30 mx-auto mb-3" />
          <p className="text-compass-muted text-sm">No documents yet</p>
          <p className="text-compass-muted/60 text-xs mt-1">
            Create your first document to get started
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {documents.map((doc) => (
            <button
              key={doc.id}
              onClick={() => onSelect(doc)}
              className="flex items-start gap-4 p-4 bg-compass-card border border-compass-border rounded-xl hover:border-compass-accent/30 transition-colors text-left group"
            >
              <FileText className="w-5 h-5 text-compass-muted shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-compass-text truncate">
                    {doc.title}
                  </span>
                  <span
                    className={clsx(
                      "px-2 py-0.5 text-xs rounded-full shrink-0",
                      typeBadgeColor[doc.doc_type] || typeBadgeColor.custom,
                    )}
                  >
                    {doc.doc_type}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-compass-muted">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatDate(doc.updated_at)}
                  </span>
                  {doc.tags.length > 0 && (
                    <span className="flex items-center gap-1">
                      <Tag className="w-3 h-3" />
                      {doc.tags.slice(0, 3).join(", ")}
                    </span>
                  )}
                </div>
                {doc.content_markdown && (
                  <p className="text-xs text-compass-muted/70 mt-1 truncate">
                    {doc.content_markdown.slice(0, 120)}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(doc.id);
                }}
                className="p-1.5 rounded-md text-compass-muted hover:text-red-400 hover:bg-red-400/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                title="Delete document"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentEditView({
  doc,
  workspacePath,
  onBack,
}: {
  doc: StoredDocument;
  workspacePath: string;
  onBack: () => void;
}) {
  const saveDocument = useDocumentsStore((s) => s.saveDocument);
  const [title, setTitle] = useState(doc.title);
  const [contentJson, setContentJson] = useState(doc.content_json);
  const [contentMarkdown, setContentMarkdown] = useState(doc.content_markdown);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function handleEditorChange(
    json: Record<string, unknown>,
    markdown: string,
  ) {
    setContentJson(json);
    setContentMarkdown(markdown);
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    await saveDocument(workspacePath, {
      ...doc,
      title,
      content_json: contentJson,
      content_markdown: contentMarkdown,
    });
    setSaving(false);
    setDirty(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-compass-muted hover:text-compass-text transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to documents
        </button>
        <div className="flex items-center gap-3">
          <span
            className={clsx(
              "px-2 py-0.5 text-xs rounded-full",
              typeBadgeColor[doc.doc_type] || typeBadgeColor.custom,
            )}
          >
            {doc.doc_type}
          </span>
          <ShareButton
            title={title}
            docType={doc.doc_type}
            markdown={contentMarkdown}
          />
          <ExportMenu title={title} markdown={contentMarkdown} />
          <button
            onClick={handleSave}
            disabled={saving || !dirty}
            className={clsx(
              "px-4 py-1.5 text-sm rounded-lg transition-colors",
              dirty
                ? "bg-compass-accent text-white hover:bg-compass-accent/90"
                : "bg-compass-card text-compass-muted border border-compass-border",
            )}
          >
            {saving ? "Saving..." : dirty ? "Save" : "Saved"}
          </button>
        </div>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => {
          setTitle(e.target.value);
          setDirty(true);
        }}
        className="w-full text-2xl font-bold bg-transparent text-compass-text border-none outline-none placeholder:text-compass-muted/40"
        placeholder="Document title"
      />

      <DocumentEditor
        content={
          doc.content_json && Object.keys(doc.content_json).length > 0
            ? doc.content_json
            : doc.content_markdown || ""
        }
        onChange={handleEditorChange}
        placeholder="Start writing..."
        workspacePath={workspacePath}
        docType={doc.doc_type}
      />
    </div>
  );
}

export default function DocumentsPage() {
  const workspacePath = useWorkspaceStore((s) => s.workspacePath);
  const {
    documents,
    activeDoc,
    loading,
    loadDocuments,
    deleteDocument,
    createDocument,
    setActiveDoc,
  } = useDocumentsStore();
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    if (workspacePath) loadDocuments(workspacePath);
  }, [workspacePath]);

  async function handleCreate(title: string, docType: string) {
    if (!workspacePath) return;
    const doc = await createDocument(workspacePath, title, docType);
    setShowNewModal(false);
    if (doc) setActiveDoc(doc);
  }

  function handleDelete(docId: string) {
    if (!workspacePath) return;
    deleteDocument(workspacePath, docId);
  }

  if (!workspacePath) {
    return (
      <div className="flex items-center justify-center h-full text-compass-muted text-sm">
        Select a workspace to view documents
      </div>
    );
  }

  if (loading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-compass-muted text-sm">
        Loading documents...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {activeDoc ? (
        <DocumentEditView
          key={activeDoc.id}
          doc={activeDoc}
          workspacePath={workspacePath}
          onBack={() => {
            setActiveDoc(null);
            loadDocuments(workspacePath);
          }}
        />
      ) : (
        <DocumentList
          documents={documents}
          onSelect={setActiveDoc}
          onDelete={handleDelete}
          onNew={() => setShowNewModal(true)}
        />
      )}

      {showNewModal && (
        <NewDocumentModal
          onClose={() => setShowNewModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
