#!/usr/bin/env python3
import json
import os
from pathlib import Path, PurePosixPath
import stat
import sys
import zipfile


def safe_name(value):
    name = str(value).replace('\\', '/')
    parsed = PurePosixPath(name)
    if parsed.is_absolute() or '..' in parsed.parts or name.startswith('/') or '\x00' in name:
        raise ValueError(f'unsafe archive path: {name}')
    return name


def create(manifest_path, archive_path):
    manifest = json.loads(Path(manifest_path).read_text(encoding='utf-8'))
    entries = manifest.get('entries', [])
    seen = set()
    archive = Path(archive_path)
    archive.parent.mkdir(parents=True, exist_ok=True)
    archive.unlink(missing_ok=True)
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9, allowZip64=True) as output:
        for entry in sorted(entries, key=lambda item: item['archivePath']):
            source = Path(entry['source'])
            name = safe_name(entry['archivePath'])
            if name in seen:
                raise ValueError(f'duplicate archive path: {name}')
            seen.add(name)
            info = source.lstat()
            if stat.S_ISLNK(info.st_mode) or not stat.S_ISREG(info.st_mode):
                raise ValueError(f'unsupported source entry: {source}')
            zip_info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            zip_info.create_system = 3
            zip_info.compress_type = zipfile.ZIP_DEFLATED
            zip_info.external_attr = (stat.S_IMODE(info.st_mode) & 0xFFFF) << 16
            with source.open('rb') as handle:
                output.writestr(zip_info, handle.read(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    print(json.dumps({'archive': str(archive), 'entries': len(seen), 'bytes': archive.stat().st_size}))


def verify(spec_path, archive_path):
    spec = json.loads(Path(spec_path).read_text(encoding='utf-8'))
    archive = Path(archive_path)
    if not archive.is_file():
        raise ValueError(f'archive is missing: {archive}')
    with zipfile.ZipFile(archive, 'r') as source:
        bad = source.testzip()
        if bad:
            raise ValueError(f'archive CRC failed: {bad}')
        names = source.namelist()
        if len(names) != len(set(names)):
            raise ValueError('archive contains duplicate names')
        for info in source.infolist():
            name = safe_name(info.filename)
            mode = (info.external_attr >> 16) & 0o170000
            if mode == stat.S_IFLNK:
                raise ValueError(f'archive contains symlink: {name}')
        required = [safe_name(item) for item in spec.get('required', [])]
        missing = [item for item in required if item not in names]
        if missing:
            raise ValueError(f'archive missing required entries: {missing}')
        forbidden_exact = {safe_name(item) for item in spec.get('forbiddenExact', [])}
        forbidden = [str(item).replace('\\', '/') for item in spec.get('forbiddenPrefixes', [])]
        violations = [name for name in names if name in forbidden_exact or any(name.startswith(prefix) for prefix in forbidden)]
        if violations:
            raise ValueError(f'archive contains forbidden entries: {violations[:10]}')
    print(json.dumps({'archive': str(archive), 'entries': len(names), 'bytes': archive.stat().st_size, 'status': 'pass'}))


def main():
    if len(sys.argv) != 4 or sys.argv[1] not in {'create', 'verify'}:
        raise SystemExit('usage: zip-artifacts.py create|verify SPEC.json ARCHIVE.zip')
    if sys.argv[1] == 'create':
        create(sys.argv[2], sys.argv[3])
    else:
        verify(sys.argv[2], sys.argv[3])


if __name__ == '__main__':
    main()
