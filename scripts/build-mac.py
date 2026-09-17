#!/usr/bin/env python3
"""Build the complete Intel + Apple Silicon ZIP; no third-party Python packages."""
import hashlib, json, os, shutil, tarfile, urllib.request, zipfile
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
VERSION = json.loads((ROOT / 'package.json').read_text())['version']
NODE = '22.23.2'
SUMS = {'arm64': '61130f394c1630d211dd50aecc4353d379480f36d3ac913cd85dbba1aed585c6',
        'x64': '58e99022c2ff89395576cc7fd4d98cea24bb68081475d5f88b801ee8729fb026'}
CACHE = Path(os.environ.get('ANP_DOWNLOAD_CACHE', ROOT / '.cache'))
CACHE.mkdir(parents=True, exist_ok=True)
DIST = ROOT / 'dist'
DIST.mkdir(exist_ok=True)
STAGE = DIST / 'Ableton-Now-Playing'
if STAGE.exists(): shutil.rmtree(STAGE)
CONTENTS = STAGE / 'Ableton Now Playing.app/Contents'
RES = CONTENTS / 'Resources'
(CONTENTS / 'MacOS').mkdir(parents=True)
RES.mkdir()
shutil.copy(ROOT / 'macos/launcher', CONTENTS / 'MacOS/AbletonNowPlaying')
(CONTENTS / 'MacOS/AbletonNowPlaying').chmod(0o755)
shutil.copy(ROOT / 'macos/Info.plist', CONTENTS / 'Info.plist')
for folder in ['app', 'vendor']:
    shutil.copytree(ROOT / folder, RES / folder, ignore=shutil.ignore_patterns('__pycache__', '*.pyc', 'Now-Playing.txt'))
for name in ['LICENSE', 'THIRD-PARTY-NOTICES.txt']:
    shutil.copy(ROOT / name, RES / name)
for arch, expected in SUMS.items():
    archive_name = f'node-v{NODE}-darwin-{arch}.tar.gz'
    archive = CACHE / archive_name
    if not archive.exists():
        print(f'Downloading official Node.js runtime: {arch}', flush=True)
        urllib.request.urlretrieve(f'https://nodejs.org/dist/v{NODE}/{archive_name}', archive)
    if hashlib.sha256(archive.read_bytes()).hexdigest() != expected:
        raise SystemExit(f'Checksum mismatch: {archive}; remove the archive and retry.')
    target = RES / 'runtime' / arch
    target.mkdir(parents=True)
    with tarfile.open(archive, 'r:gz') as tar:
        prefix = archive_name.removesuffix('.tar.gz')
        for member, filename in [('bin/node', 'node'), ('LICENSE', 'LICENSE')]:
            with tar.extractfile(prefix + '/' + member) as stream:
                (target / filename).write_bytes(stream.read())
    (target / 'node').chmod(0o755)
shutil.copy(ROOT / 'INSTALL.md', STAGE / 'START-HERE.txt')
shutil.copy(ROOT / 'README.md', STAGE / 'README.md')
shutil.copy(ROOT / 'LICENSE', STAGE / 'LICENSE')
archive = DIST / f'Ableton-Now-Playing-Mac-v{VERSION}.zip'
with zipfile.ZipFile(archive, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as z:
    for p in sorted(STAGE.rglob('*')):
        if p.is_file(): z.write(p, p.relative_to(DIST))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for entry in z.infolist():
        if entry.filename.endswith(('/node', '/AbletonNowPlaying')):
            assert (entry.external_attr >> 16) & 0o111
checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
(DIST / 'SHA256SUMS.txt').write_text(f'{checksum}  {archive.name}\n')
print(f'Built {archive} ({archive.stat().st_size / 1048576:.1f} MiB)')
