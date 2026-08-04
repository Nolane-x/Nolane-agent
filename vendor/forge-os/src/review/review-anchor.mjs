import {canonicalSha256} from '../core/canonical-json.mjs';

export function anchorReviewFinding({finding,file}={}){
  if(!file)throw new Error('Review file is required');if(!Number.isInteger(finding?.line)||finding.line<1||finding.line>file.lines.length)throw new Error('Review line is out of range');const lineText=file.lines[finding.line-1];if(finding.evidenceText&&!lineText.includes(finding.evidenceText))throw new Error('Review evidence text mismatch');const anchor={file:finding.file,line:finding.line,fileSha256:file.sha256,lineSha256:canonicalSha256(lineText),lineText,evidenceText:finding.evidenceText??lineText.trim()};return Object.freeze({...finding,anchor,anchorSha256:canonicalSha256(anchor)});
}
export function relocateReviewAnchor({anchor,file}={}){
  if(!anchor||!file)throw new TypeError('Anchor and target file are required');if(file.sha256===anchor.fileSha256&&file.lines[anchor.line-1]===anchor.lineText)return Object.freeze({...anchor,relocation:'unchanged'});const needle=String(anchor.evidenceText??anchor.lineText).trim();const matches=[];file.lines.forEach((line,index)=>{if(line.includes(needle))matches.push(index+1);});if(matches.length===0)throw new Error('Anchor evidence no longer exists');if(matches.length>1)throw new Error('Ambiguous anchor relocation');const line=matches[0];const lineText=file.lines[line-1];return Object.freeze({...anchor,line,fileSha256:file.sha256,lineSha256:canonicalSha256(lineText),lineText,relocation:'unique-evidence-match'});
}
