from pathlib import Path
import subprocess

PATH='ui-v3/styles/pages/skills.css'
EXPECTED='d61bfa05ef02801a71b1f211d5b05e975dd08bd1'
actual=subprocess.check_output(['git','hash-object',PATH],text=True).strip()
print(f'guard {PATH}: {actual}')
if actual!=EXPECTED: raise SystemExit(f'{PATH}: unexpected blob {actual}; expected {EXPECTED}')
p=Path(PATH); s=p.read_text()
old='.skill-library-item__states>[data-skill-capability-state]{display:inline-flex;align-items:center;min-height:18px;padding:1px 6px;border:1px solid var(--border-subtle);border-radius:999px;background:color-mix(in srgb,var(--surface-panel) 64%,transparent);color:var(--text-secondary);font:600 8px/1.2 var(--font-sans);letter-spacing:.02em}.skill-library-item__states>[data-skill-capability-state="ready"],.skill-library-item__states>[data-skill-capability-state="enabled"]{border-color:color-mix(in srgb,var(--state-success) 32%,var(--border-subtle));color:var(--state-success)}.skill-library-item__states>[data-skill-capability-state="blocked"]{border-color:color-mix(in srgb,var(--state-error) 36%,var(--border-subtle));color:var(--state-error)}'
new='.skill-library-item__states>[data-skill-capability-state]{display:inline-flex;align-items:center;min-height:18px;padding:1px 6px;border:1px solid var(--border-subtle);border-radius:999px;background:color-mix(in srgb,var(--surface-panel) 64%,transparent);color:var(--text-primary);font:600 8px/1.2 var(--font-sans);letter-spacing:.02em}.skill-library-item__states>[data-skill-capability-state="ready"],.skill-library-item__states>[data-skill-capability-state="enabled"]{border-color:color-mix(in srgb,var(--state-success) 32%,var(--border-subtle));color:var(--text-primary)}.skill-library-item__states>[data-skill-capability-state="blocked"]{border-color:color-mix(in srgb,var(--state-error) 36%,var(--border-subtle));color:var(--text-primary)}'
if s.count(old)!=1: raise SystemExit(f'expected capability-chip rule once, found {s.count(old)}')
p.write_text(s.replace(old,new))
print('Skills capability chip contrast repair applied')
