import type { SVGProps } from 'react';

const iconNames = [
  'layers', 'scissors', 'minus', 'extract', 'grid', 'scan', 'compress', 'repair', 'text', 'image',
  'doc', 'presentation', 'sheet', 'web', 'archive', 'rotate', 'numbers', 'watermark', 'crop', 'edit',
  'form', 'unlock', 'lock', 'sign', 'redact', 'compare', 'spark', 'translate', 'markdown',
] as const;
export type IconName = typeof iconNames[number];

const paths: Record<IconName, string> = {
  layers: 'M3 8 12 3l9 5-9 5-9-5Zm0 5 9 5 9-5M3 18l9 5 9-5',
  scissors: 'm6 6 12 12M18 6 6 18M6 6h.01M6 18h.01',
  minus: 'M5 12h14',
  extract: 'M5 4h14v16H5zM9 8h6M9 12h6M9 16h3',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  scan: 'M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4M8 12h8',
  compress: 'm4 8 8 4 8-4M4 16l8 4 8-4M12 4v8',
  repair: 'M4 5h16v14H4zM8 9h8M8 13h5M16 18l3 3M18 16l3 3',
  text: 'M5 5h14M12 5v14M8 19h8',
  image: 'M4 5h16v14H4zM7 15l3-3 3 2 2-2 4 3M9 9h.01',
  doc: 'M5 3h10l4 4v14H5zM15 3v5h4M8 12h8M8 16h6',
  presentation: 'M4 4h16v12H4zM8 20l4-4 4 4M12 16v4',
  sheet: 'M5 3h14v18H5zM5 8h14M9 8v13M14 8v13',
  web: 'M4 5h16v14H4zM4 9h16M8 5v4',
  archive: 'M5 4h14v16H5zM9 8h6M9 12h6M9 16h6',
  rotate: 'M5 9a7 7 0 1 1 2 7M5 9V4m0 5h5',
  numbers: 'M7 5 5 19M15 5l-2 14M4 10h14M3 15h14',
  watermark: 'M4 5h16v14H4zM8 12h8M12 8v8',
  crop: 'M8 4v12h12M4 8h12v12',
  edit: 'M5 19h4L20 8l-4-4L5 15v4ZM14 6l4 4',
  form: 'M5 4h14v16H5zM8 9h2M12 9h4M8 14h2M12 14h4',
  unlock: 'M7 10V7a5 5 0 0 1 9-3M5 10h14v10H5z',
  lock: 'M7 10V7a5 5 0 0 1 10 0v3M5 10h14v10H5z',
  sign: 'M4 18c4-5 7 2 9-3 2-5 4-6 7-7M4 21h16',
  redact: 'M4 7h16M4 12h16M4 17h16',
  compare: 'M4 5h7v14H4zM13 5h7v14h-7z',
  spark: 'm12 3 1.5 6.5L20 12l-6.5 1.5L12 20l-1.5-6.5L4 12l6.5-2.5L12 3Z',
  translate: 'M4 5h9M8 5c0 6-2 9-5 11M5 11c2 0 5 2 7 5M15 6h5M17 6l-4 13M14 15h7',
  markdown: 'M4 6h16v12H4zM7 14V10l2 2 2-2v4M14 14h3m0 0v-4m0 4 2-2',
};

export function Icon({ name, ...props }: { name: string } & SVGProps<SVGSVGElement>) {
  const icon = (iconNames as readonly string[]).includes(name) ? name as IconName : 'doc';
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}><path d={paths[icon]} /></svg>;
}
