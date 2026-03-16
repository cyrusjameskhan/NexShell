import { TerminalTheme } from './types'

export const themes: TerminalTheme[] = [
  {
    id: 'midnight',
    name: 'Midnight',
    colors: {
      background: '#0d1117',
      foreground: '#c9d1d9',
      cursor: '#58a6ff',
      cursorAccent: '#0d1117',
      selectionBackground: '#264f78',
      black: '#484f58',
      red: '#ff7b72',
      green: '#3fb950',
      yellow: '#d29922',
      blue: '#58a6ff',
      magenta: '#bc8cff',
      cyan: '#39d2c0',
      white: '#b1bac4',
      brightBlack: '#6e7681',
      brightRed: '#ffa198',
      brightGreen: '#56d364',
      brightYellow: '#e3b341',
      brightBlue: '#79c0ff',
      brightMagenta: '#d2a8ff',
      brightCyan: '#56d4dd',
      brightWhite: '#f0f6fc',
    },
    ui: {
      bg: '#0d1117',
      bgSecondary: '#161b22',
      bgTertiary: '#1c2128',
      border: '#30363d',
      text: '#c9d1d9',
      textMuted: '#8b949e',
      textDim: '#484f58',
      accent: '#58a6ff',
      accentHover: '#79c0ff',
      accentMuted: '#1f3a5f',
      danger: '#f85149',
      success: '#3fb950',
      warning: '#d29922',
      tabActive: '#0d1117',
      tabInactive: '#161b22',
      sidebar: '#0d1117',
      titlebar: '#0d1117',
      inputBg: '#0d1117',
      inputBorder: '#30363d',
      inputFocus: '#58a6ff',
      scrollbar: '#484f58',
      scrollbarHover: '#6e7681',
      shadow: 'rgba(0,0,0,0.4)',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    colors: {
      background: '#1b2838',
      foreground: '#c0c8d1',
      cursor: '#6cb6ff',
      cursorAccent: '#1b2838',
      selectionBackground: '#2d4a6f',
      black: '#3b4859',
      red: '#e06c75',
      green: '#98c379',
      yellow: '#e5c07b',
      blue: '#6cb6ff',
      magenta: '#c678dd',
      cyan: '#56b6c2',
      white: '#abb2bf',
      brightBlack: '#5c6773',
      brightRed: '#f08090',
      brightGreen: '#b5e890',
      brightYellow: '#ffd68a',
      brightBlue: '#8ccfff',
      brightMagenta: '#dda0f0',
      brightCyan: '#70d8e5',
      brightWhite: '#e0e6ed',
    },
    ui: {
      bg: '#1b2838',
      bgSecondary: '#223244',
      bgTertiary: '#2a3c50',
      border: '#344860',
      text: '#c0c8d1',
      textMuted: '#7e8c9a',
      textDim: '#4a5768',
      accent: '#6cb6ff',
      accentHover: '#8ccfff',
      accentMuted: '#1e3a5c',
      danger: '#e06c75',
      success: '#98c379',
      warning: '#e5c07b',
      tabActive: '#1b2838',
      tabInactive: '#223244',
      sidebar: '#162230',
      titlebar: '#162230',
      inputBg: '#162230',
      inputBorder: '#344860',
      inputFocus: '#6cb6ff',
      scrollbar: '#3b4859',
      scrollbarHover: '#5c6773',
      shadow: 'rgba(0,0,0,0.5)',
    },
  },
  {
    id: 'nord',
    name: 'Nord',
    colors: {
      background: '#2e3440',
      foreground: '#d8dee9',
      cursor: '#88c0d0',
      cursorAccent: '#2e3440',
      selectionBackground: '#434c5e',
      black: '#3b4252',
      red: '#bf616a',
      green: '#a3be8c',
      yellow: '#ebcb8b',
      blue: '#81a1c1',
      magenta: '#b48ead',
      cyan: '#88c0d0',
      white: '#e5e9f0',
      brightBlack: '#4c566a',
      brightRed: '#d08770',
      brightGreen: '#a3be8c',
      brightYellow: '#ebcb8b',
      brightBlue: '#81a1c1',
      brightMagenta: '#b48ead',
      brightCyan: '#8fbcbb',
      brightWhite: '#eceff4',
    },
    ui: {
      bg: '#2e3440',
      bgSecondary: '#3b4252',
      bgTertiary: '#434c5e',
      border: '#4c566a',
      text: '#d8dee9',
      textMuted: '#81a1c1',
      textDim: '#4c566a',
      accent: '#88c0d0',
      accentHover: '#8fbcbb',
      accentMuted: '#3b5263',
      danger: '#bf616a',
      success: '#a3be8c',
      warning: '#ebcb8b',
      tabActive: '#2e3440',
      tabInactive: '#3b4252',
      sidebar: '#2e3440',
      titlebar: '#2e3440',
      inputBg: '#2e3440',
      inputBorder: '#4c566a',
      inputFocus: '#88c0d0',
      scrollbar: '#4c566a',
      scrollbarHover: '#616e88',
      shadow: 'rgba(0,0,0,0.4)',
    },
  },
  {
    id: 'monokai',
    name: 'Monokai Pro',
    colors: {
      background: '#2d2a2e',
      foreground: '#fcfcfa',
      cursor: '#ffd866',
      cursorAccent: '#2d2a2e',
      selectionBackground: '#403e41',
      black: '#403e41',
      red: '#ff6188',
      green: '#a9dc76',
      yellow: '#ffd866',
      blue: '#78dce8',
      magenta: '#ab9df2',
      cyan: '#78dce8',
      white: '#fcfcfa',
      brightBlack: '#727072',
      brightRed: '#ff6188',
      brightGreen: '#a9dc76',
      brightYellow: '#ffd866',
      brightBlue: '#78dce8',
      brightMagenta: '#ab9df2',
      brightCyan: '#78dce8',
      brightWhite: '#fcfcfa',
    },
    ui: {
      bg: '#2d2a2e',
      bgSecondary: '#353236',
      bgTertiary: '#403e41',
      border: '#4a474d',
      text: '#fcfcfa',
      textMuted: '#939293',
      textDim: '#5b595c',
      accent: '#ffd866',
      accentHover: '#ffe899',
      accentMuted: '#4a4330',
      danger: '#ff6188',
      success: '#a9dc76',
      warning: '#fc9867',
      tabActive: '#2d2a2e',
      tabInactive: '#353236',
      sidebar: '#2d2a2e',
      titlebar: '#2d2a2e',
      inputBg: '#2d2a2e',
      inputBorder: '#4a474d',
      inputFocus: '#ffd866',
      scrollbar: '#5b595c',
      scrollbarHover: '#727072',
      shadow: 'rgba(0,0,0,0.5)',
    },
  },
  {
    id: 'dracula',
    name: 'Dracula',
    colors: {
      background: '#282a36',
      foreground: '#f8f8f2',
      cursor: '#f8f8f2',
      cursorAccent: '#282a36',
      selectionBackground: '#44475a',
      black: '#21222c',
      red: '#ff5555',
      green: '#50fa7b',
      yellow: '#f1fa8c',
      blue: '#bd93f9',
      magenta: '#ff79c6',
      cyan: '#8be9fd',
      white: '#f8f8f2',
      brightBlack: '#6272a4',
      brightRed: '#ff6e6e',
      brightGreen: '#69ff94',
      brightYellow: '#ffffa5',
      brightBlue: '#d6acff',
      brightMagenta: '#ff92df',
      brightCyan: '#a4ffff',
      brightWhite: '#ffffff',
    },
    ui: {
      bg: '#282a36',
      bgSecondary: '#313341',
      bgTertiary: '#3a3c4e',
      border: '#44475a',
      text: '#f8f8f2',
      textMuted: '#6272a4',
      textDim: '#44475a',
      accent: '#bd93f9',
      accentHover: '#d6acff',
      accentMuted: '#3a3359',
      danger: '#ff5555',
      success: '#50fa7b',
      warning: '#f1fa8c',
      tabActive: '#282a36',
      tabInactive: '#313341',
      sidebar: '#21222c',
      titlebar: '#21222c',
      inputBg: '#21222c',
      inputBorder: '#44475a',
      inputFocus: '#bd93f9',
      scrollbar: '#44475a',
      scrollbarHover: '#6272a4',
      shadow: 'rgba(0,0,0,0.5)',
    },
  },
  {
    id: 'solarized-dark',
    name: 'Solarized Dark',
    colors: {
      background: '#002b36',
      foreground: '#839496',
      cursor: '#268bd2',
      cursorAccent: '#002b36',
      selectionBackground: '#073642',
      black: '#073642',
      red: '#dc322f',
      green: '#859900',
      yellow: '#b58900',
      blue: '#268bd2',
      magenta: '#d33682',
      cyan: '#2aa198',
      white: '#eee8d5',
      brightBlack: '#586e75',
      brightRed: '#cb4b16',
      brightGreen: '#586e75',
      brightYellow: '#657b83',
      brightBlue: '#839496',
      brightMagenta: '#6c71c4',
      brightCyan: '#93a1a1',
      brightWhite: '#fdf6e3',
    },
    ui: {
      bg: '#002b36',
      bgSecondary: '#073642',
      bgTertiary: '#0a4050',
      border: '#11535e',
      text: '#839496',
      textMuted: '#586e75',
      textDim: '#2e4a50',
      accent: '#268bd2',
      accentHover: '#2aa198',
      accentMuted: '#0a3a5e',
      danger: '#dc322f',
      success: '#859900',
      warning: '#b58900',
      tabActive: '#002b36',
      tabInactive: '#073642',
      sidebar: '#002028',
      titlebar: '#002028',
      inputBg: '#002028',
      inputBorder: '#11535e',
      inputFocus: '#268bd2',
      scrollbar: '#2e4a50',
      scrollbarHover: '#586e75',
      shadow: 'rgba(0,0,0,0.5)',
    },
  },
  // ── Hacker / Neon themes ──────────────────────────────────────────────────

  {
    id: 'matrix',
    name: 'Matrix',
    colors: {
      background: '#000000',
      foreground: '#00ff41',
      cursor: '#00ff41',
      cursorAccent: '#000000',
      selectionBackground: '#003b00',
      black: '#001a00',
      red: '#ff0000',
      green: '#00ff41',
      yellow: '#ccff00',
      blue: '#00aaff',
      magenta: '#00ff41',
      cyan: '#00ffaa',
      white: '#00ff41',
      brightBlack: '#003300',
      brightRed: '#ff4444',
      brightGreen: '#39ff14',
      brightYellow: '#ddff44',
      brightBlue: '#33bbff',
      brightMagenta: '#44ff99',
      brightCyan: '#55ffcc',
      brightWhite: '#aaffaa',
    },
    ui: {
      bg: '#000000',
      bgSecondary: '#020d02',
      bgTertiary: '#041804',
      border: '#003300',
      text: '#00ff41',
      textMuted: '#00aa2a',
      textDim: '#005510',
      accent: '#00ff41',
      accentHover: '#39ff14',
      accentMuted: '#002200',
      danger: '#ff3333',
      success: '#00ff41',
      warning: '#ccff00',
      tabActive: '#000000',
      tabInactive: '#020d02',
      sidebar: '#000000',
      titlebar: '#000000',
      inputBg: '#020d02',
      inputBorder: '#003300',
      inputFocus: '#00ff41',
      scrollbar: '#003300',
      scrollbarHover: '#006600',
      shadow: 'rgba(0,255,65,0.07)',
    },
  },
  {
    id: 'red-hacker',
    name: 'Red Hacker',
    colors: {
      background: '#180000',
      foreground: '#ff3333',
      cursor: '#ff0000',
      cursorAccent: '#180000',
      selectionBackground: '#4a0000',
      black: '#250000',
      red: '#ff0000',
      green: '#ff5500',
      yellow: '#ff8800',
      blue: '#ff3399',
      magenta: '#ff00ff',
      cyan: '#ff6666',
      white: '#ffaaaa',
      brightBlack: '#3f0000',
      brightRed: '#ff4444',
      brightGreen: '#ff6633',
      brightYellow: '#ffaa33',
      brightBlue: '#ff55bb',
      brightMagenta: '#ff44ff',
      brightCyan: '#ff9999',
      brightWhite: '#ffcccc',
    },
    ui: {
      bg: '#180000',
      bgSecondary: '#220000',
      bgTertiary: '#2e0000',
      border: '#4a0000',
      text: '#ff3333',
      textMuted: '#aa1111',
      textDim: '#660000',
      accent: '#ff0000',
      accentHover: '#ff4444',
      accentMuted: '#380000',
      danger: '#ff0000',
      success: '#ff5500',
      warning: '#ff8800',
      tabActive: '#180000',
      tabInactive: '#220000',
      sidebar: '#180000',
      titlebar: '#180000',
      inputBg: '#220000',
      inputBorder: '#4a0000',
      inputFocus: '#ff0000',
      scrollbar: '#3f0000',
      scrollbarHover: '#660000',
      shadow: 'rgba(255,0,0,0.08)',
    },
  },
  {
    id: 'blue-hacker',
    name: 'Cyberpunk Blue',
    colors: {
      background: '#000814',
      foreground: '#00d4ff',
      cursor: '#00d4ff',
      cursorAccent: '#000814',
      selectionBackground: '#001a3d',
      black: '#000f22',
      red: '#ff2d6d',
      green: '#00ffcc',
      yellow: '#ffe600',
      blue: '#0096ff',
      magenta: '#7b2fff',
      cyan: '#00d4ff',
      white: '#cce8ff',
      brightBlack: '#002244',
      brightRed: '#ff5588',
      brightGreen: '#33ffdd',
      brightYellow: '#ffee44',
      brightBlue: '#33aaff',
      brightMagenta: '#9955ff',
      brightCyan: '#44ddff',
      brightWhite: '#e0f4ff',
    },
    ui: {
      bg: '#000814',
      bgSecondary: '#00101f',
      bgTertiary: '#00172e',
      border: '#003366',
      text: '#00d4ff',
      textMuted: '#0088bb',
      textDim: '#004466',
      accent: '#00d4ff',
      accentHover: '#44ddff',
      accentMuted: '#001a3d',
      danger: '#ff2d6d',
      success: '#00ffcc',
      warning: '#ffe600',
      tabActive: '#000814',
      tabInactive: '#00101f',
      sidebar: '#000814',
      titlebar: '#000814',
      inputBg: '#00101f',
      inputBorder: '#003366',
      inputFocus: '#00d4ff',
      scrollbar: '#003366',
      scrollbarHover: '#005588',
      shadow: 'rgba(0,212,255,0.07)',
    },
  },

  // ── Purple themes ─────────────────────────────────────────────────────────

  {
    id: 'deep-purple',
    name: 'Deep Purple',
    colors: {
      background: '#0d0014',
      foreground: '#e0aaff',
      cursor: '#c77dff',
      cursorAccent: '#0d0014',
      selectionBackground: '#3d006b',
      black: '#1a0030',
      red: '#ff4d6d',
      green: '#80ffdb',
      yellow: '#f7b731',
      blue: '#7b2fff',
      magenta: '#c77dff',
      cyan: '#72efdd',
      white: '#e0aaff',
      brightBlack: '#3d0070',
      brightRed: '#ff6b81',
      brightGreen: '#9fffcb',
      brightYellow: '#ffd166',
      brightBlue: '#9d4edd',
      brightMagenta: '#e0aaff',
      brightCyan: '#96fce4',
      brightWhite: '#f8f0ff',
    },
    ui: {
      bg: '#0d0014',
      bgSecondary: '#130020',
      bgTertiary: '#1e0033',
      border: '#3d0070',
      text: '#e0aaff',
      textMuted: '#9d4edd',
      textDim: '#4a0088',
      accent: '#c77dff',
      accentHover: '#e0aaff',
      accentMuted: '#2a0050',
      danger: '#ff4d6d',
      success: '#80ffdb',
      warning: '#f7b731',
      tabActive: '#0d0014',
      tabInactive: '#130020',
      sidebar: '#0d0014',
      titlebar: '#0d0014',
      inputBg: '#130020',
      inputBorder: '#3d0070',
      inputFocus: '#c77dff',
      scrollbar: '#3d0070',
      scrollbarHover: '#7b2fff',
      shadow: 'rgba(199,125,255,0.08)',
    },
  },
  {
    id: 'synthwave',
    name: 'Synthwave',
    colors: {
      background: '#1a0533',
      foreground: '#e2a8f5',
      cursor: '#f92aad',
      cursorAccent: '#1a0533',
      selectionBackground: '#3c1361',
      black: '#241036',
      red: '#f92aad',
      green: '#72f1b8',
      yellow: '#fede5d',
      blue: '#2ee2fa',
      magenta: '#fe4450',
      cyan: '#03edf9',
      white: '#e2a8f5',
      brightBlack: '#4a1272',
      brightRed: '#ff6ac1',
      brightGreen: '#9effd4',
      brightYellow: '#fff48e',
      brightBlue: '#72f9ff',
      brightMagenta: '#ff7e7e',
      brightCyan: '#5ef6ff',
      brightWhite: '#f0c0ff',
    },
    ui: {
      bg: '#1a0533',
      bgSecondary: '#210a40',
      bgTertiary: '#2d1055',
      border: '#4a1a7a',
      text: '#e2a8f5',
      textMuted: '#c792ea',
      textDim: '#6b3e9e',
      accent: '#f92aad',
      accentHover: '#ff6ac1',
      accentMuted: '#3c1361',
      danger: '#fe4450',
      success: '#72f1b8',
      warning: '#fede5d',
      tabActive: '#1a0533',
      tabInactive: '#210a40',
      sidebar: '#140228',
      titlebar: '#140228',
      inputBg: '#210a40',
      inputBorder: '#4a1a7a',
      inputFocus: '#f92aad',
      scrollbar: '#4a1a7a',
      scrollbarHover: '#7b2fff',
      shadow: 'rgba(249,42,173,0.08)',
    },
  },

  // ── Popular community themes ──────────────────────────────────────────────

  {
    id: 'catppuccin-mocha',
    name: 'Catppuccin Mocha',
    colors: {
      background: '#1e1e2e',
      foreground: '#cdd6f4',
      cursor: '#f5e0dc',
      cursorAccent: '#1e1e2e',
      selectionBackground: '#585b70',
      black: '#45475a',
      red: '#f38ba8',
      green: '#a6e3a1',
      yellow: '#f9e2af',
      blue: '#89b4fa',
      magenta: '#f5c2e7',
      cyan: '#94e2d5',
      white: '#bac2de',
      brightBlack: '#585b70',
      brightRed: '#f38ba8',
      brightGreen: '#a6e3a1',
      brightYellow: '#f9e2af',
      brightBlue: '#89b4fa',
      brightMagenta: '#f5c2e7',
      brightCyan: '#94e2d5',
      brightWhite: '#a6adc8',
    },
    ui: {
      bg: '#1e1e2e',
      bgSecondary: '#24273a',
      bgTertiary: '#2a2b3c',
      border: '#45475a',
      text: '#cdd6f4',
      textMuted: '#a6adc8',
      textDim: '#585b70',
      accent: '#cba6f7',
      accentHover: '#d5b8ff',
      accentMuted: '#3d3553',
      danger: '#f38ba8',
      success: '#a6e3a1',
      warning: '#f9e2af',
      tabActive: '#1e1e2e',
      tabInactive: '#24273a',
      sidebar: '#181825',
      titlebar: '#181825',
      inputBg: '#181825',
      inputBorder: '#45475a',
      inputFocus: '#cba6f7',
      scrollbar: '#45475a',
      scrollbarHover: '#585b70',
      shadow: 'rgba(0,0,0,0.4)',
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    colors: {
      background: '#1a1b26',
      foreground: '#c0caf5',
      cursor: '#c0caf5',
      cursorAccent: '#1a1b26',
      selectionBackground: '#283457',
      black: '#15161e',
      red: '#f7768e',
      green: '#9ece6a',
      yellow: '#e0af68',
      blue: '#7aa2f7',
      magenta: '#bb9af7',
      cyan: '#7dcfff',
      white: '#a9b1d6',
      brightBlack: '#414868',
      brightRed: '#f7768e',
      brightGreen: '#9ece6a',
      brightYellow: '#e0af68',
      brightBlue: '#7aa2f7',
      brightMagenta: '#bb9af7',
      brightCyan: '#7dcfff',
      brightWhite: '#c0caf5',
    },
    ui: {
      bg: '#1a1b26',
      bgSecondary: '#1f2335',
      bgTertiary: '#24283b',
      border: '#2f334d',
      text: '#c0caf5',
      textMuted: '#565f89',
      textDim: '#3b3f5c',
      accent: '#7aa2f7',
      accentHover: '#9ab8ff',
      accentMuted: '#1e2d57',
      danger: '#f7768e',
      success: '#9ece6a',
      warning: '#e0af68',
      tabActive: '#1a1b26',
      tabInactive: '#1f2335',
      sidebar: '#16161e',
      titlebar: '#16161e',
      inputBg: '#16161e',
      inputBorder: '#2f334d',
      inputFocus: '#7aa2f7',
      scrollbar: '#2f334d',
      scrollbarHover: '#414868',
      shadow: 'rgba(0,0,0,0.5)',
    },
  },
  {
    id: 'gruvbox',
    name: 'Gruvbox Dark',
    colors: {
      background: '#282828',
      foreground: '#ebdbb2',
      cursor: '#ebdbb2',
      cursorAccent: '#282828',
      selectionBackground: '#3c3836',
      black: '#282828',
      red: '#cc241d',
      green: '#98971a',
      yellow: '#d79921',
      blue: '#458588',
      magenta: '#b16286',
      cyan: '#689d6a',
      white: '#a89984',
      brightBlack: '#928374',
      brightRed: '#fb4934',
      brightGreen: '#b8bb26',
      brightYellow: '#fabd2f',
      brightBlue: '#83a598',
      brightMagenta: '#d3869b',
      brightCyan: '#8ec07c',
      brightWhite: '#ebdbb2',
    },
    ui: {
      bg: '#282828',
      bgSecondary: '#32302f',
      bgTertiary: '#3c3836',
      border: '#504945',
      text: '#ebdbb2',
      textMuted: '#a89984',
      textDim: '#665c54',
      accent: '#fabd2f',
      accentHover: '#ffd14d',
      accentMuted: '#4a3d00',
      danger: '#fb4934',
      success: '#b8bb26',
      warning: '#fabd2f',
      tabActive: '#282828',
      tabInactive: '#32302f',
      sidebar: '#1d2021',
      titlebar: '#1d2021',
      inputBg: '#1d2021',
      inputBorder: '#504945',
      inputFocus: '#fabd2f',
      scrollbar: '#504945',
      scrollbarHover: '#665c54',
      shadow: 'rgba(0,0,0,0.5)',
    },
  },
  {
    id: 'one-dark',
    name: 'One Dark Pro',
    colors: {
      background: '#282c34',
      foreground: '#abb2bf',
      cursor: '#528bff',
      cursorAccent: '#282c34',
      selectionBackground: '#3e4451',
      black: '#3f4451',
      red: '#e06c75',
      green: '#98c379',
      yellow: '#e5c07b',
      blue: '#61afef',
      magenta: '#c678dd',
      cyan: '#56b6c2',
      white: '#abb2bf',
      brightBlack: '#4f5666',
      brightRed: '#ff7b86',
      brightGreen: '#b5e890',
      brightYellow: '#f0d197',
      brightBlue: '#80c8ff',
      brightMagenta: '#de8ff5',
      brightCyan: '#6dd5e0',
      brightWhite: '#c8cdd6',
    },
    ui: {
      bg: '#282c34',
      bgSecondary: '#21252b',
      bgTertiary: '#2c313c',
      border: '#3e4451',
      text: '#abb2bf',
      textMuted: '#5c6370',
      textDim: '#4b5263',
      accent: '#61afef',
      accentHover: '#80c8ff',
      accentMuted: '#1e3a5f',
      danger: '#e06c75',
      success: '#98c379',
      warning: '#e5c07b',
      tabActive: '#282c34',
      tabInactive: '#21252b',
      sidebar: '#21252b',
      titlebar: '#21252b',
      inputBg: '#21252b',
      inputBorder: '#3e4451',
      inputFocus: '#61afef',
      scrollbar: '#4b5263',
      scrollbarHover: '#5c6370',
      shadow: 'rgba(0,0,0,0.4)',
    },
  },
  {
    id: 'rose-pine',
    name: 'Rosé Pine',
    colors: {
      background: '#191724',
      foreground: '#e0def4',
      cursor: '#eb6f92',
      cursorAccent: '#191724',
      selectionBackground: '#2a2837',
      black: '#26233a',
      red: '#eb6f92',
      green: '#31748f',
      yellow: '#f6c177',
      blue: '#9ccfd8',
      magenta: '#c4a7e7',
      cyan: '#ebbcba',
      white: '#e0def4',
      brightBlack: '#403d52',
      brightRed: '#eb6f92',
      brightGreen: '#31748f',
      brightYellow: '#f6c177',
      brightBlue: '#9ccfd8',
      brightMagenta: '#c4a7e7',
      brightCyan: '#ebbcba',
      brightWhite: '#e0def4',
    },
    ui: {
      bg: '#191724',
      bgSecondary: '#1f1d2e',
      bgTertiary: '#26233a',
      border: '#403d52',
      text: '#e0def4',
      textMuted: '#908caa',
      textDim: '#555169',
      accent: '#c4a7e7',
      accentHover: '#d8c4f5',
      accentMuted: '#362e4a',
      danger: '#eb6f92',
      success: '#31748f',
      warning: '#f6c177',
      tabActive: '#191724',
      tabInactive: '#1f1d2e',
      sidebar: '#161523',
      titlebar: '#161523',
      inputBg: '#161523',
      inputBorder: '#403d52',
      inputFocus: '#c4a7e7',
      scrollbar: '#403d52',
      scrollbarHover: '#6e6a86',
      shadow: 'rgba(0,0,0,0.4)',
    },
  },
  {
    id: 'ayu-dark',
    name: 'Ayu Dark',
    colors: {
      background: '#0f1419',
      foreground: '#e6e1cf',
      cursor: '#f29718',
      cursorAccent: '#0f1419',
      selectionBackground: '#253340',
      black: '#191f26',
      red: '#ff3333',
      green: '#b8cc52',
      yellow: '#e7c547',
      blue: '#36a3d9',
      magenta: '#f07178',
      cyan: '#95e6cb',
      white: '#c7c7c7',
      brightBlack: '#686868',
      brightRed: '#f07178',
      brightGreen: '#cbe645',
      brightYellow: '#ffee99',
      brightBlue: '#59c2ff',
      brightMagenta: '#ffadb6',
      brightCyan: '#aaf2d8',
      brightWhite: '#ffffff',
    },
    ui: {
      bg: '#0f1419',
      bgSecondary: '#151a22',
      bgTertiary: '#1c232c',
      border: '#253340',
      text: '#e6e1cf',
      textMuted: '#5c6773',
      textDim: '#3a4450',
      accent: '#f29718',
      accentHover: '#ffa73d',
      accentMuted: '#3a2800',
      danger: '#ff3333',
      success: '#b8cc52',
      warning: '#e7c547',
      tabActive: '#0f1419',
      tabInactive: '#151a22',
      sidebar: '#0b0e14',
      titlebar: '#0b0e14',
      inputBg: '#0b0e14',
      inputBorder: '#253340',
      inputFocus: '#f29718',
      scrollbar: '#253340',
      scrollbarHover: '#3a4a5c',
      shadow: 'rgba(0,0,0,0.5)',
    },
  },

  {
    id: 'light',
    name: 'Light',
    isLight: true,
    colors: {
      background: '#ffffff',
      foreground: '#383a42',
      cursor: '#526fff',
      cursorAccent: '#ffffff',
      selectionBackground: '#d7d8dc',
      black: '#383a42',
      red: '#e45649',
      green: '#50a14f',
      yellow: '#c18401',
      blue: '#4078f2',
      magenta: '#a626a4',
      cyan: '#0184bc',
      white: '#a0a1a7',
      brightBlack: '#4f525e',
      brightRed: '#e06c75',
      brightGreen: '#98c379',
      brightYellow: '#e5c07b',
      brightBlue: '#61afef',
      brightMagenta: '#c678dd',
      brightCyan: '#56b6c2',
      brightWhite: '#ffffff',
    },
    ui: {
      bg: '#ffffff',
      bgSecondary: '#f5f5f5',
      bgTertiary: '#ececec',
      border: '#d4d4d4',
      text: '#383a42',
      textMuted: '#6b6e7a',
      textDim: '#a0a1a7',
      accent: '#526fff',
      accentHover: '#4060e0',
      accentMuted: '#e8ecff',
      danger: '#e45649',
      success: '#50a14f',
      warning: '#c18401',
      tabActive: '#ffffff',
      tabInactive: '#f5f5f5',
      sidebar: '#f8f8f8',
      titlebar: '#f8f8f8',
      inputBg: '#ffffff',
      inputBorder: '#d4d4d4',
      inputFocus: '#526fff',
      scrollbar: '#c4c4c4',
      scrollbarHover: '#a0a0a0',
      shadow: 'rgba(0,0,0,0.1)',
    },
  },

  // ── Extra Themes (with visual effects) ─────────────────────────────────────

  {
    id: 'windows98',
    name: 'Windows 98',
    category: 'extra',
    isLight: true,
    effects: {
      globalCss: `
        /* ── Win98 font: applies globally (including modals/settings) ── */
        .win98 * {
          font-family: 'W95FA', 'Tahoma', 'MS Sans Serif', 'Microsoft Sans Serif', sans-serif !important;
          font-size: 11px !important;
          font-weight: normal !important;
          -webkit-font-smoothing: none !important;
          font-smooth: never !important;
          text-rendering: optimizeSpeed !important;
          letter-spacing: 0 !important;
          border-radius: 0 !important;
        }

        /* Headings / labels that should be slightly bolder */
        .win98 [style*="font-weight: 600"],
        .win98 [style*="font-weight: 700"],
        .win98 [style*="fontWeight: 600"],
        .win98 [style*="fontWeight: 700"] {
          font-weight: bold !important;
          font-size: 11px !important;
        }

        /* Section headers / larger text — cap at 11px */
        .win98 [style*="font-size: 1"],
        .win98 [style*="fontSize: 1"] {
          font-size: 11px !important;
        }

        /* Win98 raised bevel on chrome buttons — skip anything inside [data-win98-exempt] */
        .win98 button:where(:not([data-win98-exempt] *)) {
          border-radius: 0 !important;
          box-shadow: inset -1px -1px 0 #808080, inset 1px 1px 0 #ffffff, inset -2px -2px 0 #404040, inset 2px 2px 0 #dfdfdf !important;
          border: none !important;
          background: #c0c0c0 !important;
          color: #000000 !important;
          font-family: 'Tahoma', 'MS Sans Serif', 'Microsoft Sans Serif', 'Arial', sans-serif !important;
          font-size: 11px !important;
          -webkit-font-smoothing: none !important;
        }
        .win98 button:where(:not([data-win98-exempt] *)):active,
        .win98 button:where(:not([data-win98-exempt] *)).win98-btn-active {
          box-shadow: inset 1px 1px 0 #808080, inset -1px -1px 0 #ffffff, inset 2px 2px 0 #404040, inset -2px -2px 0 #dfdfdf !important;
          background: #b8b8b8 !important;
        }
        /* Win98 select dropdown — skip modals/settings */
        .win98 select:where(:not([data-win98-exempt] *)) {
          border-radius: 0 !important;
          box-shadow: inset -1px -1px 0 #808080, inset 1px 1px 0 #ffffff, inset -2px -2px 0 #404040, inset 2px 2px 0 #dfdfdf !important;
          border: none !important;
          background: #c0c0c0 !important;
          color: #000000 !important;
        }
        /* Titlebar window-control buttons — flat, no bevel (handled by Win98Button component) */
        .win98-titlebar button {
          background: #c0c0c0 !important;
          box-shadow: inset -1px -1px 0 #808080, inset 1px 1px 0 #ffffff, inset -2px -2px 0 #404040, inset 2px 2px 0 #dfdfdf !important;
        }
        .win98-titlebar button:active {
          box-shadow: inset 1px 1px 0 #808080, inset -1px -1px 0 #ffffff, inset 2px 2px 0 #404040, inset -2px -2px 0 #dfdfdf !important;
        }
        .win98 input:where(:not([data-win98-exempt] *)) {
          box-shadow: inset 1px 1px 0 #808080, inset -1px -1px 0 #dfdfdf, inset 2px 2px 0 #404040, inset -2px -2px 0 #ffffff !important;
        }

        /* Active titlebar */
        .win98-titlebar {
          background: linear-gradient(to right, #000080, #1084d0) !important;
          color: #ffffff !important;
          font-family: 'Tahoma', 'MS Sans Serif', sans-serif !important;
          font-size: 11px !important;
          font-weight: bold !important;
          -webkit-font-smoothing: none !important;
        }

        /* Scrollbars */
        .win98 *::-webkit-scrollbar { width: 16px; height: 16px; }
        .win98 *::-webkit-scrollbar-track { background: #c0c0c0; }
        .win98 *::-webkit-scrollbar-thumb {
          background: #c0c0c0;
          box-shadow: inset -1px -1px 0 #808080, inset 1px 1px 0 #ffffff, inset -2px -2px 0 #404040, inset 2px 2px 0 #dfdfdf;
        }
        .win98 *::-webkit-scrollbar-button {
          background: #c0c0c0;
          box-shadow: inset -1px -1px 0 #808080, inset 1px 1px 0 #ffffff;
          display: block;
          height: 16px;
        }
        .win98 *::-webkit-scrollbar-corner { background: #c0c0c0; }

        /* Hard pixel shadow on modals/popups — skip form controls (they keep their bevel) */
        .win98 div[style*="box-shadow"], .win98 div[style*="boxShadow"] {
          box-shadow: 2px 2px 0 #000000 !important;
        }
      `,
    },
    colors: {
      background: '#000000',
      foreground: '#c0c0c0',
      cursor: '#ffffff',
      cursorAccent: '#000000',
      selectionBackground: '#000080',
      black: '#000000',
      red: '#800000',
      green: '#008000',
      yellow: '#808000',
      blue: '#000080',
      magenta: '#800080',
      cyan: '#008080',
      white: '#c0c0c0',
      brightBlack: '#808080',
      brightRed: '#ff0000',
      brightGreen: '#00ff00',
      brightYellow: '#ffff00',
      brightBlue: '#0000ff',
      brightMagenta: '#ff00ff',
      brightCyan: '#00ffff',
      brightWhite: '#ffffff',
    },
    ui: {
      bg: '#c0c0c0',
      bgSecondary: '#d4d0c8',
      bgTertiary: '#e4e0d8',
      border: '#808080',
      text: '#000000',
      textMuted: '#444444',
      textDim: '#808080',
      accent: '#000080',
      accentHover: '#1084d0',
      accentMuted: '#d0d8f0',
      danger: '#ff0000',
      success: '#008000',
      warning: '#808000',
      tabActive: '#c0c0c0',
      tabInactive: '#d4d0c8',
      sidebar: '#c0c0c0',
      titlebar: '#000080',
      inputBg: '#ffffff',
      inputBorder: '#808080',
      inputFocus: '#000080',
      scrollbar: '#c0c0c0',
      scrollbarHover: '#a0a0a0',
      shadow: '#000000',
    },
  },

  {
    id: 'fallout',
    name: 'Fallout',
    category: 'extra',
    effects: {
      scanlines: true,
      scanlineOpacity: 0.14,
      filmGrain: true,
      filmGrainOpacity: 0.14,
      vhsTearing: true,
      crtGlow: true,
      crtGlowColor: '#00ff41',
      crtGlowIntensity: 0.4,
      flicker: true,
      flickerIntensity: 0.04,
      postProcessFilter: 'sepia(1) saturate(5) hue-rotate(80deg) brightness(0.92)',
      globalCss: `
        .dos-font, .dos-font * {
          font-family: 'VT323', 'IBM 3270', 'Fallouty', 'Perfect DOS VGA 437', 'Courier New', monospace !important;
          font-size: 15px !important;
          line-height: 1.3 !important;
          -webkit-font-smoothing: none !important;
          font-smooth: never !important;
          letter-spacing: 0 !important;
        }
        .dos-font input, .dos-font button, .dos-font select, .dos-font textarea {
          font-family: 'VT323', 'IBM 3270', 'Fallouty', 'Perfect DOS VGA 437', 'Courier New', monospace !important;
          font-size: 15px !important;
        }
        .dos-font svg, .dos-font svg * {
          font-family: inherit !important;
          font-size: inherit !important;
        }
      `,
    },
    colors: {
      background: '#0a0e00',
      foreground: '#20c20e',
      cursor: '#39ff14',
      cursorAccent: '#0a0e00',
      selectionBackground: '#0e3008',
      black: '#0a0e00',
      red: '#176b0f',
      green: '#20c20e',
      yellow: '#39ff14',
      blue: '#17a00a',
      magenta: '#1a8c10',
      cyan: '#2ddd18',
      white: '#20c20e',
      brightBlack: '#0f1a03',
      brightRed: '#20c20e',
      brightGreen: '#39ff14',
      brightYellow: '#5bff3e',
      brightBlue: '#17a00a',
      brightMagenta: '#20c20e',
      brightCyan: '#39ff14',
      brightWhite: '#7fff6a',
    },
    ui: {
      bg: '#0a0e00',
      bgSecondary: '#0f1504',
      bgTertiary: '#141d06',
      border: '#1a3a10',
      text: '#20c20e',
      textMuted: '#178c10',
      textDim: '#0e5c08',
      accent: '#39ff14',
      accentHover: '#5bff3e',
      accentMuted: '#0e2208',
      danger: '#20c20e',
      success: '#39ff14',
      warning: '#20c20e',
      tabActive: '#0a0e00',
      tabInactive: '#0f1504',
      sidebar: '#070a00',
      titlebar: '#070a00',
      inputBg: '#0f1504',
      inputBorder: '#1a3a10',
      inputFocus: '#39ff14',
      scrollbar: '#1a3a10',
      scrollbarHover: '#1f5214',
      shadow: 'rgba(32,194,14,0.08)',
    },
  },
  {
    id: '2077',
    name: '2077',
    category: 'extra',
    effects: {
      scanlines: true,
      scanlineOpacity: 0.14,
      filmGrain: true,
      filmGrainOpacity: 0.14,
      vhsTearing: true,
      crtGlow: true,
      crtGlowColor: '#ff0000',
      crtGlowIntensity: 0.4,
      flicker: true,
      flickerIntensity: 0.04,
      globalCss: `
        .dos-font, .dos-font * {
          font-family: 'VT323', 'IBM 3270', 'Fallouty', 'Perfect DOS VGA 437', 'Courier New', monospace !important;
          font-size: 15px !important;
          line-height: 1.3 !important;
          -webkit-font-smoothing: none !important;
          font-smooth: never !important;
          letter-spacing: 0 !important;
        }
        .dos-font input, .dos-font button, .dos-font select, .dos-font textarea {
          font-family: 'VT323', 'IBM 3270', 'Fallouty', 'Perfect DOS VGA 437', 'Courier New', monospace !important;
          font-size: 15px !important;
        }
        .dos-font svg, .dos-font svg * {
          font-family: inherit !important;
          font-size: inherit !important;
        }
      `,
    },
    colors: {
      background: '#180000',
      foreground: '#ff3333',
      cursor: '#ff0000',
      cursorAccent: '#180000',
      selectionBackground: '#4a0000',
      black: '#250000',
      red: '#ff0000',
      green: '#ff5500',
      yellow: '#ff8800',
      blue: '#ffcc00',
      magenta: '#ff5500',
      cyan: '#ffaa00',
      white: '#ffaaaa',
      brightBlack: '#3f0000',
      brightRed: '#ff4444',
      brightGreen: '#ff6633',
      brightYellow: '#ffaa33',
      brightBlue: '#ffe066',
      brightMagenta: '#ff7744',
      brightCyan: '#ffcc44',
      brightWhite: '#ffcccc',
    },
    ui: {
      bg: '#180000',
      bgSecondary: '#220000',
      bgTertiary: '#2e0000',
      border: '#4a0000',
      text: '#ff3333',
      textMuted: '#aa1111',
      textDim: '#660000',
      accent: '#ffe600',
      accentHover: '#ffcc00',
      accentMuted: '#2a1a00',
      danger: '#ff0000',
      success: '#ff5500',
      warning: '#ff8800',
      tabActive: '#180000',
      tabInactive: '#220000',
      sidebar: '#180000',
      titlebar: '#180000',
      inputBg: '#220000',
      inputBorder: '#4a0000',
      inputFocus: '#ffe600',
      scrollbar: '#3f0000',
      scrollbarHover: '#660000',
      shadow: 'rgba(255,0,0,0.08)',
    },
  },
  {
    id: 'amber-crt',
    name: 'Amber CRT',
    category: 'extra',
    effects: {
      scanlines: true,
      scanlineOpacity: 0.10,
      filmGrain: true,
      filmGrainOpacity: 0.04,
      crtGlow: true,
      crtGlowColor: '#ffb000',
      crtGlowIntensity: 0.35,
      flicker: true,
      flickerIntensity: 0.02,
      postProcessFilter: 'sepia(1) saturate(3.5) hue-rotate(0deg) brightness(0.9)',
      globalCss: `
        .dos-font, .dos-font * {
          font-family: 'VT323', 'IBM 3270', 'Fallouty', 'Perfect DOS VGA 437', 'Courier New', monospace !important;
          font-size: 15px !important;
          line-height: 1.3 !important;
          -webkit-font-smoothing: none !important;
          font-smooth: never !important;
          letter-spacing: 0 !important;
        }
        .dos-font input, .dos-font button, .dos-font select, .dos-font textarea {
          font-family: 'VT323', 'IBM 3270', 'Fallouty', 'Perfect DOS VGA 437', 'Courier New', monospace !important;
          font-size: 15px !important;
        }
        .dos-font svg, .dos-font svg * {
          font-family: inherit !important;
          font-size: inherit !important;
        }
      `,
    },
    colors: {
      background: '#1a0e00',
      foreground: '#ffb000',
      cursor: '#ffb000',
      cursorAccent: '#1a0e00',
      selectionBackground: '#3d2800',
      black: '#1a0e00',
      red: '#ff8c00',
      green: '#ffb000',
      yellow: '#ffd044',
      blue: '#cc8800',
      magenta: '#ffb000',
      cyan: '#ffd044',
      white: '#ffb000',
      brightBlack: '#2a1a00',
      brightRed: '#ffa033',
      brightGreen: '#ffc233',
      brightYellow: '#ffe066',
      brightBlue: '#ffb000',
      brightMagenta: '#ffc233',
      brightCyan: '#ffe066',
      brightWhite: '#ffe8aa',
    },
    ui: {
      bg: '#1a0e00',
      bgSecondary: '#221400',
      bgTertiary: '#2c1c00',
      border: '#3d2800',
      text: '#ffb000',
      textMuted: '#cc8800',
      textDim: '#7a5200',
      accent: '#ffb000',
      accentHover: '#ffc233',
      accentMuted: '#2a1a00',
      danger: '#ff8c00',
      success: '#ffb000',
      warning: '#ffd044',
      tabActive: '#1a0e00',
      tabInactive: '#221400',
      sidebar: '#140a00',
      titlebar: '#140a00',
      inputBg: '#221400',
      inputBorder: '#3d2800',
      inputFocus: '#ffb000',
      scrollbar: '#3d2800',
      scrollbarHover: '#664400',
      shadow: 'rgba(255,176,0,0.08)',
    },
  },
  {
    id: 'commodore64',
    name: 'Commodore 64',
    category: 'extra',
    effects: {
      scanlines: true,
      scanlineOpacity: 0.10,
      filmGrain: true,
      filmGrainOpacity: 0.08,
      crtGlow: true,
      crtGlowColor: '#5555ff',
      crtGlowIntensity: 0.2,
      flicker: true,
      flickerIntensity: 0.025,
      postProcessFilter: 'sepia(1) saturate(3) hue-rotate(210deg) brightness(0.9) contrast(1.1)',
      globalCss: `
        .c64 * {
          font-family: 'Commodore 64', 'Courier New', monospace !important;
          font-size: 11px !important;
          line-height: 1.6 !important;
          letter-spacing: 0.5px !important;
          border-radius: 0 !important;
          image-rendering: pixelated !important;
          -webkit-font-smoothing: none !important;
          font-smooth: never !important;
        }

        /* Slightly larger for headings */
        .c64 [style*="font-weight: 600"],
        .c64 [style*="font-weight: 700"],
        .c64 [style*="fontWeight: 600"],
        .c64 [style*="fontWeight: 700"] {
          font-size: 11px !important;
          font-weight: normal !important;
        }

        /* Dithered desktop background pattern */
        .c64 {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='4' height='4'%3E%3Crect width='4' height='4' fill='%233b2b7e'/%3E%3Crect width='2' height='2' x='2' y='0' fill='%235544aa'/%3E%3Crect width='2' height='2' x='0' y='2' fill='%235544aa'/%3E%3C/svg%3E") !important;
        }

        /* Panel / window boxes — raised 1px pixel border */
        .c64 [style*="background"] {
          image-rendering: pixelated;
        }

        /* Chunky 2px pixel borders everywhere */
        .c64 button {
          border: 2px solid #a5a5ff !important;
          border-right-color: #2222aa !important;
          border-bottom-color: #2222aa !important;
          background: #5544aa !important;
          color: #ffffff !important;
          font-family: 'Commodore 64', monospace !important;
          font-size: 12px !important;
          padding: 4px 8px !important;
          border-radius: 0 !important;
          cursor: pointer !important;
          box-shadow: none !important;
          text-transform: uppercase !important;
        }
        .c64 button:active,
        .c64 button.c64-btn-active {
          border-color: #2222aa !important;
          border-right-color: #a5a5ff !important;
          border-bottom-color: #a5a5ff !important;
          background: #3b2b7e !important;
        }

        /* Input fields — sunken */
        .c64 input, .c64 select {
          border: 2px solid #2222aa !important;
          border-right-color: #a5a5ff !important;
          border-bottom-color: #a5a5ff !important;
          background: #3b2b7e !important;
          color: #a5a5ff !important;
          font-family: 'Commodore 64', monospace !important;
          font-size: 12px !important;
          border-radius: 0 !important;
          box-shadow: none !important;
        }
        .c64 input::placeholder { color: #5555aa !important; }
        .c64 input:focus {
          outline: none !important;
          border-color: #ffffff !important;
        }

        /* Scrollbars — chunky C64 style */
        .c64 *::-webkit-scrollbar { width: 12px; height: 12px; }
        .c64 *::-webkit-scrollbar-track { background: #3b2b7e; }
        .c64 *::-webkit-scrollbar-thumb {
          background: #5544aa;
          border: 2px solid #a5a5ff;
          border-right-color: #2222aa;
          border-bottom-color: #2222aa;
        }
        .c64 *::-webkit-scrollbar-corner { background: #3b2b7e; }

        /* Selection highlight */
        .c64 ::selection { background: #a5a5ff; color: #000033; }

        /* Hard pixel shadow — no blur/spread */
        .c64 div[style*="box-shadow"], .c64 div[style*="boxShadow"] {
          box-shadow: 2px 2px 0 #000033 !important;
        }
      `,
    },
    colors: {
      background: '#5555aa',
      foreground: '#d0d0ff',
      cursor: '#ffffff',
      cursorAccent: '#5555aa',
      selectionBackground: '#8888cc',
      black: '#3b2b7e',
      red: '#a5a5ff',
      green: '#d0d0ff',
      yellow: '#ffffff',
      blue: '#7777cc',
      magenta: '#a5a5ff',
      cyan: '#d0d0ff',
      white: '#d0d0ff',
      brightBlack: '#5555aa',
      brightRed: '#d0d0ff',
      brightGreen: '#ffffff',
      brightYellow: '#ffffff',
      brightBlue: '#a5a5ff',
      brightMagenta: '#d0d0ff',
      brightCyan: '#ffffff',
      brightWhite: '#ffffff',
    },
    ui: {
      bg: '#3b2b7e',
      bgSecondary: '#5544aa',
      bgTertiary: '#5544aa',
      border: '#a5a5ff',
      text: '#ffffff',
      textMuted: '#a5a5ff',
      textDim: '#a5a5ff',
      accent: '#ffffff',
      accentHover: '#a5a5ff',
      accentMuted: '#3b2b7e',
      danger: '#ffffff',
      success: '#ffffff',
      warning: '#a5a5ff',
      tabActive: '#5544aa',
      tabInactive: '#3b2b7e',
      sidebar: '#2a1e6e',
      titlebar: '#2a1e6e',
      inputBg: '#3b2b7e',
      inputBorder: '#a5a5ff',
      inputFocus: '#ffffff',
      scrollbar: '#5544aa',
      scrollbarHover: '#a5a5ff',
      shadow: '#000033',
    },
  },
]

export const defaultTheme = themes[0]

export function getThemeById(id: string): TerminalTheme {
  return themes.find(t => t.id === id) || defaultTheme
}

