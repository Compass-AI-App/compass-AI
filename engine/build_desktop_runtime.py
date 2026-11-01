"""Assemble a relocatable, hash-locked desktop Python runtime at build time."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import tarfile
import tempfile
import urllib.request
from pathlib import Path

ENGINE = Path(__file__).resolve().parent
ROOT = ENGINE.parent


def digest(file: Path) -> str:
    with file.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def environment() -> dict[str, str]:
    # Build machines can have private registries or unrelated credentials configured.
    result = {
        key: value for key, value in os.environ.items()
        if not key.startswith(("PIP_", "UV_", "PYTHON", "CONDA", "VIRTUAL_ENV"))
        and not any(word in key.upper() for word in ("API_KEY", "TOKEN", "SECRET", "PASSWORD", "CREDENTIAL"))
    }
    result.update(PIP_CONFIG_FILE=os.devnull, PIP_DISABLE_PIP_VERSION_CHECK="1", PYTHONDONTWRITEBYTECODE="1")
    return result


def command(python: Path, *args: str, cwd: Path | None = None) -> str:
    result = subprocess.run(
        [str(python), "-I", "-B", *args], cwd=cwd or python.parent,
        env=environment(), check=True, capture_output=True, text=True, timeout=300,
    )
    return result.stdout.strip()


def assemble(target: str, destination: Path, archive: Path | None = None, wheelhouse: Path | None = None) -> dict:
    manifest = json.loads((ROOT / "app" / "electron" / "engine-runtime.json").read_text())
    actual = {"arm64": "mac-arm64", "x86_64": "mac-x64"}.get(platform.machine())
    if sys.platform != "darwin" or target != actual:
        raise ValueError("Build each macOS runtime on a matching native architecture.")
    specification = manifest["targets"][target]
    if destination.is_symlink():
        raise ValueError("Runtime output cannot be a symlink.")
    destination = destination.absolute()
    runtime_root = ROOT / ".runtime"
    if not destination.is_relative_to(runtime_root) or destination == runtime_root:
        raise ValueError("Runtime output must be a child of this checkout's .runtime folder.")
    for parent in [destination, *destination.parents]:
        if parent == ROOT:
            break
        if parent.is_symlink():
            raise ValueError("Runtime output parents cannot be symlinks.")
    destination = destination.resolve()
    if not destination.is_relative_to(runtime_root) or destination == runtime_root:
        raise ValueError("Runtime output must remain inside this checkout's .runtime folder.")
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix=".compass-runtime-", dir=destination.parent) as scratch:
        scratch = Path(scratch)
        if archive is None:
            archive = scratch / "cpython.tar.gz"
            request = urllib.request.Request(specification["url"], headers={"User-Agent": "Compass-runtime-builder"})
            with urllib.request.urlopen(request, timeout=120) as response, archive.open("wb") as output:
                shutil.copyfileobj(response, output)
        if digest(archive) != specification["sha256"]:
            raise ValueError("CPython archive checksum mismatch; no runtime was published.")
        with tarfile.open(archive) as compressed:
            if any(not item.name.startswith("python/") or ".." in Path(item.name).parts for item in compressed.getmembers()):
                raise ValueError("Unexpected CPython archive paths.")
            compressed.extractall(scratch, filter="data")
        staged = scratch / "python"
        python = staged / "bin" / "python3"
        version = command(python, "-c", "import platform;print(platform.python_version())")
        if version != manifest["python"]:
            raise ValueError("Unexpected bundled Python version.")
        try:
            command(python, "-m", "pip", "--version")
        except subprocess.CalledProcessError:
            command(python, "-m", "ensurepip", "--default-pip")
        index = ["--no-index", "--find-links", str(wheelhouse.resolve())] if wheelhouse else ["--index-url", "https://pypi.org/simple"]
        command(python, "-m", "pip", "--isolated", "install", "--no-compile", "--require-hashes", "--only-binary=:all:", *index, "-r", str(ENGINE / "requirements-desktop.lock"))
        purelib = Path(command(python, "-c", "import sysconfig;print(sysconfig.get_path('purelib'))"))
        if not purelib.is_relative_to(staged):
            raise ValueError("Bundled Python resolved site-packages outside its runtime.")
        package = purelib / "compass"
        for source in (ENGINE / "compass").rglob("*.py"):
            if source.is_symlink():
                raise ValueError("Engine source symlinks are not supported.")
            output = package / source.relative_to(ENGINE / "compass")
            output.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, output)
        command(python, "-m", "pip", "check")
        # Smoke imports execute offline. No provider, vector model or account is configured.
        command(python, "-c", "import sys,sqlite3; from compass.server import app; import compass.workspace_purge; assert 'chromadb' not in sys.modules; assert sqlite3.connect(':memory:').execute(\"CREATE VIRTUAL TABLE probe USING fts5(text)\") is not None")
        packages = json.loads(command(python, "-c", "import importlib.metadata,json;print(json.dumps(sorted((d.metadata['Name'],d.version) for d in importlib.metadata.distributions())))"))
        receipt = {
            "format": "compass-desktop-runtime-v1", "target": target, "python": version,
            "distribution_sha256": specification["sha256"],
            "requirements_sha256": digest(ENGINE / "requirements-desktop.lock"),
            "packages": packages,
            "engine_sha256": hashlib.sha256(b"".join(
                str(file.relative_to(package)).encode() + b"\0" + file.read_bytes()
                for file in sorted(package.rglob("*.py"))
            )).hexdigest(),
        }
        (staged / "compass-runtime.json").write_text(json.dumps(receipt, indent=2) + "\n")
        # Publish only a completely assembled tree; failed assembly keeps an older build.
        previous = destination.with_name(destination.name + ".previous")
        if previous.exists():
            raise ValueError("A previous publication is pending. Resolve the .previous folder before rebuilding.")
        if destination.exists():
            destination.rename(previous)
        try:
            staged.rename(destination)
        except BaseException:
            if previous.exists():
                previous.rename(destination)
            raise
        if previous.exists():
            shutil.rmtree(previous)
        return receipt


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True, choices=["mac-arm64", "mac-x64"])
    parser.add_argument("--destination", type=Path)
    parser.add_argument("--archive", type=Path, help="Previously downloaded CPython archive, verified against the pinned digest")
    parser.add_argument("--wheelhouse", type=Path, help="Use only this offline directory of hashed wheels")
    args = parser.parse_args()
    receipt = assemble(args.target, args.destination or ROOT / ".runtime" / args.target, args.archive, args.wheelhouse)
    print(json.dumps(receipt, indent=2))


if __name__ == "__main__":
    main()
