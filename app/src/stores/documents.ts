import { create } from "zustand";

export interface StoredDocument {
  id: string;
  title: string;
  doc_type: string;
  content_json: Record<string, unknown>;
  content_markdown: string;
  created_at: string;
  updated_at: string;
  tags: string[];
  evidence_ids: string[];
}

interface DocumentsState {
  documents: StoredDocument[];
  activeDoc: StoredDocument | null;
  loading: boolean;
  error: string | null;

  loadDocuments: (workspacePath: string) => Promise<void>;
  loadDocument: (workspacePath: string, docId: string) => Promise<void>;
  saveDocument: (workspacePath: string, doc: StoredDocument) => Promise<void>;
  createDocument: (
    workspacePath: string,
    title: string,
    docType: string,
  ) => Promise<StoredDocument | null>;
  deleteDocument: (workspacePath: string, docId: string) => Promise<void>;
  setActiveDoc: (doc: StoredDocument | null) => void;
}

export const useDocumentsStore = create<DocumentsState>((set, get) => ({
  documents: [],
  activeDoc: null,
  loading: false,
  error: null,

  loadDocuments: async (workspacePath) => {
    set({ loading: true, error: null });
    try {
      const res = (await window.compass.engine.call("/documents/list", {
        workspace_path: workspacePath,
      })) as { status: string; documents: StoredDocument[] };
      if (res.status === "ok") {
        set({ documents: res.documents, loading: false });
      } else {
        set({ error: "Failed to load documents", loading: false });
      }
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load documents",
        loading: false,
      });
    }
  },

  loadDocument: async (workspacePath, docId) => {
    try {
      const res = (await window.compass.engine.call("/documents/get", {
        workspace_path: workspacePath,
        id: docId,
      })) as { status: string; document: StoredDocument };
      if (res.status === "ok") {
        set({ activeDoc: res.document });
      }
    } catch {
      // ignore
    }
  },

  saveDocument: async (workspacePath, doc) => {
    try {
      const res = (await window.compass.engine.call("/documents/save", {
        workspace_path: workspacePath,
        id: doc.id,
        title: doc.title,
        doc_type: doc.doc_type,
        content_json: doc.content_json,
        content_markdown: doc.content_markdown,
        tags: doc.tags,
        evidence_ids: doc.evidence_ids,
      })) as { status: string; document: StoredDocument };
      if (res.status === "ok") {
        set({ activeDoc: res.document });
        get().loadDocuments(workspacePath);
      }
    } catch {
      // ignore
    }
  },

  createDocument: async (workspacePath, title, docType) => {
    try {
      const res = (await window.compass.engine.call("/documents/save", {
        workspace_path: workspacePath,
        title,
        doc_type: docType,
      })) as { status: string; document: StoredDocument };
      if (res.status === "ok") {
        get().loadDocuments(workspacePath);
        return res.document;
      }
      return null;
    } catch {
      return null;
    }
  },

  deleteDocument: async (workspacePath, docId) => {
    try {
      await window.compass.engine.call("/documents/delete", {
        workspace_path: workspacePath,
        id: docId,
      });
      set((s) => ({
        documents: s.documents.filter((d) => d.id !== docId),
        activeDoc: s.activeDoc?.id === docId ? null : s.activeDoc,
      }));
    } catch {
      // ignore
    }
  },

  setActiveDoc: (doc) => set({ activeDoc: doc }),
}));
