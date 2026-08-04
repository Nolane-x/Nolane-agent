import { loadSkillCatalog, validateSkillCatalog } from '../src/skills/catalog.mjs';
const report = validateSkillCatalog(await loadSkillCatalog());
if (report.errors.length) {
  console.error(report.errors.join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${report.count} ForgeOS skills (${report.coreCount} core, ${report.domainCount} domain).`);
}
