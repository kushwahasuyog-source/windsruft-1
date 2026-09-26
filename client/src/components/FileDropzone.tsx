import { useId, useRef, useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import type { AcceptedType } from '@shared/tools';
import { Icon } from './icons';

function acceptValue(types: AcceptedType[]): string {
  return types.map((type) => type === 'pdf' ? '.pdf,application/pdf' : type === 'image' ? 'image/*' : type === 'html' ? '.html,.htm,text/html' : `.${type},application/${type}`).join(',');
}
export function FileDropzone({ accepts, multiple, maxSizeMb=50, onFiles }: { accepts: AcceptedType[]; multiple:boolean; maxSizeMb?:number; onFiles:(files:File[])=>void }) {
 const input=useRef<HTMLInputElement>(null); const descriptionId=useId(); const [error,setError]=useState(''); const [drag,setDrag]=useState(false);
 const addFiles=(list:FileList|null)=>{if(!list)return; const candidates=Array.from(list).filter((f,i,a)=>a.findIndex(o=>o.name===f.name&&o.size===f.size)===i); const accepted=candidates.filter(file=>{const ext=file.name.split('.').pop()?.toLowerCase(); const valid=accepts.some(t=>t==='pdf'?ext==='pdf'||file.type==='application/pdf':t==='image'?file.type.startsWith('image/'):ext===t); return valid&&file.size<=maxSizeMb*1024*1024}); setError(accepted.length!==candidates.length?`Choose ${accepts.join(', ')} files up to ${maxSizeMb} MB.`:''); onFiles(multiple?accepted:accepted.slice(0,1));};
 const key=(e:KeyboardEvent<HTMLElement>)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();input.current?.click()}}; const drop=(e:DragEvent<HTMLElement>)=>{e.preventDefault();setDrag(false);addFiles(e.dataTransfer.files)};
 return <div className={`tool-dropzone ${drag?'is-dragging':''}`} role="button" tabIndex={0} aria-describedby={descriptionId} onClick={()=>input.current?.click()} onKeyDown={key} onDragEnter={()=>setDrag(true)} onDragOver={e=>e.preventDefault()} onDragLeave={()=>setDrag(false)} onDrop={drop}>
   <div className="tool-upload-icon"><Icon name="upload" className="h-7 w-7"/></div>
   <h3>{drag?'Drop your files here':'Drag & drop your files here'}</h3>
   <p>or <span>browse from your device</span></p>
   <div className="tool-upload-meta" id={descriptionId}><span>{accepts.join(', ').toUpperCase()}</span><span>Up to {maxSizeMb} MB</span>{multiple&&<span>Multiple files</span>}</div>
   {error&&<p className="mt-3 text-sm text-danger" role="alert">{error}</p>}
   <input ref={input} hidden type="file" accept={acceptValue(accepts)} multiple={multiple} onChange={e=>addFiles(e.target.files)}/>
 </div>;
}