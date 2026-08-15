const PATHS = Object.freeze({
  chat:'M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 3v-3A2.5 2.5 0 0 1 4 12.5v-6Z',
  activity:'M5 18V9m7 9V4m7 14v-6',
  projects:'M4 6.5h6l2 2h8v9.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6.5Z',
  review:'m5 12 4 4L19 6',
  studio:'M4 5h16v14H4V5Zm5 0v14m6-14v14',
  control:'M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6 2.1 2.1M18.4 5.6l-2.1 2.1m-8.6 8.6-2.1 2.1M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  search:'m20 20-4.4-4.4M10.8 18a7.2 7.2 0 1 1 0-14.4 7.2 7.2 0 0 1 0 14.4Z',
  settings:'M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm7-3.5 2-1.2-2-3.4-2.3.6a8 8 0 0 0-1.4-.8L15 4.8h-4L10.7 7a8 8 0 0 0-1.4.8L7 7.4l-2 3.4L7 12a8 8 0 0 0 0 1.6l-2 1.2 2 3.4 2.3-.6c.4.3.9.6 1.4.8l.3 2.2h4l.3-2.2c.5-.2 1-.5 1.4-.8l2.3.6 2-3.4-2-1.2a8 8 0 0 0 0-1.6Z',
  plus:'M12 5v14M5 12h14',
  paperclip:'m8 12.5 5.7-5.7a3 3 0 1 1 4.3 4.2l-7.6 7.6a5 5 0 1 1-7.1-7.1l7.6-7.6',
  send:'m4 4 16 8-16 8 3-8-3-8Zm3 8h10',
  chevron:'m8 10 4 4 4-4',
  spark:'m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Zm6 11 .7 2.3L21 17l-2.3.7L18 20l-.7-2.3L15 17l2.3-.7L18 14Z',
  command:'M8 7a3 3 0 1 0-3 3h14a3 3 0 1 0-3-3v10a3 3 0 1 0 3-3H5a3 3 0 1 0 3 3V7Z',
  model:'M4 8.5 12 4l8 4.5-8 4.5-8-4.5Zm0 4 8 4.5 8-4.5M4 16.5l8 4.5 8-4.5',
  tool:'M14.7 6.3a4 4 0 0 0-5 5L4 17l3 3 5.7-5.7a4 4 0 0 0 5-5l-2.5 2.5-3-3 2.5-2.5Z',
  file:'M6 3h8l4 4v14H6V3Zm8 0v5h5',
  terminal:'m5 7 4 4-4 4m6 1h6',
  branch:'M7 4v9a4 4 0 0 0 4 4h6m0 0-3-3m3 3-3 3M7 4a2 2 0 1 0 0 .1',
  globe:'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-18c2.5 2.4 3.8 5.4 3.8 9S14.5 18.6 12 21m0-18C9.5 5.4 8.2 8.4 8.2 12S9.5 18.6 12 21M3.5 9h17M3.5 15h17',
  shield:'m12 3 7 3v5c0 4.6-2.8 8-7 10-4.2-2-7-5.4-7-10V6l7-3Z',
  evidence:'M5 4h14v16H5V4Zm3 4h8m-8 4h8m-8 4h5',
  close:'M6 6l12 12M18 6 6 18',
  menu:'M4 7h16M4 12h16M4 17h16',
  arrow:'m9 18 6-6-6-6',
  check:'m5 12 4 4L19 6',
  clock:'M12 7v5l3 2m6-2a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  warning:'M12 4 3 20h18L12 4Zm0 5v5m0 3h.01',
  eye:'M2.8 12s3.3-6 9.2-6 9.2 6 9.2 6-3.3 6-9.2 6-9.2-6-9.2-6Zm9.2 2.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z',
  copy:'M8 8h11v12H8V8Zm-3 8H4V4h11v1',
  play:'m9 6 9 6-9 6V6Z',
  pause:'M9 6v12m6-12v12',
});

export function icon(name, { size = 18, label = null, className = '' } = {}) {
  const path = PATHS[name] ?? PATHS.spark;
  const aria = label ? ` role="img" aria-label="${String(label).replace(/"/g,'&quot;')}"` : ' aria-hidden="true"';
  return `<svg class="ui-icon ${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"${aria}><path d="${path}"/></svg>`;
}

export const ICON_NAMES = Object.freeze(Object.keys(PATHS));
