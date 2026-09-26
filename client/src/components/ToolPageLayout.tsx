import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ToolDefinition } from '@shared/tools';
import { FileDropzone } from './FileDropzone';
import { FileList } from './FileList';
import { useFileQueue, type QueueOptions, type QueueStatus } from '../hooks/useFileQueue';
import { loadToolModule } from '../tools/loader';
import type { ToolModule, ToolSetting, ToolSettings } from '../tools/types';
import { addHistory } from '../services/history';
import { Button, Card, Spinner } from './ui/Primitives';

interface Capabilities { ocr?:boolean; libreoffice?:boolean; chrome?:boolean; poppler?:boolean; ghostscript?:boolean; ai?:boolean; }
const requirements:Record<string,{keys:Array<keyof Capabilities>;message:string}>={
 'ocr-pdf':{keys:['ocr'],message:'OCR language data is not configured on this deployment.'},
 'word-to-pdf':{keys:['libreoffice','chrome'],message:'No document conversion engine is available on this deployment.'},
 'excel-to-pdf':{keys:['libreoffice','chrome'],message:'No spreadsheet conversion engine is available on this deployment.'},
 'powerpoint-to-pdf':{keys:['libreoffice'],message:'LibreOffice is required for presentation conversion.'},
 'html-to-pdf':{keys:['chrome'],message:'The Chrome rendering engine is not available.'},
 'pdf-to-jpg':{keys:['poppler','ghostscript'],message:'No page rendering engine is available.'},
 'pdf-to-powerpoint':{keys:['poppler','ghostscript'],message:'No page rendering engine is available.'},
 'pdf-to-pdfa':{keys:['ghostscript'],message:'Ghostscript is required for PDF/A conversion.'},
 'redact-pdf':{keys:['poppler'],message:'Poppler is required to locate and flatten redacted pages.'},
 'ai-summarizer':{keys:['ai'],message:'AI provider is not configured.'},
 'translate-pdf':{keys:['ai'],message:'AI provider is not configured.'},
};
export function ToolPageLayout({tool,children,initialFile}:{tool:ToolDefinition;children?:ReactNode;initialFile?:File}){
 const queue=useFileQueue(); const [module,setModule]=useState<ToolModule>(); const [capabilities,setCapabilities]=useState<Capabilities>(); const [settings,setSettings]=useState<ToolSettings>({level:localStorage.getItem('pdfforge-default-level')??'recommended'}); const [hasAddedInitialFile,setHasAddedInitialFile]=useState(false); const recorded=useRef(new Set<string>()); const standaloneRecorded=useRef<QueueStatus>();
 useEffect(()=>{let active=true;setModule(undefined);setSettings({level:localStorage.getItem('pdfforge-default-level')??'recommended'});void loadToolModule(tool.slug).then(m=>{if(active)setModule(m)});return()=>{active=false}},[tool.slug]);
 useEffect(()=>{void fetch('/api/capabilities').then(r=>r.json() as Promise<Capabilities>).then(setCapabilities).catch(()=>setCapabilities(undefined))},[]);
 useEffect(()=>{if(initialFile&&!hasAddedInitialFile){queue.add([initialFile]);setHasAddedInitialFile(true)}},[initialFile,hasAddedInitialFile,queue.add]);
 useEffect(()=>{queue.items.filter(i=>(i.status==='COMPLETED'||i.status==='FAILED')&&!recorded.current.has(i.id)).forEach(i=>{recorded.current.add(i.id);const result=i.result?.files[0];addHistory({fileName:i.file.name,tool:tool.name,status:i.status==='COMPLETED'?'completed':'failed',...(result?{downloadUrl:result.downloadUrl}:{}),expiresAt:new Date(Date.now()+30*60_000).toISOString()})})},[queue.items,tool.name]);
 useEffect(()=>{const job=queue.standalone;if(!job||(job.status!=='COMPLETED'&&job.status!=='FAILED')||standaloneRecorded.current===job.status)return;standaloneRecorded.current=job.status;const result=job.result?.files[0];addHistory({fileName:job.label||'HTML document',tool:tool.name,status:job.status==='COMPLETED'?'completed':'failed',...(result?{downloadUrl:result.downloadUrl}:{}),expiresAt:new Date(Date.now()+30*60_000).toISOString()})},[queue.standalone,tool.name]);
 const updateSetting=useCallback((key:string,value:ToolSetting)=>setSettings(c=>c[key]===value?c:{...c,[key]:value}),[]);
 const request=module?module.buildRequest(settings,queue.items):undefined; const SettingsComponent=module?.Settings; const contentMode=tool.slug==='html-to-pdf'&&settings.mode!=='file';
 const run=()=>{if(!request)return;if(contentMode){const label=settings.mode==='url'?String(settings.url??''):'Pasted HTML';void queue.processStandalone(label,request.options as QueueOptions);return}void queue.process(request.operation,request.options as QueueOptions)};
 const retry=(id:string)=>{if(request)void queue.retry(id,request.operation,request.options as QueueOptions)};
 const invalid=Boolean(settings.rangeError)||(tool.slug==='merge-pdf'&&queue.items.length<2)||(tool.slug==='compare-pdf'&&queue.items.length!==2)||(tool.slug==='redact-pdf'&&settings.confirmed!==true);
 const requirement=requirements[tool.slug]; const unavailable=Boolean(requirement&&capabilities&&!requirement.keys.some(k=>capabilities[k])); const aiTool=tool.slug==='ai-summarizer'||tool.slug==='translate-pdf'; const showActions=queue.items.length>0||contentMode;
 return <main className="tool-page"><div className="mx-auto max-w-shell px-gutter py-12 sm:py-16">
   <div className="tool-breadcrumb"><span>PDF tools</span><span>/</span><b>{tool.name}</b></div>
   <header className="tool-header"><div className="tool-title-icon"><span><span className="tool-header-dot"/></span></div><div><p className="eyebrow">{tool.category}</p><h1>{tool.name}</h1><p>{tool.description}</p></div></header>
   <div className="tool-workspace">
     <div className="tool-main-card">
       {tool.status==='planned'&&!aiTool?<Card className="border-accent/30 text-center"><p className="text-lg font-bold">{tool.name} is coming soon.</p><p className="mt-2 text-secondary">The workspace is ready; processing will arrive in a later phase.</p></Card>:<>
       {tool.status==='planned'&&aiTool&&<div className="tool-notice">AI provider is not configured for this deployment.</div>}
       {unavailable&&requirement&&<div className="tool-error-notice"><b>This tool is unavailable.</b><span>{requirement.message}</span></div>}
       {!contentMode&&<FileDropzone accepts={tool.accepts} multiple={tool.multiple} onFiles={queue.add}/>}
       {SettingsComponent?<SettingsComponent items={queue.items} settings={settings} onChange={updateSetting}/>:<div className="tool-loading"><Spinner/></div>}
       {children}
       <FileList items={queue.items} onRemove={queue.remove} onRetry={retry}/>
       {queue.standalone&&<Card className="tool-result"><p className="font-semibold">{queue.standalone.label||'HTML document'}</p><p className="mt-1 text-sm text-muted">{queue.standalone.status==='PROCESSING'?'Rendering on the server…':queue.standalone.status==='COMPLETED'?'Ready to download.':queue.standalone.error}</p>{queue.standalone.result?.files.map(file=><a key={file.fileId} className="tool-primary-btn mt-3 inline-flex" href={file.downloadUrl} download>Download {file.name}</a>)}</Card>}
       {showActions&&<div className="tool-actions"><Button className="tool-primary-btn" disabled={queue.processing||invalid||unavailable} onClick={run}>{queue.processing?'Processing…':`Start ${tool.name}`}</Button>{queue.processing&&<Button className="tool-secondary-btn" onClick={queue.cancel}>Cancel</Button>}<Button className="tool-secondary-btn" onClick={queue.clear}>Start over</Button></div>}
       {invalid&&<p className="mt-3 text-center text-sm text-danger">{tool.slug==='merge-pdf'?'Add at least two PDF files to merge.':tool.slug==='compare-pdf'?'Add exactly two PDF files to compare.':tool.slug==='redact-pdf'?'Confirm the irreversible redaction action before continuing.':typeof settings.rangeError==='string'?settings.rangeError:'Check the selected settings.'}</p>}
       </>}
     </div>
     <aside className="tool-side-card"><div className="side-title">How it works</div><ol><li><b>Upload</b><span>Select or drag your file{tool.multiple?'s':''} into the box.</span></li><li><b>Customize</b><span>Choose the settings available for this tool.</span></li><li><b>Process</b><span>Click the main button and let the server do the work.</span></li><li><b>Download</b><span>Save your finished file when processing is complete.</span></li></ol><div className="side-trust"><span>✓</span><div><b>Private by default</b><small>Files are automatically deleted after processing.</small></div></div><div className="side-meta"><span>Max file size</span><b>50 MB</b></div></aside>
   </div>
   <p className="tool-footnote">No installation required · Works in modern browsers · Your files are automatically deleted after processing</p>
 </div></main>;
}