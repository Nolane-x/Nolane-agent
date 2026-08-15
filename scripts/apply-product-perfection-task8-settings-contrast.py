from pathlib import Path
import subprocess

PATH='ui-v3/styles/pages/settings.css'
EXPECTED='e49a7a2a409abe0d42d670315e033220da3d5d7f'
actual=subprocess.check_output(['git','hash-object',PATH],text=True).strip()
print(f'guard {PATH}: {actual}')
if actual!=EXPECTED: raise SystemExit(f'{PATH}: unexpected blob {actual}; expected {EXPECTED}')
p=Path(PATH); s=p.read_text()
old='.settings-empty{padding:20px;color:var(--text-muted)}'
new='.settings-empty{padding:20px;color:var(--text-primary)}'
if s.count(old)!=1: raise SystemExit(f'expected settings-empty rule once, found {s.count(old)}')
p.write_text(s.replace(old,new))
print('Settings empty-result contrast repair applied')
