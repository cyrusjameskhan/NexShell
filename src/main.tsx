import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import w95faUrl from './assets/W95FA.otf'
import falloutyUrl from './assets/r_fallouty.ttf'
import ibm3270Url from './assets/3270-Regular.woff'
import dosVgaUrl from './assets/PerfectDOSVGA437.woff'
import c64Url from './assets/Commodore64.woff'
import vt323Url from './assets/VT323-Regular.ttf'

const globalStyle = document.createElement('style')
globalStyle.textContent = `
@font-face {
  font-family: 'W95FA';
  font-style: normal;
  font-weight: 400;
  src: url('${w95faUrl}') format('opentype');
}
@font-face {
  font-family: 'Fallouty';
  font-style: normal;
  font-weight: 400;
  src: url('${falloutyUrl}') format('truetype');
}
@font-face {
  font-family: 'IBM 3270';
  font-style: normal;
  font-weight: 400;
  src: url('${ibm3270Url}') format('woff');
}
@font-face {
  font-family: 'Perfect DOS VGA 437';
  font-style: normal;
  font-weight: 400;
  src: url('${dosVgaUrl}') format('woff');
}
@font-face {
  font-family: 'Commodore 64';
  font-style: normal;
  font-weight: 400;
  src: url('${c64Url}') format('woff');
}
@font-face {
  font-family: 'VT323';
  font-style: normal;
  font-weight: 400;
  src: url('${vt323Url}') format('truetype');
}

@keyframes spin { to { transform: rotate(360deg) } }

@keyframes vhs-tear {
  0%, 100% { clip-path: inset(0 0 100% 0); opacity: 0; }
  4%  { clip-path: inset(12% 0 82% 0); opacity: 1; transform: translateX(4px); }
  5%  { clip-path: inset(12% 0 82% 0); opacity: 1; transform: translateX(-2px); }
  6%  { clip-path: inset(12% 0 82% 0); opacity: 0; transform: translateX(0); }
  30% { clip-path: inset(0 0 100% 0); opacity: 0; }
  33% { clip-path: inset(58% 0 35% 0); opacity: 1; transform: translateX(-6px); }
  34% { clip-path: inset(58% 0 35% 0); opacity: 1; transform: translateX(3px); }
  36% { clip-path: inset(58% 0 35% 0); opacity: 0; transform: translateX(0); }
  60% { clip-path: inset(0 0 100% 0); opacity: 0; }
  62% { clip-path: inset(85% 0 8% 0); opacity: 1; transform: translateX(5px); }
  63% { clip-path: inset(85% 0 8% 0); opacity: 0; transform: translateX(0); }
}

@keyframes crt-flicker {
  0%, 100% { opacity: 1; }
  25%  { opacity: 0.93; }
  30%  { opacity: 1; }
  55%  { opacity: 0.91; }
  60%  { opacity: 1; }
  80%  { opacity: 0.95; }
  85%  { opacity: 1; }
}

@keyframes crt-flicker-strong {
  0%, 100% { opacity: 1; }
  8%  { opacity: 0.82; }
  9%  { opacity: 1; }
  20% { opacity: 0.95; }
  22% { opacity: 1; }
  40% { opacity: 0.78; }
  41% { opacity: 0.96; }
  42% { opacity: 1; }
  60% { opacity: 0.88; }
  62% { opacity: 1; }
  80% { opacity: 0.72; }
  81% { opacity: 0.95; }
  82% { opacity: 1; }
  90% { opacity: 0.85; }
  92% { opacity: 1; }
}

@keyframes grain-shift {
  0%  { transform: translate(0, 0); }
  4%  { transform: translate(-5%, 3%); }
  8%  { transform: translate(2%, -6%); }
  12% { transform: translate(6%, 1%); }
  16% { transform: translate(-3%, -4%); }
  20% { transform: translate(4%, 5%); }
  24% { transform: translate(-7%, -2%); }
  28% { transform: translate(1%, 6%); }
  32% { transform: translate(5%, -3%); }
  36% { transform: translate(-4%, 7%); }
  40% { transform: translate(3%, -5%); }
  44% { transform: translate(-6%, 2%); }
  48% { transform: translate(7%, -1%); }
  52% { transform: translate(-2%, 4%); }
  56% { transform: translate(5%, -7%); }
  60% { transform: translate(-3%, 6%); }
  64% { transform: translate(6%, 3%); }
  68% { transform: translate(-5%, -6%); }
  72% { transform: translate(2%, 7%); }
  76% { transform: translate(-7%, -3%); }
  80% { transform: translate(4%, -2%); }
  84% { transform: translate(-1%, 5%); }
  88% { transform: translate(7%, -4%); }
  92% { transform: translate(-6%, 1%); }
  96% { transform: translate(3%, -7%); }
  100% { transform: translate(0, 0); }
}
`
document.head.appendChild(globalStyle)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
