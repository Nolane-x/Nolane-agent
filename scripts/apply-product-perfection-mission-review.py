from pathlib import Path
import subprocess

EXPECTED = {
    'ui-v3/app.mjs': '2af4d31fa7c01cf82ec6e6176006b8b774b1d12d',
    'ui-v3/views/mission/mission-view.mjs': 'ebac670942d518c8301cd7c77a1194dc8273a9a5',
    'ui-v3/views/activity/activity-view.mjs': 'a1e331d99f5d21bcc6a13c09be68173e364b1c2c',
}


def blob(path):
    return subprocess.check_output(['git', 'hash-object', path], text=True).strip()


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected 1 match, found {count}')
    return text.replace(old, new)


for path, expected in EXPECTED.items():
    actual = blob(path)
    if actual != expected:
        raise SystemExit(f'{path}: unexpected source blob {actual}, expected {expected}')

# Mission: preserve current model/progress API and add output escaping only.
mission = Path('ui-v3/views/mission/mission-view.mjs')
s = mission.read_text()
identity = "const createIdentity = (type, id) => Object.freeze({ type, id, sequence: ++identitySequence });\n"
escape = "const escapeHtml = (value) => String(value ?? '').replace(/[&<>\\\"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\\\"': '&quot;', \\"'\\": '&#39;' })[character]);\n"
s = replace_once(s, identity, identity + escape, 'mission escape authority')
old_return = "  return `<section class=\"mission-view\" data-mission-id=\"${snapshot.missionId}\"><header><h1>${snapshot.header.title ?? (vi ? 'Nhiệm vụ' : 'Mission')}</h1><p>${snapshot.header.status} · ${status}</p></header><div class=\"mission-activity\" data-follow-mode=\"${snapshot.followMode}\">${snapshot.activities.map((item) => `<article data-activity-id=\"${item.id}\"><strong>${item.summary ?? item.type}</strong></article>`).join('')}</div></section>`;\n"
new_return = "  return `<section class=\"mission-view\" data-mission-id=\"${escapeHtml(snapshot.missionId)}\"><header><h1>${escapeHtml(snapshot.header.title ?? (vi ? 'Nhiệm vụ' : 'Mission'))}</h1><p>${escapeHtml(snapshot.header.status)} · ${escapeHtml(status)}</p></header><div class=\"mission-activity\" data-follow-mode=\"${escapeHtml(snapshot.followMode)}\">${snapshot.activities.map((item) => `<article data-activity-id=\"${escapeHtml(item.id)}\"><strong>${escapeHtml(item.summary ?? item.type)}</strong></article>`).join('')}</div></section>`;\n"
s = replace_once(s, old_return, new_return, 'mission render escaping')
mission.write_text(s)

# Activity: stable focus identities for async rerender.
activity = Path('ui-v3/views/activity/activity-view.mjs')
s = activity.read_text()
s = replace_once(s, '<button type="button" data-activity-filter="${id}" aria-pressed="${state.filter===id}">', '<button type="button" data-activity-filter="${id}" data-preserve-key="activity-filter-${id}" aria-pressed="${state.filter===id}">', 'activity filter focus key')
s = replace_once(s, '<input type="checkbox" data-activity-follow ${state.follow?\'checked\':\'\'}>', '<input type="checkbox" data-activity-follow data-preserve-key="activity-follow" ${state.follow?\'checked\':\'\'}>', 'activity follow focus key')
activity.write_text(s)

# Generic rerender authority: preserve focus on buttons/checkboxes, not only text selection.
app = Path('ui-v3/app.mjs')
s = app.read_text()
old = '''  if (token) {\n    const next = root.querySelector(`[data-preserve-key="${CSS.escape(token)}"], [name="${CSS.escape(token)}"], #${CSS.escape(token)}`);\n    if (next && value !== undefined) next.value = value;\n    if (next && selection) { next.focus({ preventScroll: true }); next.setSelectionRange?.(...selection); }\n  }'''
new = '''  if (token) {\n    const next = root.querySelector(`[data-preserve-key="${CSS.escape(token)}"], [name="${CSS.escape(token)}"], #${CSS.escape(token)}`);\n    if (next) {\n      if (value !== undefined) next.value = value;\n      next.focus({ preventScroll: true });\n      if (selection) next.setSelectionRange?.(...selection);\n    }\n  }'''
s = replace_once(s, old, new, 'shared rerender focus authority')

s = replace_once(s, "const repaint=()=>{if(root)root.innerHTML=view.render()};", "const repaint=(preserve=null)=>rerenderView(root,view,{preserve});", 'activity repaint authority')
s = replace_once(s, "controller.setFilter(f.dataset.activityFilter);repaint();return;", "controller.setFilter(f.dataset.activityFilter);repaint(f);return;", 'activity filter repaint')
s = replace_once(s, "await controller.selectMission(mission.dataset.activityMission);repaint();return;", "await controller.selectMission(mission.dataset.activityMission);repaint(mission);return;", 'activity mission repaint')
s = replace_once(s, "repaint();}catch(error){alert(String(error?.message??error));repaint();}};", "repaint(tt);}catch(error){alert(String(error?.message??error));repaint(tt);}};", 'activity time travel repaint')
s = replace_once(s, "controller.setFollow(e.target.checked);repaint();", "controller.setFollow(e.target.checked);repaint(e.target);", 'activity follow repaint')
s = replace_once(s, "timer=setInterval(async()=>{if(controller.snapshot().follow){await controller.refresh();repaint();}},5000);", "timer=setInterval(async()=>{if(controller.snapshot().follow){const preserve=root?.contains(document.activeElement)?document.activeElement:null;await controller.refresh();repaint(preserve);}},5000);", 'activity polling focus preservation')

old_review = "router.register({ id: 'review-mission', pattern: /^\\/review\\/.+$/, cache: 'path', title: 'Review & Ship', load: async () => { const { createReviewModel, renderReviewView } = await import('./views/review/review-view.mjs'); const model = createReviewModel({ missionId: routeFromHash().split('?')[0].split('/').at(-1) || 'current' }); return { experienceLevel:'workspace',render: () => renderReviewView(model.snapshot(), { language: cachedPreferences.language }) }; } });"
new_review = "router.register({ id: 'review-mission', pattern: /^\\/review\\/.+$/, cache: 'path', title: 'Review & Ship', load: async () => {\n  const { createReviewController, renderReviewView } = await import('./views/review/review-view.mjs');\n  const missionId=routeFromHash().split('?')[0].split('/').at(-1)||'current';const controller=createReviewController({api,missionId,language:cachedPreferences.language});await controller.load();let root=null;const view={experienceLevel:'workspace',render:()=>renderReviewView(controller.snapshot(),{language:cachedPreferences.language}),mount(node){root=node;const repaint=(preserve=null)=>rerenderView(root,view,{preserve});const click=async(event)=>{const retry=event.target.closest('[data-review-action=\\\"retry\\\"]');if(retry){retry.disabled=true;await controller.load();repaint();return;}const button=event.target.closest('[data-review-decision]');if(!button)return;const hunk=button.closest('[data-review-hunk]');const reason=hunk?.querySelector('[data-review-reason]');const value=String(reason?.value??'').trim();if(!value){reason?.setAttribute('aria-invalid','true');reason?.focus({preventScroll:true});return;}reason?.removeAttribute('aria-invalid');button.disabled=true;await controller.decide({taskId:button.dataset.taskId,hunkId:button.dataset.hunkId,decision:button.dataset.reviewDecision,reason:value});repaint();};root.addEventListener('click',click);return()=>{root.removeEventListener('click',click);root=null;}}};return view;\n} });"
s = replace_once(s, old_review, new_review, 'server-backed review route')
app.write_text(s)
