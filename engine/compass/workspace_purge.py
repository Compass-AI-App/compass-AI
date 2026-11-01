"""Native-invoked, stdlib-only removal of a fixed set of managed workspace files."""

from __future__ import annotations

import json
import os
import shutil
import stat
import sys
from pathlib import Path
from uuid import uuid4

MARKER = "deletion.json"
LEGACY_DATA = (
    "opportunities_cache.json",
    "opportunities.json",
    "conflict_report.json",
    "discovery_history.json",
    "chat_history.json",
    "feedback.json",
    "quality_log.json",
    "last_ingest.txt",
)
TARGETS = (
    "knowledge",
    "documents",
    "task-backups",
    "tasks.sqlite3",
    "tasks.sqlite3-wal",
    "tasks.sqlite3-shm",
    "tasks.sqlite3-journal",
    *LEGACY_DATA,
)
MAX_ENTRIES = 100_000


class PurgeError(ValueError):
    def __init__(self, code, message):
        self.code = code
        super().__init__(message)


def check_available(root: Path):
    if os.path.lexists(root / ".compass" / MARKER):
        raise PurgeError(
            "deletion_pending",
            "Compass data deletion is incomplete. Resume deletion from Workspace before opening saved data.",
        )


def write_private(directory, name, data, check):
    check()
    temporary = f".deletion-{uuid4().hex}.tmp"
    descriptor = os.open(
        temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW,
        0o600, dir_fd=directory,
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as output:
            json.dump(data, output, ensure_ascii=False, allow_nan=False)
            output.flush()
            os.fsync(output.fileno())
        check()
        os.replace(temporary, name, src_dir_fd=directory, dst_dir_fd=directory)
    finally:
        try:
            os.unlink(temporary, dir_fd=directory)
        except FileNotFoundError:
            pass


def owned_storage(root, root_descriptor, storage_descriptor):
    """Refuse a renamed/replaced registration; never follow it for mutations."""
    try:
        current_root = os.stat(root, follow_symlinks=False)
        opened_root = os.fstat(root_descriptor)
        current_storage = os.stat(".compass", dir_fd=root_descriptor, follow_symlinks=False)
        opened_storage = os.fstat(storage_descriptor)
        if (
            not stat.S_ISDIR(current_root.st_mode)
            or not stat.S_ISDIR(current_storage.st_mode)
            or (current_root.st_dev, current_root.st_ino)
            != (opened_root.st_dev, opened_root.st_ino)
            or (current_storage.st_dev, current_storage.st_ino)
            != (opened_storage.st_dev, opened_storage.st_ino)
        ):
            raise OSError("Changed directory identity")
    except OSError:
        raise PurgeError(
            "identity", "Workspace storage changed during deletion. Reopen its original folder before resuming."
        ) from None


def exists_at(directory, name):
    try:
        os.stat(name, dir_fd=directory, follow_symlinks=False)
        return True
    except FileNotFoundError:
        return False


def read_marker(directory):
    descriptor = os.open(MARKER, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory)
    with os.fdopen(descriptor, "rb") as handle:
        before = os.fstat(handle.fileno())
        if not stat.S_ISREG(before.st_mode) or before.st_size > 1_000_000:
            raise PurgeError("invalid_marker", "The deletion record is invalid. Its files were kept for recovery.")
        raw = handle.read(1_000_001)
        after = os.fstat(handle.fileno())
        if len(raw) > 1_000_000 or (before.st_size, before.st_mtime_ns) != (after.st_size, after.st_mtime_ns):
            raise PurgeError("invalid_marker", "The deletion record changed. Its files were kept for recovery.")
    return json.loads(raw)


def clean_config(raw):
    if (
        not isinstance(raw, dict)
        or set(raw) != {"name", "description", "model", "sources"}
        or raw["sources"] != []
    ):
        raise PurgeError("invalid_request", "Invalid deletion request. Existing files were kept.")
    for key, limit in (("name", 200), ("description", 4000), ("model", 256)):
        if not isinstance(raw[key], str) or len(raw[key]) > limit:
            raise PurgeError(
                "invalid_request", "Invalid product details. Existing files were kept."
            )
    return raw


def inventory(storage, protected, device, directory):
    entries, size = 0, 0
    temporary = []
    with os.scandir(directory) as names:
        for scanned, entry in enumerate(names, 1):
            if scanned > MAX_ENTRIES:
                raise PurgeError("cache_limit", "Workspace storage has too many entries. Existing files were kept.")
            if entry.name.startswith(".deletion-") and entry.name.endswith(".tmp"):
                temporary.append(entry.name)
    targets = (*TARGETS, *temporary)

    def visit(parent, name, logical_path):
        nonlocal entries, size
        try:
            info = os.stat(name, dir_fd=parent, follow_symlinks=False)
        except FileNotFoundError:
            return
        if stat.S_ISLNK(info.st_mode) or info.st_dev != device or os.path.ismount(logical_path):
            raise PurgeError(
                "unsafe_storage", "Managed storage contains a link or mounted folder. Restore its original layout before deleting Compass data."
            )
        if not stat.S_ISREG(info.st_mode) and not stat.S_ISDIR(info.st_mode):
            raise PurgeError("unsafe_storage", "Managed storage contains a special file. Existing files were kept.")
        entries += 1
        if entries > MAX_ENTRIES:
            raise PurgeError("cache_limit", "Managed storage exceeds the 100,000-entry deletion limit. Existing files were kept.")
        if stat.S_ISDIR(info.st_mode):
            child = os.open(name, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=parent)
            try:
                opened = os.fstat(child)
                if (opened.st_dev, opened.st_ino) != (info.st_dev, info.st_ino):
                    raise PurgeError("identity", "Managed storage changed during inventory. Existing files were kept.")
                with os.scandir(child) as children:
                    for entry in children:
                        visit(child, entry.name, logical_path / entry.name)
            finally:
                os.close(child)
        else:
            size += info.st_size

    for name in targets:
        target = storage / name
        for source in protected:
            original = Path(source)
            if (
                original.is_relative_to(target)
                or target.is_relative_to(original)
                and original.is_relative_to(storage)
            ):
                raise PurgeError(
                    "source_overlap",
                    "An original source is inside managed Compass storage. Move it outside and reconnect it before deleting Compass data.",
                )
        visit(directory, name, target)
    return entries, size, targets


def purge(request):
    if not isinstance(request, dict) or set(request) != {
        "workspace_path", "device", "inode", "config", "protected_paths",
    }:
        raise PurgeError("invalid_request", "Invalid workspace deletion request.")
    if os.name != "posix" or not shutil.rmtree.avoids_symlink_attacks:
        raise PurgeError("unsupported", "This deletion workflow requires macOS or Linux.")
    root = Path(request["workspace_path"])
    if not root.is_absolute() or root.resolve() != root:
        raise PurgeError("identity", "The selected workspace moved. Open its original folder before deleting data.")
    config = clean_config(request["config"])
    protected = request["protected_paths"]
    if (
        not isinstance(protected, list) or len(protected) > 200
        or any(not isinstance(item, str) or not Path(item).is_absolute() or len(item) > 4096 for item in protected)
    ):
        raise PurgeError("invalid_request", "Invalid source protection details.")
    root_descriptor = storage_descriptor = descriptor = None
    try:
        root_descriptor = os.open(root, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        info = os.fstat(root_descriptor)
        if (info.st_dev, info.st_ino) != (request["device"], request["inode"]):
            raise PurgeError("identity", "The selected workspace changed identity. No data was removed.")
        storage = root / ".compass"
        storage_descriptor = os.open(".compass", os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW, dir_fd=root_descriptor)
        if os.fstat(storage_descriptor).st_dev != info.st_dev or os.path.ismount(storage):
            raise PurgeError("unsafe_storage", "Workspace storage contains a mounted folder.")
        def check():
            owned_storage(root, root_descriptor, storage_descriptor)
        check()
        for name in ("compass.yaml", MARKER):
            try:
                metadata = os.stat(name, dir_fd=storage_descriptor, follow_symlinks=False)
            except FileNotFoundError:
                continue
            if not stat.S_ISREG(metadata.st_mode):
                raise PurgeError("unsafe_storage", "Workspace metadata cannot be a link or special file.")
        if exists_at(storage_descriptor, MARKER):
            intent = read_marker(storage_descriptor)
            if not isinstance(intent, dict) or set(intent) != {"version", "config", "protected_paths"} or intent["version"] != 1:
                raise PurgeError("invalid_marker", "The deletion record is invalid. Its files were kept for recovery.")
            config = clean_config(intent["config"])
            prior = intent["protected_paths"]
            if (
                not isinstance(prior, list) or len(prior) > 200
                or any(not isinstance(item, str) or not Path(item).is_absolute() or len(item) > 4096 for item in prior)
            ):
                raise PurgeError("invalid_marker", "The deletion source protection record is invalid.")
            protected = list({*protected, *prior})
        # Resolve approved aliases while the registered storage still has its identity.
        protected = [str(Path(item).resolve()) for item in protected]
        check()
        import fcntl

        descriptor = os.open("jobs.lock", os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600, dir_fd=storage_descriptor)
        if not stat.S_ISREG(os.fstat(descriptor).st_mode):
            raise PurgeError("unsafe_storage", "Workspace lock cannot be a special file.")
        try:
            fcntl.flock(descriptor, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError as cause:
            raise PurgeError("busy", "Another engine is using this workspace. Close it before deleting Compass data.") from cause
        entries, size, targets = inventory(storage, protected, info.st_dev, storage_descriptor)
        check()
        intent = {"version": 1, "config": config, "protected_paths": protected}
        if len(json.dumps(intent, ensure_ascii=False).encode()) > 1_000_000:
            raise PurgeError("invalid_request", "Deletion metadata exceeds its size limit. Existing files were kept.")
        write_private(storage_descriptor, MARKER, intent, check)
        for name in targets:
            check()
            try:
                metadata = os.stat(name, dir_fd=storage_descriptor, follow_symlinks=False)
            except FileNotFoundError:
                continue
            if stat.S_ISDIR(metadata.st_mode) and metadata.st_dev == info.st_dev:
                shutil.rmtree(name, dir_fd=storage_descriptor)
            elif stat.S_ISREG(metadata.st_mode) and metadata.st_dev == info.st_dev:
                os.unlink(name, dir_fd=storage_descriptor)
            else:
                raise PurgeError("unsafe_storage", "Managed storage changed to a link or special file. Resume after restoring its layout.")
        # Every mutation stays relative to the original verified directory descriptor.
        write_private(storage_descriptor, "compass.yaml", config, check)
        check()
        if any(exists_at(storage_descriptor, name) for name in targets):
            raise PurgeError("incomplete", "Some managed files remain. Resume deletion to finish.")
        os.unlink(MARKER, dir_fd=storage_descriptor)
        return {"status": "deleted", "entries": entries, "bytes": size}
    finally:
        for opened in (descriptor, storage_descriptor, root_descriptor):
            if opened is not None:
                os.close(opened)


def main():
    try:
        raw = sys.stdin.read(1_000_001)
        if len(raw) > 1_000_000:
            raise PurgeError("invalid_request", "Deletion request exceeded its size limit.")
        result = purge(json.loads(raw))
    except PurgeError as cause:
        result = {"status": "error", "code": cause.code, "message": str(cause)}
    except (OSError, ValueError, TypeError, KeyError):
        result = {
            "status": "error",
            "code": "incomplete",
            "message": "Deletion did not finish. Check the selected drive and resume deletion; existing source files and separate copies are retained.",
        }
    print(json.dumps(result), flush=True)
    return 0 if result["status"] == "deleted" else 1


if __name__ == "__main__":
    raise SystemExit(main())
