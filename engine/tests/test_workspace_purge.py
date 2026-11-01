"""Only confirmed managed copies are removed; partial deletion stays fenced."""

import json
from pathlib import Path
from unittest.mock import patch

import pytest

from compass.config import ProductConfig, load_config, save_config
from compass.engine.evidence_repository import EvidenceRepository
from compass.engine.task_repository import TaskRepository
from compass.workspace_purge import MARKER, TARGETS, PurgeError, purge


@pytest.fixture
def saved(tmp_path):
    root = tmp_path / "workspace"
    root.mkdir()
    save_config(ProductConfig(name="Fictional product", description="Product details"), root)
    storage = root / ".compass"
    for name in TARGETS:
        target = storage / name
        if name in ("knowledge", "documents", "task-backups"):
            target.mkdir()
            (target / "source-copy.txt").write_text("Retained private source quote")
        else:
            target.write_text("Retained private source quote")
    source = tmp_path / "original-source.md"
    source.write_text("Original user source")
    output = storage / "output"
    output.mkdir(exist_ok=True)
    (output / "retained-export.md").write_text("Separate output quote")
    (storage / "unrelated-user-file.txt").write_text("Unrelated user file")
    (root / "separate-backup.compass-backup.json").write_text("Separate user backup")
    info = root.stat()
    request = {
        "workspace_path": str(root),
        "device": info.st_dev,
        "inode": info.st_ino,
        "config": {
            "name": "Fictional product",
            "description": "Product details",
            "model": "fixture-model",
            "sources": [],
        },
        "protected_paths": [str(source)],
    }
    return root, request, source


def test_managed_quotes_and_migration_backups_are_removed_but_originals_and_copies_remain(saved):
    root, request, source = saved
    (root / ".compass" / ".deletion-stale.tmp").write_text("Stale interrupted deletion details")
    result = purge(request)
    assert result["status"] == "deleted" and result["entries"] >= len(TARGETS)
    assert all(not (root / ".compass" / name).exists() for name in TARGETS)
    assert not (root / ".compass" / MARKER).exists()
    assert not list((root / ".compass").glob(".deletion-*.tmp"))
    assert source.read_text() == "Original user source"
    assert (
        root / ".compass" / "output" / "retained-export.md"
    ).read_text() == "Separate output quote"
    assert (root / ".compass" / "unrelated-user-file.txt").read_text() == "Unrelated user file"
    assert (root / "separate-backup.compass-backup.json").read_text() == "Separate user backup"
    config = load_config(root)
    assert config.name == "Fictional product" and config.sources == []
    assert TaskRepository(root).list() == []
    evidence = EvidenceRepository(root / ".compass" / "knowledge")
    assert evidence.read()[1] == []
    evidence._db.close()


def test_overlap_with_original_source_fails_before_any_managed_file_is_removed(saved):
    root, request, _ = saved
    protected = root / ".compass" / "documents" / "original.md"
    protected.write_text("Original user text")
    with pytest.raises(PurgeError) as caught:
        purge({**request, "protected_paths": [str(protected)]})
    assert caught.value.code == "source_overlap"
    assert protected.read_text() == "Original user text"
    assert all((root / ".compass" / name).exists() for name in TARGETS)
    assert not (root / ".compass" / MARKER).exists()


def test_symlinks_identity_change_and_other_engine_lock_fail_without_deletion(saved, tmp_path):
    root, request, _ = saved
    with pytest.raises(PurgeError, match="identity"):
        purge({**request, "inode": request["inode"] + 1})
    link = root / ".compass" / "knowledge" / "outside"
    outside = tmp_path / "outside"
    outside.mkdir()
    (outside / "keep").write_text("Outside")
    link.symlink_to(outside)
    with pytest.raises(PurgeError, match="link"):
        purge(request)
    assert (outside / "keep").read_text() == "Outside"
    link.unlink()
    import fcntl

    with (root / ".compass" / "jobs.lock").open("w") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        with pytest.raises(PurgeError, match="Another engine"):
            purge(request)
    assert not (root / ".compass" / MARKER).exists()


def test_partial_failure_keeps_marker_blocks_reads_and_resumes_forward(saved):
    import compass.workspace_purge as deletion

    root, request, _ = saved
    original = deletion.os.unlink

    def fail(file, *args, **kwargs):
        if str(file) == "tasks.sqlite3":
            raise PermissionError("Fictional deletion failure")
        return original(file, *args, **kwargs)

    with patch.object(deletion.os, "unlink", fail), pytest.raises(PermissionError):
        purge(request)
    assert (root / ".compass" / MARKER).exists()
    with pytest.raises(PurgeError, match="incomplete"):
        load_config(root)
    with pytest.raises(PurgeError, match="incomplete"):
        TaskRepository(root)
    with pytest.raises(PurgeError, match="incomplete"):
        EvidenceRepository(root / ".compass" / "knowledge")
    assert purge(request)["status"] == "deleted"
    assert not (root / ".compass" / MARKER).exists()
    assert TaskRepository(root).list() == []


def test_tampered_marker_cannot_expand_deletion_targets(saved, tmp_path):
    root, request, _ = saved
    marker = root / ".compass" / MARKER
    marker.write_text(
        json.dumps(
            {
                "version": 1,
                "config": request["config"],
                "protected_paths": [],
                "targets": [str(tmp_path)],
            }
        )
    )
    with pytest.raises(PurgeError, match="invalid"):
        purge(request)
    assert all((root / ".compass" / name).exists() for name in TARGETS)


@pytest.mark.parametrize("replacement", ["symlink", "directory"])
def test_replaced_storage_after_inventory_cannot_redirect_deletion(saved, tmp_path, monkeypatch, replacement):
    import compass.workspace_purge as deletion

    root, request, _ = saved
    storage = root / ".compass"
    original_storage = root / "original-storage"
    outside = tmp_path / "outside-storage"
    original_inventory = deletion.inventory

    def replace_storage(*args):
        result = original_inventory(*args)
        storage.rename(original_storage)
        if replacement == "symlink":
            outside.mkdir()
            storage.symlink_to(outside, target_is_directory=True)
            substitute = outside
        else:
            storage.mkdir()
            substitute = storage
        (substitute / "knowledge").mkdir()
        (substitute / "knowledge" / "keep.txt").write_text("Unapproved replacement data")
        (substitute / "compass.yaml").write_text("Unapproved config")
        return result

    monkeypatch.setattr(deletion, "inventory", replace_storage)
    with pytest.raises(PurgeError, match="changed"):
        purge(request)
    substitute = outside if replacement == "symlink" else storage
    assert (substitute / "knowledge" / "keep.txt").read_text() == "Unapproved replacement data"
    assert (substitute / "compass.yaml").read_text() == "Unapproved config"
    assert not (substitute / MARKER).exists()
    assert all((original_storage / name).exists() for name in TARGETS)
    assert not (original_storage / MARKER).exists()


def test_storage_swap_during_removal_stays_anchored_and_can_resume(saved, tmp_path, monkeypatch):
    import compass.workspace_purge as deletion

    root, request, source = saved
    storage = root / ".compass"
    original_storage = root / "original-storage"
    outside = tmp_path / "outside-storage"
    outside.mkdir()
    (outside / "knowledge").mkdir()
    sentinel = outside / "knowledge" / "keep.txt"
    sentinel.write_text("Unapproved replacement data")
    (outside / "compass.yaml").write_text("Unapproved config")
    original_remove = deletion.shutil.rmtree
    swapped = False

    def replace_storage(target, *args, **kwargs):
        nonlocal swapped
        if not swapped:
            swapped = True
            storage.rename(original_storage)
            storage.symlink_to(outside, target_is_directory=True)
        return original_remove(target, *args, **kwargs)

    replace_storage.avoids_symlink_attacks = original_remove.avoids_symlink_attacks
    monkeypatch.setattr(deletion.shutil, "rmtree", replace_storage)
    with pytest.raises(PurgeError, match="changed"):
        purge(request)
    assert sentinel.read_text() == "Unapproved replacement data"
    assert (outside / "compass.yaml").read_text() == "Unapproved config"
    assert (original_storage / MARKER).exists()
    assert source.read_text() == "Original user source"
    storage.unlink()
    original_storage.rename(storage)
    monkeypatch.setattr(deletion.shutil, "rmtree", original_remove)
    assert purge(request)["status"] == "deleted"
    assert sentinel.read_text() == "Unapproved replacement data"
    assert not (storage / MARKER).exists()


def test_replaced_workspace_after_inventory_cannot_redirect_mutations(saved, tmp_path, monkeypatch):
    import compass.workspace_purge as deletion

    root, request, _ = saved
    original_root = tmp_path / "original-workspace"
    outside = tmp_path / "outside-workspace"
    storage = outside / ".compass"
    storage.mkdir(parents=True)
    (storage / "knowledge").mkdir()
    (storage / "knowledge" / "keep.txt").write_text("Unapproved replacement data")
    (storage / "compass.yaml").write_text("Unapproved config")
    original_inventory = deletion.inventory

    def replace_workspace(*args):
        result = original_inventory(*args)
        root.rename(original_root)
        root.symlink_to(outside, target_is_directory=True)
        return result

    monkeypatch.setattr(deletion, "inventory", replace_workspace)
    with pytest.raises(PurgeError, match="changed"):
        purge(request)
    assert (storage / "knowledge" / "keep.txt").read_text() == "Unapproved replacement data"
    assert (storage / "compass.yaml").read_text() == "Unapproved config"
    assert not (storage / MARKER).exists()
    assert all((original_root / ".compass" / name).exists() for name in TARGETS)


def test_process_stop_after_removing_first_cache_keeps_reads_blocked_until_resume(saved, tmp_path):
    import os
    import subprocess
    import sys
    import time

    root, request, source = saved
    marker = tmp_path / "deletion-stopped"
    script = """
import json,sys
from pathlib import Path
from threading import Event
import compass.workspace_purge as deletion
original=deletion.shutil.rmtree
def stop(target,*args,**kwargs):
    original(target,*args,**kwargs)
    Path(sys.argv[1]).write_text('ready')
    Event().wait(30)
stop.avoids_symlink_attacks=original.avoids_symlink_attacks
deletion.shutil.rmtree=stop
deletion.purge(json.loads(sys.stdin.read()))
"""
    process = subprocess.Popen(
        [sys.executable, "-c", script, str(marker)],
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.PIPE,
        env={**os.environ, "PYTHONPATH": str(Path(__file__).parents[1])},
    )
    try:
        process.stdin.write(json.dumps(request).encode())
        process.stdin.close()
        deadline = time.monotonic() + 10
        while not marker.exists() and process.poll() is None and time.monotonic() < deadline:
            time.sleep(0.02)
        assert marker.exists(), (
            process.stderr.read().decode()
            if process.poll() is not None
            else "Deletion did not reach checkpoint"
        )
        process.kill()
        process.wait(timeout=5)
        assert (root / ".compass" / MARKER).exists()
        assert not (root / ".compass" / "knowledge").exists()
        with pytest.raises(PurgeError, match="incomplete"):
            TaskRepository(root)
        assert source.read_text() == "Original user source"
        assert purge(request)["status"] == "deleted"
        assert TaskRepository(root).list() == []
    finally:
        if process.poll() is None:
            process.kill()
            process.wait(timeout=5)
        process.stderr.close()
