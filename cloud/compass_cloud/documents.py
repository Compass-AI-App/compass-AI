"""Cloud document sharing — upload documents for shareable links."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

# In-memory shared document store
_shared_docs: dict[str, "SharedDocument"] = {}


class SharedDocument(BaseModel):
    """A document shared via Cloud."""
    id: str
    owner_id: str
    title: str
    doc_type: str = "custom"
    content_markdown: str = ""
    content_html: str = ""
    password_hash: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now().isoformat())
    view_count: int = 0


class ShareDocumentRequest(BaseModel):
    title: str
    doc_type: str = "custom"
    content_markdown: str = ""
    content_html: str = ""
    password: Optional[str] = None


class ShareDocumentResponse(BaseModel):
    id: str
    url: str


class SharedDocumentView(BaseModel):
    title: str
    doc_type: str
    content_markdown: str
    content_html: str
    created_at: str


def share_document(owner_id: str, req: ShareDocumentRequest) -> SharedDocument:
    """Create a shared document and return it."""
    doc_id = secrets.token_urlsafe(8)
    password_hash = ""
    if req.password:
        password_hash = hashlib.sha256(req.password.encode()).hexdigest()

    doc = SharedDocument(
        id=doc_id,
        owner_id=owner_id,
        title=req.title,
        doc_type=req.doc_type,
        content_markdown=req.content_markdown,
        content_html=req.content_html,
        password_hash=password_hash,
    )
    _shared_docs[doc_id] = doc
    return doc


def get_shared_document(doc_id: str, password: Optional[str] = None) -> Optional[SharedDocument]:
    """Retrieve a shared document, checking password if set."""
    doc = _shared_docs.get(doc_id)
    if not doc:
        return None
    if doc.password_hash:
        if not password:
            return None
        if hashlib.sha256(password.encode()).hexdigest() != doc.password_hash:
            return None
    doc.view_count += 1
    return doc


def delete_shared_document(doc_id: str, owner_id: str) -> bool:
    """Delete a shared document (owner only)."""
    doc = _shared_docs.get(doc_id)
    if not doc or doc.owner_id != owner_id:
        return False
    del _shared_docs[doc_id]
    return True


def list_shared_documents(owner_id: str) -> list[SharedDocument]:
    """List shared documents for an owner."""
    return [d for d in _shared_docs.values() if d.owner_id == owner_id]
