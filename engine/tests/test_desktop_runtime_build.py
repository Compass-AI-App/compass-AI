"""Build-time runtime publication refuses unsafe outputs and untrusted archives."""
import hashlib
import importlib.util
import io
import json
import tarfile
from pathlib import Path
from types import SimpleNamespace

import pytest


@pytest.fixture
def builder(tmp_path):
    file = Path(__file__).parents[1] / "build_desktop_runtime.py"
    spec = importlib.util.spec_from_file_location("desktop_runtime_builder", file)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.ROOT = tmp_path
    module.ENGINE = tmp_path / "engine"
    module.sys = SimpleNamespace(platform="darwin")
    module.platform = SimpleNamespace(machine=lambda: "arm64")
    manifest = tmp_path / "app" / "electron" / "engine-runtime.json"
    manifest.parent.mkdir(parents=True)
    archive = tmp_path / "archive.tar.gz"
    archive.write_bytes(b"fixture archive")
    manifest.write_text(json.dumps({"python": "3.11.18", "targets": {"mac-arm64": {"sha256": "0" * 64}}}))
    output = tmp_path / ".runtime" / "mac-arm64"
    output.mkdir(parents=True)
    (output / "existing-build").write_text("Retain the previous runtime")
    return module, archive, output, manifest


def test_checksum_failure_preserves_previous_build(builder):
    module, archive, output, _ = builder
    with pytest.raises(ValueError, match="checksum"):
        module.assemble("mac-arm64", output, archive)
    assert (output / "existing-build").read_text() == "Retain the previous runtime"
    assert list(output.parent.iterdir()) == [output]


def test_build_cannot_replace_checkout_or_follow_output_symlink(builder, tmp_path):
    module, archive, output, _ = builder
    with pytest.raises(ValueError, match=".runtime"):
        module.assemble("mac-arm64", tmp_path / "engine", archive)
    with pytest.raises(ValueError, match=".runtime"):
        module.assemble("mac-arm64", output.parent / ".." / "engine", archive)
    alias = output.parent / "alias"
    alias.symlink_to(output, target_is_directory=True)
    with pytest.raises(ValueError, match="symlink"):
        module.assemble("mac-arm64", alias, archive)
    assert (output / "existing-build").exists()


def test_archive_traversal_is_rejected_before_extract_or_publication(builder, tmp_path):
    module, archive, output, manifest = builder
    with tarfile.open(archive, "w:gz") as compressed:
        entry = tarfile.TarInfo("python/../../escape")
        entry.size = 1
        compressed.addfile(entry, io.BytesIO(b"x"))
    data = json.loads(manifest.read_text())
    data["targets"]["mac-arm64"]["sha256"] = hashlib.sha256(archive.read_bytes()).hexdigest()
    manifest.write_text(json.dumps(data))
    with pytest.raises(ValueError, match="archive paths"):
        module.assemble("mac-arm64", output, archive)
    assert not (tmp_path / "escape").exists()
    assert (output / "existing-build").exists()
