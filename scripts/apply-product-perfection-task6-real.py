from pathlib import Path
import subprocess

EXPECTED = {
    'ui-v3/app.mjs': '2af4d31c89965c340b711d9e9fa47ee4829f820d',
    'ui-v3/views/activity/activity-view.mjs': 'a1e3310af165c6ac8f116232fc9d61a9437b0e21',
}

def blob(path):
    return subprocess.check_output(['git','hash-object',path], text=True).strip()

def replace_once(text, old, new, label):
    n = text.count(old)
    if n != 1:
        raise SystemExit(f'{label}: expected 1 match, found {n}')
    return text.replace(old, new)

for path, expected in EXPECTED.items():
    actual = blob(path)
    print(f'guard {path}: {actual}')
    if actual != expected:
        raise SystemExit(f'{path}: unexpected blob {actual}; expected {expected}')

p = Path('ui-v3/views/activity/activity-view.mjs')
s = p.read_text()
s = replace_once(
    s,
    'data-activity-filter="${id}" aria-pressed="${state.filter===id}"',
    'data-activity-filter="${id}" data-preserve-key="activity-filter-${id}" aria-pressed="${state.filter===id}"',
    'activity filter preserve key',
)
s = replace_once(
    s,
    'data-activity-follow${state.follow?\' checked\':\'\'}',
    'data-activity-follow data-preserve-key="activity-follow"${state.follow?\' checked\':\'\'}',
    'activity follow preserve key',
)
p.write_text(s)

p = Path('ui-v3/app.mjs')
s = p.read_text()
old = '''  if (token) {
    const next = root.querySelector(`[data-preserve-key="${CSS.escape(token)}"], [name="${CSS.escape(token)}"], #${CSS.escape(token)}`);
    if (next && value !== undefined) next.value = value;
    if (next && selection) { next.focus({ preventScroll: true }); next.setSelectionRange?.(...selection); }
  }'''
new = '''  if (token) {
    const next = root.querySelector(`[data-preserve-key="${CSS.escape(token)}"], [name="${CSS.escape(token)}"], #${CSS.escape(token)}`);
    if (next) {
      if (value !== undefined) next.value = value;
      next.focus({ preventScroll: true });
      if (selection) next.setSelectionRange?.(...selection);
    }
  }'''
s = replace_once(s, old, new, 'shared rerender focus')

old_activity = "const selectedMissionId=new URLSearchParams((location.hash.split('?')[1]??'')).get('id');const controller=createActivityController({api,language:cachedPreferences.language,selectedMissionId,experience:cachedPreferences.experience});await controller.load();let root=null;let timer=null;const view={experienceLevel:'workspace',render:()=>renderActivityView(controller.snapshot()),mount(node){root=node;const repaint=()=>{if(root)root.innerHTML=view.render();};const click=async(e)=>{const f=e.target.closest('[data-activity-filter]');if(f){controller.setFilter(f.dataset.activityFilter);repaint();return;}const mission=e.target.closest('[data-activity-mission]');if(mission){await controller.selectMission(mission.dataset.activityMission);repaint();return;}const tt=e.target.closest('[data-time-travel-action]');if(!tt)return;const action=tt.dataset.timeTravelAction;const checkpointId=tt.dataset.timeTravelCheckpoint;tt.disabled=true;try{if(action==='create')await controller.createCheckpoint();else if(action==='select')await controller.selectCheckpoint(checkpointId);else if(action==='compare')await controller.compareCheckpoint(checkpointId);else if(action==='branch')await controller.createBranch(checkpointId);else if(action==='replay')await controller.replayMission(checkpointId);else if(action==='restore'){const file=tt.dataset.timeTravelPath;const approved=confirm(cachedPreferences.language==='vi'?`Khôi phục ${file} từ checkpoint? Trạng thái hiện tại sẽ được backup và ghi receipt mới.`:`Restore ${file} from the checkpoint? The current state will be backed up and a new receipt recorded.`);if(approved)await controller.restoreFile(checkpointId,file,{confirmOverwrite:true});}repaint();}catch(error){alert(String(error?.message??error));repaint();}};const change=(e)=>{if(e.target.matches('[data-activity-follow]')){controller.setFollow(e.target.checked);repaint();}};timer=setInterval(async()=>{if(controller.snapshot().follow){await controller.refresh();repaint();}},5000);root.addEventListener('click',click);root.addEventListener('change',change);return()=>{clearInterval(timer);root.removeEventListener('click',click);root.removeEventListener('change',change);root=null;}}};return view;"
new_activity = "const selectedMissionId=new URLSearchParams((location.hash.split('?')[1]??'')).get('id');const controller=createActivityController({api,language:cachedPreferences.language,selectedMissionId,experience:cachedPreferences.experience});await controller.load();let root=null;let timer=null;const view={experienceLevel:'workspace',render:()=>renderActivityView(controller.snapshot()),mount(node){root=node;const repaint=(preserve=null)=>rerenderView(root,view,{preserve});const click=async(e)=>{const f=e.target.closest('[data-activity-filter]');if(f){controller.setFilter(f.dataset.activityFilter);repaint(f);return;}const mission=e.target.closest('[data-activity-mission]');if(mission){await controller.selectMission(mission.dataset.activityMission);repaint(mission);return;}const tt=e.target.closest('[data-time-travel-action]');if(!tt)return;const action=tt.dataset.timeTravelAction;const checkpointId=tt.dataset.timeTravelCheckpoint;tt.disabled=true;try{if(action==='create')await controller.createCheckpoint();else if(action==='select')await controller.selectCheckpoint(checkpointId);else if(action==='compare')await controller.compareCheckpoint(checkpointId);else if(action==='branch')await controller.createBranch(checkpointId);else if(action==='replay')await controller.replayMission(checkpointId);else if(action==='restore'){const file=tt.dataset.timeTravelPath;const approved=confirm(cachedPreferences.language==='vi'?`Khôi phục ${file} từ checkpoint? Trạng thái hiện tại sẽ được backup và ghi receipt mới.`:`Restore ${file} from the checkpoint? The current state will be backed up and a new receipt recorded.`);if(approved)await controller.restoreFile(checkpointId,file,{confirmOverwrite:true});}repaint(tt);}catch(error){alert(String(error?.message??error));repaint(tt);}};const change=(e)=>{if(e.target.matches('[data-activity-follow]')){controller.setFollow(e.target.checked);repaint(e.target);}};timer=setInterval(async()=>{if(controller.snapshot().follow){const preserve=root?.contains(document.activeElement)?document.activeElement:null;await controller.refresh();repaint(preserve);}},5000);root.addEventListener('click',click);root.addEventListener('change',change);return()=>{clearInterval(timer);root.removeEventListener('click',click);root.removeEventListener('change',change);root=null;}}};return view;"
s = replace_once(s, old_activity, new_activity, 'Activity route focus preservation')

old_review = "router.register({ id: 'review-mission', pattern: /^\\/review\\/.+$/, cache: 'path', title: 'Review & Ship', load: async () => { const { createReviewModel, renderReviewView } = await import('./views/review/review-view.mjs'); const model = createReviewModel({ missionId: routeFromHash().split('?')[0].split('/').at(-1) || 'current' }); return { experienceLevel:'workspace',render: () => renderReviewView(model.snapshot(), { language: cachedPreferences.language }) }; } });"
new_review = """router.register({ id: 'review-mission', pattern: /^\\/review\\/.+$/, cache: 'path', title: 'Review & Ship', load: async () => {
  const { createReviewController, renderReviewView } = await import('./views/review/review-view.mjs');
  const missionId=routeFromHash().split('?')[0].split('/').at(-1)||'current';const controller=createReviewController({api,missionId,language:cachedPreferences.language});await controller.load();let root=null;const view={experienceLevel:'workspace',render:()=>renderReviewView(controller.snapshot(),{language:cachedPreferences.language}),mount(node){root=node;const repaint=(preserve=null)=>rerenderView(root,view,{preserve});const click=async(event)=>{const retry=event.target.closest('[data-review-action=\"retry\"]');if(retry){retry.disabled=true;await controller.load();repaint();return;}const button=event.target.closest('[data-review-decision]');if(!button)return;const hunk=button.closest('[data-review-hunk]');const reason=hunk?.querySelector('[data-review-reason]');const value=String(reason?.value??'').trim();if(!value){reason?.setAttribute('aria-invalid','true');reason?.focus({preventScroll:true});return;}reason?.removeAttribute('aria-invalid');button.disabled=true;await controller.decide({taskId:button.dataset.taskId,hunkId:button.dataset.hunkId,decision:button.dataset.reviewDecision,reason:value});repaint();};root.addEventListener('click',click);return()=>{root.removeEventListener('click',click);root=null;}}};return view;
} });"""
s = replace_once(s, old_review, new_review, 'server-backed Review route')
p.write_text(s)

for marker in [
    'docs/product-perfection/.task6-real-stage-sentinel',
    'docs/product-perfection/.task6-real-stage-sentinel-2',
    'docs/product-perfection/.task6-real-stage-sentinel-3',
    'docs/product-perfection/.STOP',
    'docs/product-perfection/.task6-closure-trigger',
]:
    Path(marker).unlink(missing_ok=True)

print('Task 6 app/activity migration applied')
