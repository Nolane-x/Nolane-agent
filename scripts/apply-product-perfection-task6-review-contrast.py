from pathlib import Path
import subprocess

PATH = 'ui-v3/styles/pages/review.css'
EXPECTED = '519ef58eb3a0d117cb51725c7655e17170187b3e'
actual = subprocess.check_output(['git','hash-object',PATH], text=True).strip()
print(f'guard {PATH}: {actual}')
if actual != EXPECTED:
    raise SystemExit(f'{PATH}: unexpected blob {actual}; expected {EXPECTED}')

p = Path(PATH)
s = p.read_text()
old = '.review-detail>.review-summary span{background:var(--surface-canvas)}\n'
new = old + '.review-detail>.review-summary small{color:var(--text-primary);font-weight:550}\n'
if s.count(old) != 1:
    raise SystemExit(f'Review summary anchor expected once, found {s.count(old)}')
if '.review-detail>.review-summary small{' in s:
    raise SystemExit('Review summary small override already exists')
p.write_text(s.replace(old, new))
print('Review summary contrast repair applied')
