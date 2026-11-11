import hashlib
import json
import shutil
import urllib.request
import zipfile

from . import config


def fetch_all() -> None:
    config.DOWNLOADS.mkdir(exist_ok=True)
    for name, source in config.load()["sources"].items():
        path = config.source_path(name)
        if path.exists():
            print(f"{name}: already fetched")
            continue
        print(f"{name}: downloading")
        digest = fetch_gtfs(source["url"], path) if source["kind"] == "gtfs" else \
            fetch_file(source["url"], path)
        check(name, source, digest, path)


def fetch_file(url: str, path) -> str:
    partial = path.with_suffix(path.suffix + ".part")
    # Some servers refuse Python's default user agent.
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(request) as response, open(partial, "wb") as f:
        shutil.copyfileobj(response, f)
    partial.rename(path)
    return sha256(path.read_bytes())


def fetch_gtfs(url: str, path) -> str:
    """The mirror serves each GTFS table as <table>.csv; they are zipped back into a feed.
    The digest covers the tables' contents, so it does not depend on zip metadata."""
    with urllib.request.urlopen(url + "datapackage.json") as response:
        resources = json.load(response)["resources"]
    tables = sorted(r["path"] for r in resources if r["path"].endswith(".csv"))
    digest = hashlib.sha256()
    partial = path.with_suffix(".part")
    with zipfile.ZipFile(partial, "w", zipfile.ZIP_DEFLATED) as feed:
        for table in tables:
            with urllib.request.urlopen(url + table) as response:
                content = response.read()
            digest.update(table.encode() + content)
            feed.writestr(table.replace(".csv", ".txt"), content)
    partial.rename(path)
    return digest.hexdigest()


def sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def check(name: str, source: dict, digest: str, path) -> None:
    if "sha256" not in source:
        return
    if source["sha256"] is None:
        print(f"  sha256 {digest} (not pinned yet)")
    elif source["sha256"] != digest:
        path.unlink()
        raise RuntimeError(f"{name}: checksum mismatch, got {digest}")
