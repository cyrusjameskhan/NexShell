import { useState, useEffect, useCallback, useRef } from 'react'
import { useStore } from '../../hooks'
import { createTab, setState, setActiveTab, getState } from '../../store'
import { LibraryTool } from '../../types'

// ── Brand icons ───────────────────────────────────────────────────────────────

const TOOL_ICONS: Record<string, React.ReactNode> = {
  git: (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.2819 10.8906L13.1094 1.71805C12.5348 1.14349 11.5964 1.14349 11.0213 1.71805L9.07873 3.66062L11.4712 6.05305C12.0814 5.85143 12.7676 5.99071 13.2427 6.46582C13.7207 6.94385 13.8578 7.63525 13.6503 8.24756L15.9556 10.5529C16.5679 10.3454 17.2592 10.4824 17.7373 10.9634C18.4077 11.6338 18.4077 12.7201 17.7373 13.3934C17.0669 14.0638 15.9806 14.0638 15.3073 13.3934C14.8057 12.8889 14.6745 12.1564 14.9112 11.5295L12.7481 9.36643L12.7451 15.3926C12.9019 15.4719 13.0498 15.5776 13.1797 15.7104C13.8501 16.3808 13.8501 17.4671 13.1797 18.1404C12.5093 18.8108 11.423 18.8108 10.7497 18.1404C10.0793 17.47 10.0793 16.3837 10.7497 15.7104C10.9066 15.5535 11.0868 15.4331 11.2788 15.3511V9.27247C11.0868 9.19042 10.9066 9.07002 10.7497 8.91309C10.2452 8.40857 10.1169 7.67014 10.3595 7.04126L7.99243 4.67419L1.71826 10.9483C1.14369 11.5229 1.14369 12.4613 1.71826 13.0364L10.8908 22.209C11.4654 22.7836 12.4038 22.7836 12.9788 22.209L22.2819 12.9059C22.8565 12.3313 22.8565 11.3652 22.2819 10.8906Z" fill="#F05033"/>
    </svg>
  ),
  gh: (
    <svg viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  ),
  node: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.998 24a2.37 2.37 0 0 1-1.189-.32L7.87 21.966c-.487-.271-.248-.367-.091-.422.637-.216.765-.265 1.443-.643.071-.041.164-.025.237.016l2.255 1.339c.082.044.198.044.277 0l8.794-5.076c.082-.047.136-.141.136-.238V7.056c0-.1-.054-.193-.137-.242l-8.793-5.07c-.082-.045-.199-.045-.277 0L2.921 6.814c-.085.049-.139.144-.139.242v10.15c0 .097.054.19.139.236l2.409 1.391c1.307.654 2.108-.116 2.108-.891V8.419c0-.142.114-.254.255-.254h1.115c.139 0 .255.112.255.254v9.523c0 1.745-.95 2.745-2.604 2.745-.508 0-.909 0-2.026-.551L1.677 18.89a2.378 2.378 0 0 1-1.185-2.059V6.681c0-.848.448-1.634 1.185-2.06L10.47.315a2.464 2.464 0 0 1 2.376 0l8.793 5.306a2.378 2.378 0 0 1 1.188 2.06v10.15a2.377 2.377 0 0 1-1.188 2.059l-8.793 5.306a2.374 2.374 0 0 1-1.188.804z" fill="#539E43"/>
    </svg>
  ),
  python: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.914 0C5.82 0 6.2 2.656 6.2 2.656l.007 2.752h5.814v.826H3.887S0 5.789 0 11.969c0 6.18 3.403 5.963 3.403 5.963h2.031v-2.867s-.109-3.402 3.35-3.402h5.769s3.24.052 3.24-3.133V3.195S18.28 0 11.914 0zm-3.21 1.848a1.044 1.044 0 1 1 0 2.088 1.043 1.043 0 0 1 0-2.088z" fill="#366A96"/>
      <path d="M12.086 24c6.094 0 5.714-2.656 5.714-2.656l-.007-2.752H12v-.826h8.133S24 18.211 24 12.031c0-6.18-3.403-5.963-3.403-5.963h-2.031v2.867s.109 3.402-3.35 3.402H9.447s-3.24-.052-3.24 3.133v5.265S5.72 24 12.086 24zm3.21-1.848a1.044 1.044 0 1 1 0-2.088 1.043 1.043 0 0 1 0 2.088z" fill="#FFC331"/>
    </svg>
  ),
  go: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.811 10.231c-.047 0-.058-.023-.035-.059l.246-.315c.023-.035.081-.058.128-.058h4.172c.046 0 .058.035.035.07l-.199.303c-.023.036-.082.07-.117.07zM.047 11.306c-.047 0-.059-.023-.035-.058l.245-.316c.023-.035.082-.058.129-.058h5.328c.047 0 .07.035.058.07l-.093.28c-.012.047-.058.07-.105.07zm2.828 1.075c-.047 0-.059-.035-.035-.07l.163-.292c.023-.035.07-.07.117-.07h2.337c.047 0 .07.035.07.082l-.023.28c0 .047-.047.082-.082.082zm12.129-2.36c-.736.187-1.239.327-1.963.514-.176.046-.187.058-.34-.117-.174-.199-.303-.327-.548-.444-.737-.362-1.45-.257-2.115.175-.795.514-1.204 1.274-1.192 2.22.011.935.654 1.706 1.577 1.835.795.105 1.46-.175 1.987-.77.105-.13.198-.27.315-.434H10.47c-.245 0-.304-.152-.222-.35.152-.362.432-.968.596-1.274a.315.315 0 0 1 .292-.187h4.253c-.023.316-.023.631-.07.947a4.983 4.983 0 0 1-.958 2.29c-.841 1.11-1.94 1.8-3.33 1.986-1.145.152-2.209-.07-3.143-.77-.865-.655-1.356-1.52-1.484-2.595-.152-1.274.222-2.419.993-3.424.83-1.086 1.928-1.776 3.272-2.02 1.098-.2 2.15-.07 3.096.571.62.41 1.063.97 1.356 1.648.07.105.023.164-.117.2zm3.868 6.461c-1.064-.024-2.034-.328-2.852-1.029a3.665 3.665 0 0 1-1.262-2.255c-.21-1.32.152-2.489.947-3.529.853-1.122 1.881-1.706 3.272-1.95 1.192-.21 2.314-.095 3.33.595.923.63 1.496 1.484 1.648 2.605.198 1.578-.257 2.863-1.344 3.962-.771.783-1.718 1.273-2.805 1.483a4.987 4.987 0 0 1-.934.118zm2.78-4.72c-.011-.153-.011-.27-.034-.387-.21-1.157-1.274-1.81-2.384-1.554-1.087.245-1.788 1.052-1.894 2.15-.093.968.595 1.951 1.554 2.163.703.152 1.333-.023 1.87-.513.703-.63.97-1.426.888-1.859z" fill="#00ACD7"/>
    </svg>
  ),
  rust: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.834 11.703l-1.027-.634a13.468 13.468 0 0 0-.028-.29l.882-.782a.235.235 0 0 0-.108-.396l-1.188-.278a12.552 12.552 0 0 0-.084-.282l.72-.911a.235.235 0 0 0-.196-.373l-1.217.057a12.51 12.51 0 0 0-.138-.257l.54-1.017a.235.235 0 0 0-.279-.326l-1.193.387a12.485 12.485 0 0 0-.186-.22l.34-1.09a.235.235 0 0 0-.35-.256l-1.12.696a12.57 12.57 0 0 0-.228-.174l.124-1.12a.235.235 0 0 0-.408-.183l-1.006.974a12.64 12.64 0 0 0-.263-.12l-.09-1.127a.235.235 0 0 0-.451-.1l-.872 1.21a12.698 12.698 0 0 0-.288-.06l-.298-1.098a.235.235 0 0 0-.463-.008l-.72 1.356a13.39 13.39 0 0 0-.299-.007l-.505-1.038a.235.235 0 0 0-.456.075l-.557 1.459a12.91 12.91 0 0 0-.289.047l-.703-.946a.235.235 0 0 0-.43.143l-.383 1.499a13.245 13.245 0 0 0-.268.09l-.885-.832a.235.235 0 0 0-.39.208l-.2 1.503a14.39 14.39 0 0 0-.243.133l-1.049-.704a.235.235 0 0 0-.338.27l-.004 1.476a12.88 12.88 0 0 0-.213.172l-1.188-.566a.235.235 0 0 0-.28.336l.196 1.42c-.063.066-.123.134-.183.202l-1.3-.418a.235.235 0 0 0-.213.4l.388 1.337c-.05.076-.099.153-.146.23l-1.386-.264a.235.235 0 0 0-.14.455l.568 1.234a12.5 12.5 0 0 0-.105.253l-1.44-.106a.235.235 0 0 0-.063.466l.737 1.111a12.55 12.55 0 0 0-.064.268l-1.463.052a.235.235 0 0 0 .016.47l.894.977a13.11 13.11 0 0 0-.022.276l-1.457.21a.235.235 0 0 0 .094.461l1.032.834c0 .09.005.18.009.27l-1.42.362a.235.235 0 0 0 .17.44l1.15.687c.017.088.035.176.054.262l-1.35.512a.235.235 0 0 0 .243.414l1.24.53c.027.085.056.17.086.253l-1.253.654a.235.235 0 0 0 .311.38l1.304.368c.038.082.078.162.119.242l-1.13.79a.235.235 0 0 0 .373.344l1.34.204c.05.077.1.154.153.23l-.986.915a.235.235 0 0 0 .425.3l1.347.038c.06.073.122.146.185.217l-.82 1.029a.235.235 0 0 0 .472.247l1.321-.128c.072.068.146.134.22.2l-.636 1.127a.235.235 0 0 0 .51.188l1.263-.29c.082.061.165.12.25.178l-.44 1.203a.235.235 0 0 0 .536.125l1.176-.444c.09.053.18.105.272.155l-.237 1.255a.235.235 0 0 0 .554.059l1.063-.585c.097.044.196.087.295.129l-.031 1.277a.235.235 0 0 0 .467-.007l.929-.714c.101.034.204.067.307.098l.173 1.27a.235.235 0 0 0 .47-.073l.783-.832a13.2 13.2 0 0 0 .315.064l.373 1.232a.235.235 0 0 0 .456-.138l.626-.933c.108.01.216.02.324.027l.566 1.167a.235.235 0 0 0 .433-.197l.46-1.02c.107.001.215 0 .322-.003l.751 1.075a.235.235 0 0 0 .404-.237l.285-1.089c.105-.01.21-.022.314-.036l.924.965a.235.235 0 0 0 .373-.293l.1-1.13c.101-.019.202-.04.302-.062l1.09.832a.235.235 0 0 0 .34-.345l-.088-1.142c.097-.027.193-.056.289-.086l1.236.68a.235.235 0 0 0 .3-.385l-.273-1.117c.092-.035.183-.072.273-.11l1.355.51a.235.235 0 0 0 .255-.42l-.45-1.064c.085-.041.169-.084.252-.128l1.447.325a.235.235 0 0 0 .203-.449l-.617-.988c.076-.047.151-.096.225-.146l1.508.13a.235.235 0 0 0 .144-.466l-.772-.9c.067-.053.133-.108.198-.163l1.538-.07a.235.235 0 0 0 .082-.458l-.913-.806c.057-.058.113-.118.168-.178l1.535-.268a.235.235 0 0 0 .018-.468l-1.038-.708c.046-.064.09-.129.134-.194l1.5-.463a.235.235 0 0 0-.047-.464l-1.148-.603c.034-.069.067-.138.099-.207l1.43-.653a.235.235 0 0 0-.11-.456l-1.24-.494c.022-.073.043-.147.063-.222l1.33-.833a.235.235 0 0 0-.172-.44l-1.316-.38a14.47 14.47 0 0 0 .025-.234l1.198-1.002a.235.235 0 0 0-.23-.418zM12 17.953a5.953 5.953 0 1 1 0-11.906 5.953 5.953 0 0 1 0 11.906zm0-10.82a4.867 4.867 0 1 0 0 9.735 4.867 4.867 0 0 0 0-9.735zm3.292 8.03H8.715v-1.14h2.217V9.82H9.1V8.681h2.908v5.202h1.284zm-2.13-6.34a.869.869 0 1 1 0 1.738.869.869 0 0 1 0-1.738z" fill="#DEA584"/>
    </svg>
  ),
  java: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.851 18.56s-.917.534.653.714c1.902.218 2.874.187 4.969-.211 0 0 .552.346 1.321.646-4.699 2.013-10.633-.118-6.943-1.149M8.276 15.933s-1.028.761.542.924c2.032.209 3.636.227 6.413-.308 0 0 .384.389.987.602-5.679 1.661-12.007.13-7.942-1.218M13.116 11.475c1.158 1.333-.304 2.533-.304 2.533s2.939-1.518 1.589-3.418c-1.261-1.772-2.228-2.652 3.007-5.688 0-.001-8.216 2.051-4.292 6.573M19.33 20.504s.679.559-.747.991c-2.712.822-11.288 1.069-13.669.033-.856-.373.75-.89 1.254-.998.527-.114.828-.093.828-.093-.953-.671-6.156 1.317-2.643 1.887 9.58 1.553 17.462-.7 14.977-1.82M9.292 13.21s-4.362 1.036-1.544 1.412c1.189.159 3.561.123 5.77-.062 1.806-.152 3.618-.477 3.618-.477s-.637.272-1.098.587c-4.429 1.165-12.986.623-10.522-.568 2.082-1.006 3.776-.892 3.776-.892M17.116 17.584c4.503-2.34 2.421-4.589.968-4.285-.355.074-.515.138-.515.138s.132-.207.385-.297c2.875-1.011 5.086 2.981-.928 4.562 0-.001.07-.062.09-.118M14.401 0s2.494 2.494-2.365 6.33c-3.896 3.077-.888 4.832-.001 6.836-2.274-2.053-3.943-3.858-2.824-5.539 1.644-2.469 6.197-3.665 5.19-7.627M9.734 23.924c4.322.277 10.959-.153 11.116-2.198 0 0-.302.775-3.572 1.391-3.688.694-8.239.613-10.937.168 0-.001.553.457 3.393.639" fill="#5382A1"/>
    </svg>
  ),
  pnpm: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M0 0v7.5h7.5V0zm8.25 0v7.5h7.498V0zm8.25 0v7.5H24V0zM8.25 8.25v7.5h7.498v-7.5zm8.25 0v7.5H24v-7.5zM0 16.5V24h7.5v-7.5zm8.25 0V24h7.498v-7.5zm8.25 0V24H24v-7.5z" fill="#F69220"/>
    </svg>
  ),
  bun: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 22C6.477 22 2 17.523 2 12S6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" fill="#FBF0DF"/>
      <path d="M12 20.5c-4.687 0-8.5-3.813-8.5-8.5S7.313 3.5 12 3.5s8.5 3.813 8.5 8.5-3.813 8.5-8.5 8.5z" fill="#F6DECE"/>
      <ellipse cx="8.547" cy="14.037" rx="1.582" ry="1.008" fill="#CCBEA7"/>
      <ellipse cx="15.453" cy="14.037" rx="1.582" ry="1.008" fill="#CCBEA7"/>
      <path d="M7.5 10.5c0-.828.448-1.5 1-1.5s1 .672 1 1.5S9.052 12 8.5 12s-1-.672-1-1.5zM14.5 10.5c0-.828.448-1.5 1-1.5s1 .672 1 1.5-.448 1.5-1 1.5-1-.672-1-1.5z" fill="#282828"/>
      <path d="M10 13.5c0 1.105.895 2 2 2s2-.895 2-2H10z" fill="#B35A1F"/>
    </svg>
  ),
  yarn: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.372 0 0 5.372 0 12s5.372 12 12 12 12-5.372 12-12S18.628 0 12 0zm5.812 17.208c-.243.265-.617.28-.882.124-.861-.51-1.67-1.086-2.464-1.682-.513.606-1.066 1.18-1.664 1.715-.45.4-1.084.318-1.427-.045a.964.964 0 0 1-.12-.162c-.48.22-.995.378-1.55.441-1.016.113-1.824-.246-2.367-1.025-.534-.77-.671-1.738-.468-2.65a3.924 3.924 0 0 1 .077-.264c-.387-.394-.616-.94-.556-1.533.136-1.338 1.27-2.143 2.464-2.295.14-.017.28-.025.42-.023.234-.448.538-.86.895-1.22.5-.502 1.097-.78 1.742-.837.28-.025.567.003.847.081.424-.432.98-.664 1.568-.664.566 0 1.104.213 1.52.586.447-.177.941-.23 1.43-.138.906.17 1.556.82 1.81 1.678.065.222.1.454.1.692 0 .303-.054.596-.155.873.22.294.388.622.49.975.27.942.03 1.946-.585 2.713-.27.335-.59.622-.942.856.047.114.088.23.12.35.18.65.053 1.324-.343 1.784z" fill="#2188B6"/>
    </svg>
  ),
  curl: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.374 0 0 5.373 0 12s5.374 12 12 12c6.627 0 12-5.373 12-12S18.627 0 12 0zm.75 18.5h-1.5v-1.5h1.5v1.5zm3.396-6.838c-.24.332-.575.603-1.003.808-.282.135-.47.283-.565.443-.095.16-.143.383-.143.669H13v-.25c0-.423.073-.773.218-1.05.145-.278.4-.526.766-.743.28-.165.482-.34.606-.527.123-.186.185-.4.185-.642 0-.283-.085-.511-.255-.684-.17-.172-.4-.258-.69-.258-.254 0-.47.06-.648.18-.178.12-.3.3-.368.537l-1.388-.174c.13-.55.4-.967.811-1.25.41-.283.93-.424 1.556-.424.68 0 1.214.18 1.601.54.387.36.58.84.58 1.44 0 .33-.054.62-.163.87zm-5.773-.524c.282-.165.482-.34.605-.527.124-.186.186-.4.186-.642 0-.283-.085-.511-.255-.684-.17-.172-.4-.258-.69-.258-.254 0-.47.06-.648.18-.178.12-.3.3-.368.537L7.816 9.57c.13-.55.4-.967.81-1.25.41-.283.93-.424 1.556-.424.68 0 1.215.18 1.602.54.386.36.58.84.58 1.44 0 .33-.055.62-.163.87-.108.25-.296.484-.566.702l-.497.39c-.213.168-.362.33-.446.49H12v1.274H9.64c.007-.416.08-.765.222-1.047.14-.282.393-.53.758-.747l.497-.39c.218-.172.386-.343.504-.506l.003-.004z" fill="#073551"/>
    </svg>
  ),
  jq: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
      <rect width="24" height="24" rx="4" fill="#1a1a2e"/>
      <text x="3" y="17" fontSize="13" fontWeight="bold" fontFamily="monospace" fill="#7BC8F6">jq</text>
    </svg>
  ),
  rg: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
      <rect width="24" height="24" rx="4" fill="#1a1a2e"/>
      <text x="2" y="17" fontSize="11" fontWeight="bold" fontFamily="monospace" fill="#FF7C7C">rg</text>
    </svg>
  ),
  fzf: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
      <rect width="24" height="24" rx="4" fill="#1a1a2e"/>
      <text x="2" y="17" fontSize="11" fontWeight="bold" fontFamily="monospace" fill="#AAFFAA">fzf</text>
    </svg>
  ),
  docker: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.186.186 0 0 0-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 0 0-.75.748 11.376 11.376 0 0 0 .692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 0 0 3.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z" fill="#2396ED"/>
    </svg>
  ),
  kubectl: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.204 14.35l.007.01-.999 2.413a5.171 5.171 0 0 1-2.075-2.597l2.578-.437.004.005a.44.44 0 0 1 .484.606zm-.833-2.129a.44.44 0 0 0 .173-.756l.002-.011L7.585 9.7a5.143 5.143 0 0 0-.73 3.255l2.516-.734zm1.145-1.98a.44.44 0 0 0 .699-.337l.01-.005.15-2.62a5.144 5.144 0 0 0-3.01 1.442l2.15 1.52zm1.76-.238a.44.44 0 0 0 .699.337l.011.005 2.15-1.52a5.145 5.145 0 0 0-3.01-1.443l.15 2.62zm1.144 2.218a.44.44 0 0 0 .174.756l.002.011 2.516.734a5.14 5.14 0 0 0-.73-3.255l-1.962 1.754zm.173 2.246l.003-.005 2.579.437a5.17 5.17 0 0 1-2.076 2.597l-.999-2.413.007-.01a.44.44 0 0 0 .486-.606zM12 16.907a.44.44 0 0 0-.438.369h-.018l-.33 2.583a5.145 5.145 0 0 0 1.572 0l-.33-2.583h-.018A.44.44 0 0 0 12 16.907z" fill="#326CE5"/>
      <path d="M12 5.5a6.5 6.5 0 1 0 0 13A6.5 6.5 0 0 0 12 5.5zm0 12.25a5.75 5.75 0 1 1 0-11.5 5.75 5.75 0 0 1 0 11.5z" fill="#326CE5"/>
      <circle cx="12" cy="12" r="2" fill="#326CE5"/>
    </svg>
  ),
  terraform: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.31 4.28L9.37 7.79v7.02l5.94 3.43V11.3l-5.94-3.43" fill="#5C4EE5"/>
      <path d="M15.99 4.28v7.02l5.94-3.43V0.86l-5.94 3.42z" fill="#4040B2"/>
      <path d="M2.07 7.02L8 10.45v7.02L2.07 14.04V7.02z" fill="#5C4EE5"/>
      <path d="M8.69 18.18l5.94-3.43v-7.02L8.69 11.16v7.02z" fill="#4040B2"/>
    </svg>
  ),
  redis: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M10.4 9.94l3.18 1.15-3.18 1.15-3.18-1.15zM21.6 7.2c0 1.16-2.64 2.1-5.9 2.1S9.8 8.36 9.8 7.2s2.64-2.1 5.9-2.1 5.9.94 5.9 2.1z" fill="#D82C20"/>
      <path d="M21.6 7.2v3.5c0 1.16-2.64 2.1-5.9 2.1s-5.9-.94-5.9-2.1V7.2" fill="none" stroke="#D82C20" strokeWidth="1.2"/>
      <path d="M21.6 10.7v3.5c0 1.16-2.64 2.1-5.9 2.1s-5.9-.94-5.9-2.1v-3.5" fill="none" stroke="#D82C20" strokeWidth="1.2"/>
      <path d="M10.4 9.94C7.52 9.7 5.2 8.8 5.2 7.7c0-1.16 2.64-2.1 5.9-2.1.6 0 1.18.03 1.72.1" fill="none" stroke="#D82C20" strokeWidth="1"/>
      <ellipse cx="8.2" cy="15.8" rx="5.9" ry="2.1" fill="#D82C20"/>
      <path d="M2.3 15.8v3.5c0 1.16 2.64 2.1 5.9 2.1s5.9-.94 5.9-2.1v-3.5" fill="none" stroke="#D82C20" strokeWidth="1.2"/>
    </svg>
  ),
  nomad: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L3 7v10l9 5 9-5V7z" fill="#00CA8E" opacity="0.15"/>
      <path d="M12 2L3 7l9 5 9-5z" fill="#00CA8E" opacity="0.4"/>
      <path d="M3 7v10l9 5V12z" fill="#00CA8E" opacity="0.7"/>
      <path d="M21 7v10l-9 5V12z" fill="#00CA8E"/>
      <path d="M12 2L3 7l9 5 9-5z" fill="none" stroke="#00CA8E" strokeWidth="0.5"/>
    </svg>
  ),
  ray: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
      <circle cx="12" cy="12" r="3" fill="#00AAFF"/>
      <line x1="12" y1="2" x2="12" y2="6" stroke="#00AAFF" strokeWidth="2" strokeLinecap="round"/>
      <line x1="12" y1="18" x2="12" y2="22" stroke="#00AAFF" strokeWidth="2" strokeLinecap="round"/>
      <line x1="2" y1="12" x2="6" y2="12" stroke="#00AAFF" strokeWidth="2" strokeLinecap="round"/>
      <line x1="18" y1="12" x2="22" y2="12" stroke="#00AAFF" strokeWidth="2" strokeLinecap="round"/>
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" stroke="#00AAFF" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" stroke="#00AAFF" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="19.07" y1="4.93" x2="16.24" y2="7.76" stroke="#00AAFF" strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="7.76" y1="16.24" x2="4.93" y2="19.07" stroke="#00AAFF" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  nmap: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
      <rect width="24" height="24" rx="4" fill="#0E2A47"/>
      <path d="M4 18 L12 5 L20 18" stroke="#4CA8E0" strokeWidth="2" strokeLinejoin="round" fill="none"/>
      <path d="M7 14 L12 5 L17 14" stroke="#7ECEF4" strokeWidth="1.2" strokeLinejoin="round" fill="none" opacity="0.7"/>
      <circle cx="12" cy="5" r="1.5" fill="#4CA8E0"/>
    </svg>
  ),
  wireshark: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
      <rect width="24" height="24" rx="4" fill="#1679A7"/>
      <path d="M4 12 Q6 7 8 12 Q10 17 12 12 Q14 7 16 12 Q18 17 20 12" stroke="#A8DCEE" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      <path d="M4 16 Q6 13 8 16 Q10 19 12 16 Q14 13 16 16 Q18 19 20 16" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.5"/>
    </svg>
  ),
  netcat: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
      <rect width="24" height="24" rx="4" fill="#1a1a2e"/>
      <text x="3" y="17" fontSize="11" fontWeight="bold" fontFamily="monospace" fill="#66BB6A">nc</text>
    </svg>
  ),
  mtr: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
      <rect width="24" height="24" rx="4" fill="#1a1a2e"/>
      <circle cx="5" cy="12" r="1.5" fill="#FF7043"/>
      <circle cx="10" cy="8" r="1.5" fill="#FF7043" opacity="0.8"/>
      <circle cx="15" cy="12" r="1.5" fill="#FF7043" opacity="0.6"/>
      <circle cx="19" cy="9" r="1.5" fill="#FF7043" opacity="0.4"/>
      <path d="M5 12 L10 8 L15 12 L19 9" stroke="#FF7043" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.6"/>
    </svg>
  ),
  openssl: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
      <rect width="24" height="24" rx="4" fill="#721817"/>
      <rect x="8" y="11" width="8" height="7" rx="1" fill="#E53935" opacity="0.9"/>
      <path d="M9 11 V8 A3 3 0 0 1 15 8 V11" stroke="#FFCDD2" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
      <circle cx="12" cy="14.5" r="1.2" fill="#FFCDD2"/>
    </svg>
  ),
  cloudflared: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M16.5 11.5a4 4 0 0 0-7.7-1.5H8a3 3 0 0 0 0 6h8.5a2.5 2.5 0 0 0 0-5H16.5z" fill="#F6821F"/>
      <path d="M16.5 14.5H8a1 1 0 0 1 0-2h8.5a.5.5 0 0 1 0 1H16a1 1 0 0 0 0 2h.5a.5.5 0 0 0 0-1z" fill="#FBAD41" opacity="0.6"/>
    </svg>
  ),
  tailscale: (
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none">
      <circle cx="5"  cy="5"  r="2" fill="#242424"/>
      <circle cx="12" cy="5"  r="2" fill="#242424"/>
      <circle cx="19" cy="5"  r="2" fill="#242424"/>
      <circle cx="5"  cy="12" r="2" fill="#242424"/>
      <circle cx="12" cy="12" r="2.8" fill="#4B9EFF"/>
      <circle cx="19" cy="12" r="2" fill="#242424"/>
      <circle cx="5"  cy="19" r="2" fill="#242424"/>
      <circle cx="12" cy="19" r="2" fill="#242424"/>
      <circle cx="19" cy="19" r="2" fill="#242424"/>
    </svg>
  ),
}

// ── Tool catalogue ────────────────────────────────────────────────────────────

const TOOLS: LibraryTool[] = [
  // Version Control
  {
    id: 'git', name: 'Git', category: 'Version Control',
    description: 'Distributed version control system',
    checkCmd: 'git --version',
    installCmds: { win: 'winget install --id Git.Git -e', mac: 'brew install git', linux: 'sudo apt-get install -y git' },
    homepage: 'https://git-scm.com',
  },
  {
    id: 'gh', name: 'GitHub CLI', category: 'Version Control',
    description: 'Official CLI for GitHub',
    checkCmd: 'gh --version',
    installCmds: { win: 'winget install --id GitHub.cli -e', mac: 'brew install gh', linux: 'sudo apt-get install -y gh' },
    homepage: 'https://cli.github.com',
  },
  // Runtimes
  {
    id: 'node', name: 'Node.js', category: 'Runtimes',
    description: 'JavaScript runtime built on V8',
    checkCmd: 'node --version',
    installCmds: { win: 'winget install --id OpenJS.NodeJS -e', mac: 'brew install node', linux: 'sudo apt-get install -y nodejs' },
    homepage: 'https://nodejs.org',
  },
  {
    id: 'python', name: 'Python', category: 'Runtimes',
    description: 'General-purpose scripting language',
    checkCmd: 'python --version',
    installCmds: { win: 'winget install --id Python.Python.3 -e', mac: 'brew install python', linux: 'sudo apt-get install -y python3' },
    homepage: 'https://python.org',
  },
  {
    id: 'go', name: 'Go', category: 'Runtimes',
    description: 'Fast, statically-typed compiled language',
    checkCmd: 'go version',
    installCmds: { win: 'winget install --id GoLang.Go -e', mac: 'brew install go', linux: 'sudo apt-get install -y golang' },
    homepage: 'https://go.dev',
  },
  {
    id: 'rust', name: 'Rust (rustup)', category: 'Runtimes',
    description: 'Systems language focused on safety & speed',
    checkCmd: 'rustc --version',
    installCmds: {
      win: 'winget install --id Rustlang.Rustup -e',
      mac: 'curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y',
      linux: 'curl --proto \'=https\' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y',
    },
    homepage: 'https://rustup.rs',
  },
  {
    id: 'java', name: 'Java (JDK)', category: 'Runtimes',
    description: 'Java development kit — OpenJDK 21 LTS',
    checkCmd: 'java -version',
    installCmds: { win: 'winget install --id Microsoft.OpenJDK.21 -e', mac: 'brew install openjdk@21', linux: 'sudo apt-get install -y openjdk-21-jdk' },
    homepage: 'https://openjdk.org',
  },
  // Package Managers
  {
    id: 'pnpm', name: 'pnpm', category: 'Package Managers',
    description: 'Fast, disk-efficient Node package manager',
    checkCmd: 'pnpm --version',
    installCmds: { win: 'npm install -g pnpm', mac: 'npm install -g pnpm', linux: 'npm install -g pnpm' },
    homepage: 'https://pnpm.io',
  },
  {
    id: 'bun', name: 'Bun', category: 'Package Managers',
    description: 'All-in-one JS runtime, bundler & package manager',
    checkCmd: 'bun --version',
    installCmds: {
      win: 'powershell -c "irm bun.sh/install.ps1 | iex"',
      mac: 'curl -fsSL https://bun.sh/install | bash',
      linux: 'curl -fsSL https://bun.sh/install | bash',
    },
    homepage: 'https://bun.sh',
  },
  {
    id: 'yarn', name: 'Yarn', category: 'Package Managers',
    description: 'Reliable JavaScript package manager',
    checkCmd: 'yarn --version',
    installCmds: { win: 'npm install -g yarn', mac: 'npm install -g yarn', linux: 'npm install -g yarn' },
    homepage: 'https://yarnpkg.com',
  },
  // CLI Tools
  {
    id: 'curl', name: 'curl', category: 'CLI Tools',
    description: 'Transfer data with URLs from the command line',
    checkCmd: 'curl --version',
    installCmds: { win: 'winget install --id curl.curl -e', mac: 'brew install curl', linux: 'sudo apt-get install -y curl' },
    homepage: 'https://curl.se',
  },
  {
    id: 'jq', name: 'jq', category: 'CLI Tools',
    description: 'Lightweight JSON processor',
    checkCmd: 'jq --version',
    installCmds: { win: 'winget install --id stedolan.jq -e', mac: 'brew install jq', linux: 'sudo apt-get install -y jq' },
    homepage: 'https://jqlang.github.io/jq',
  },
  {
    id: 'rg', name: 'ripgrep', category: 'CLI Tools',
    description: 'Blazing-fast recursive search tool',
    checkCmd: 'rg --version',
    installCmds: { win: 'winget install --id BurntSushi.ripgrep.MSVC -e', mac: 'brew install ripgrep', linux: 'sudo apt-get install -y ripgrep' },
    homepage: 'https://github.com/BurntSushi/ripgrep',
  },
  {
    id: 'fzf', name: 'fzf', category: 'CLI Tools',
    description: 'General-purpose command-line fuzzy finder',
    checkCmd: 'fzf --version',
    installCmds: { win: 'winget install --id junegunn.fzf -e', mac: 'brew install fzf', linux: 'sudo apt-get install -y fzf' },
    homepage: 'https://github.com/junegunn/fzf',
  },
  // DevOps
  {
    id: 'docker', name: 'Docker', category: 'DevOps',
    description: 'Build, ship and run containers',
    checkCmd: 'docker --version',
    installCmds: {
      win: 'winget install --id Docker.DockerDesktop -e',
      mac: 'brew install --cask docker',
      linux: 'curl -fsSL https://get.docker.com | sh',
    },
    homepage: 'https://docker.com',
  },
  {
    id: 'kubectl', name: 'kubectl', category: 'DevOps',
    description: 'Kubernetes command-line tool',
    checkCmd: 'kubectl version --client',
    installCmds: { win: 'winget install --id Kubernetes.kubectl -e', mac: 'brew install kubectl', linux: 'sudo apt-get install -y kubectl' },
    homepage: 'https://kubernetes.io/docs/tasks/tools',
  },
  {
    id: 'terraform', name: 'Terraform', category: 'DevOps',
    description: 'Infrastructure as code tool by HashiCorp',
    checkCmd: 'terraform version',
    installCmds: { win: 'winget install --id Hashicorp.Terraform -e', mac: 'brew install terraform', linux: 'sudo apt-get install -y terraform' },
    homepage: 'https://terraform.io',
  },
  {
    id: 'redis', name: 'Redis', category: 'DevOps',
    description: 'In-memory data store, cache and message broker',
    checkCmd: 'redis-cli --version',
    installCmds: { win: 'winget install --id Redis.Redis -e', mac: 'brew install redis', linux: 'sudo apt-get install -y redis' },
    homepage: 'https://redis.io',
  },
  {
    id: 'nomad', name: 'Nomad', category: 'DevOps',
    description: 'Flexible workload orchestrator by HashiCorp',
    checkCmd: 'nomad version',
    installCmds: { win: 'winget install --id Hashicorp.Nomad -e', mac: 'brew install nomad', linux: 'sudo apt-get install -y nomad' },
    homepage: 'https://nomadproject.io',
  },
  {
    id: 'ray', name: 'Ray', category: 'DevOps',
    description: 'Distributed computing framework for ML & Python',
    checkCmd: 'ray --version',
    installCmds: { win: 'pip install ray', mac: 'pip install ray', linux: 'pip install ray' },
    homepage: 'https://ray.io',
  },
  // Networking
  {
    id: 'nmap', name: 'Nmap', category: 'Networking',
    description: 'Network discovery and security auditing',
    checkCmd: 'nmap --version',
    installCmds: { win: 'winget install --id Insecure.Nmap -e', mac: 'brew install nmap', linux: 'sudo apt-get install -y nmap' },
    homepage: 'https://nmap.org',
  },
  {
    id: 'wireshark', name: 'Wireshark', category: 'Networking',
    description: 'Network protocol analyzer and packet capture',
    checkCmd: 'wireshark --version',
    installCmds: { win: 'winget install --id WiresharkFoundation.Wireshark -e', mac: 'brew install --cask wireshark', linux: 'sudo apt-get install -y wireshark' },
    homepage: 'https://wireshark.org',
  },
  {
    id: 'netcat', name: 'Netcat', category: 'Networking',
    description: 'Read and write data across network connections',
    checkCmd: 'nc -h',
    installCmds: { win: 'winget install --id SecAware.Netcat -e', mac: 'brew install netcat', linux: 'sudo apt-get install -y netcat-openbsd' },
    homepage: 'https://netcat.sourceforge.net',
  },
  {
    id: 'mtr', name: 'mtr', category: 'Networking',
    description: 'Combines ping and traceroute into one tool',
    checkCmd: 'mtr --version',
    installCmds: { win: 'winget install --id WinMTR.WinMTR -e', mac: 'brew install mtr', linux: 'sudo apt-get install -y mtr' },
    homepage: 'https://github.com/traviscross/mtr',
  },
  {
    id: 'openssl', name: 'OpenSSL', category: 'Networking',
    description: 'TLS/SSL toolkit and certificate utility',
    checkCmd: 'openssl version',
    installCmds: { win: 'winget install --id ShiningLight.OpenSSL -e', mac: 'brew install openssl', linux: 'sudo apt-get install -y openssl' },
    homepage: 'https://openssl.org',
  },
  {
    id: 'cloudflared', name: 'cloudflared', category: 'Networking',
    description: 'Cloudflare Tunnel client and DNS-over-HTTPS proxy',
    checkCmd: 'cloudflared --version',
    installCmds: { win: 'winget install --id Cloudflare.cloudflared -e', mac: 'brew install cloudflared', linux: 'sudo apt-get install -y cloudflared' },
    homepage: 'https://developers.cloudflare.com/cloudflare-one/connections/connect-apps',
  },
  {
    id: 'tailscale', name: 'Tailscale', category: 'Networking',
    description: 'Zero-config VPN built on WireGuard',
    checkCmd: 'tailscale version',
    installCmds: { win: 'winget install --id tailscale.tailscale -e', mac: 'brew install tailscale', linux: 'curl -fsSL https://tailscale.com/install.sh | sh' },
    homepage: 'https://tailscale.com',
  },
]

const CATEGORIES = Array.from(new Set(TOOLS.map(t => t.category)))

// ── Types ─────────────────────────────────────────────────────────────────────

type DetectionStatus = 'idle' | 'checking' | 'installed' | 'missing'

interface ToolState {
  status: DetectionStatus
  version: string | null
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LibrariesSection() {
  const { theme } = useStore()
  const ui = theme.ui

  const [toolStates, setToolStates] = useState<Record<string, ToolState>>({})
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const unlistenRef = useRef<(() => void) | null>(null)

  const platform: 'win' | 'mac' | 'linux' =
    navigator.platform.toLowerCase().includes('win') ? 'win'
      : navigator.platform.toLowerCase().includes('mac') ? 'mac'
      : 'linux'

  // Check all tools on mount
  useEffect(() => {
    async function checkAll() {
      setToolStates(prev => {
        const next = { ...prev }
        for (const tool of TOOLS) {
          if (!next[tool.id]) next[tool.id] = { status: 'checking', version: null }
        }
        return next
      })

      const results = await Promise.all(
        TOOLS.map(async tool => {
          const result = await window.api.checkTool(tool.checkCmd)
          return { id: tool.id, ...result }
        })
      )

      setToolStates(prev => {
        const next = { ...prev }
        for (const r of results) {
          next[r.id] = { status: r.installed ? 'installed' : 'missing', version: r.version }
        }
        return next
      })
    }

    checkAll()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => { unlistenRef.current?.() }
  }, [])

  const recheckTool = useCallback(async (tool: LibraryTool) => {
    setToolStates(prev => ({ ...prev, [tool.id]: { status: 'checking', version: null } }))
    const result = await window.api.checkTool(tool.checkCmd)
    setToolStates(prev => ({
      ...prev,
      [tool.id]: { status: result.installed ? 'installed' : 'missing', version: result.version },
    }))
  }, [])

  function installTool(tool: LibraryTool) {
    const cmd = tool.installCmds[platform]
    if (!cmd) return

    unlistenRef.current?.()
    unlistenRef.current = null

    const session = createTab()

    // Go straight to the terminal so the user can interact with prompts
    const { tabs } = getState()
    const idx = tabs.findIndex(t => t.kind === 'session' && t.sessionId === session.id)
    if (idx !== -1) setActiveTab(idx)
    setState({ sidePanelOpen: false })

    // Wait for the PTY to initialise before writing
    setTimeout(async () => {
      await window.api.installTool(session.id, cmd)

      let resolved = false
      let lastDataAt = Date.now()
      let pollTimer: ReturnType<typeof setTimeout> | null = null

      // Poll the check command once the PTY goes quiet for 2s.
      // This is much more reliable than trying to parse installer output.
      async function pollUntilInstalled(attemptsLeft: number) {
        if (resolved) return
        const result = await window.api.checkTool(tool.checkCmd)
        if (result.installed) {
          resolved = true
          unlisten()
          unlistenRef.current = null
          setToolStates(prev => ({
            ...prev,
            [tool.id]: { status: 'installed', version: result.version },
          }))
        } else if (attemptsLeft > 0) {
          pollTimer = setTimeout(() => pollUntilInstalled(attemptsLeft - 1), 3000)
        } else {
          resolved = true
          unlisten()
          unlistenRef.current = null
        }
      }

      // Watch PTY output: detect hard failures immediately, otherwise wait
      // for the stream to go quiet then start polling.
      let quietTimer: ReturnType<typeof setTimeout> | null = null

      const unlisten = window.api.onPtyData(session.id, (data: string) => {
        if (resolved) return
        lastDataAt = Date.now()

        const chunk = data.toLowerCase()

        // Detect unambiguous hard failures immediately
        const hardFail =
          chunk.includes('is not recognized') ||
          chunk.includes('command not found') ||
          chunk.includes('unable to locate package') ||
          chunk.includes('no package') ||
          (chunk.includes('npm err!') && chunk.includes('not found'))

        if (hardFail) {
          resolved = true
          if (quietTimer) clearTimeout(quietTimer)
          unlisten()
          unlistenRef.current = null
          return
        }

        // Reset the quiet timer on every new chunk
        if (quietTimer) clearTimeout(quietTimer)
        quietTimer = setTimeout(() => {
          // PTY has been silent for 2s — start polling the check command
          pollUntilInstalled(20)
        }, 2000)
      })

      unlistenRef.current = unlisten

      // Hard timeout after 5 minutes
      setTimeout(() => {
        if (!resolved) {
          resolved = true
          if (quietTimer) clearTimeout(quietTimer)
          if (pollTimer) clearTimeout(pollTimer)
          unlisten()
          unlistenRef.current = null
        }
      }, 300_000)
    }, 700)
  }

  const filtered = TOOLS.filter(t => {
    const q = search.toLowerCase()
    const matchSearch = !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
    const matchCat = !activeCategory || t.category === activeCategory
    return matchSearch && matchCat
  })

  const grouped = CATEGORIES.reduce<Record<string, LibraryTool[]>>((acc, cat) => {
    const items = filtered.filter(t => t.category === cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  const installedCount = TOOLS.filter(t => toolStates[t.id]?.status === 'installed').length
  const checkingCount = TOOLS.filter(t => toolStates[t.id]?.status === 'checking').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>

      {/* Search + summary */}
      <div style={{ padding: '8px 10px 6px', borderBottom: `1px solid ${ui.border}`, flexShrink: 0 }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 6 }}>
          <svg style={{ position: 'absolute', left: 7, pointerEvents: 'none', color: ui.textDim }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            placeholder="Search tools..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '4px 8px 4px 24px', fontSize: 12, background: ui.inputBg, border: `1px solid ${ui.inputBorder}`, borderRadius: 5, color: ui.text, outline: 'none' }}
            onFocus={e => (e.currentTarget.style.borderColor = ui.inputFocus)}
            onBlur={e => (e.currentTarget.style.borderColor = ui.inputBorder)}
          />
        </div>
        {/* Summary row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {checkingCount > 0 ? (
            <span style={{ fontSize: 10, color: ui.textDim }}>
              <svg style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3, animation: 'spin 1s linear infinite' }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="12" cy="12" r="9" strokeDasharray="30 20" strokeLinecap="round" />
              </svg>
              Checking...
            </span>
          ) : (
            <span style={{ fontSize: 10, color: ui.textDim }}>
              <span style={{ color: ui.success, fontWeight: 600 }}>{installedCount}</span>
              <span> / {TOOLS.length} installed</span>
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => {
              setToolStates({})
              setTimeout(() => {
                setToolStates(prev => {
                  const next = { ...prev }
                  for (const tool of TOOLS) next[tool.id] = { status: 'checking', version: null }
                  return next
                })
                Promise.all(TOOLS.map(async tool => {
                  const result = await window.api.checkTool(tool.checkCmd)
                  setToolStates(prev => ({ ...prev, [tool.id]: { status: result.installed ? 'installed' : 'missing', version: result.version } }))
                }))
              }, 50)
            }}
            title="Re-check all tools"
            style={{ padding: '2px 6px', fontSize: 10, background: 'transparent', border: `1px solid ${ui.border}`, borderRadius: 4, color: ui.textMuted, cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = ui.accent)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = ui.border)}
          >
            Refresh
          </button>
        </div>
        {/* Category pills */}
        <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
          <CategoryPill label="All" active={!activeCategory} onClick={() => setActiveCategory(null)} ui={ui} />
          {CATEGORIES.map(cat => (
            <CategoryPill key={cat} label={cat} active={activeCategory === cat} onClick={() => setActiveCategory(c => c === cat ? null : cat)} ui={ui} />
          ))}
        </div>
      </div>

      {/* Tool list */}
      <div style={{ flex: 1, overflow: 'auto', padding: '8px 10px' }}>
        {Object.entries(grouped).map(([cat, tools]) => (
          <div key={cat} style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: ui.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
              {cat}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {tools.map(tool => (
                <ToolRow
                  key={tool.id}
                  tool={tool}
                  state={toolStates[tool.id] ?? { status: 'idle', version: null }}
                  platform={platform}
                  ui={ui}
                  onInstall={() => installTool(tool)}
                  onRecheck={() => recheckTool(tool)}
                />
              ))}
            </div>
          </div>
        ))}
        {Object.keys(grouped).length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 180, gap: 8, color: ui.textDim }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span style={{ fontSize: 12, color: ui.textMuted }}>No tools match "{search}"</span>
          </div>
        )}
      </div>

    </div>
  )
}

// ── Tool Row ──────────────────────────────────────────────────────────────────

function ToolRow({ tool, state, platform, ui, onInstall, onRecheck }: {
  tool: LibraryTool
  state: ToolState
  platform: 'win' | 'mac' | 'linux'
  ui: any
  onInstall: () => void
  onRecheck: () => void
}) {
  const [hovered, setHovered] = useState(false)
  const hasInstallCmd = !!tool.installCmds[platform]
  const icon = TOOL_ICONS[tool.id]

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 8px',
        borderRadius: 6,
        background: hovered ? ui.bgTertiary : 'transparent',
        border: `1px solid ${hovered ? ui.border : 'transparent'}`,
        transition: 'background 0.1s',
      }}
    >
      {/* Icon box with status badge */}
      <div style={{ position: 'relative', flexShrink: 0, width: 30, height: 30 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: ui.bg,
          border: `1px solid ${ui.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
          opacity: state.status === 'missing' ? 0.45 : 1,
          transition: 'opacity 0.2s',
        }}>
          {icon
            ? <div style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
            : <span style={{ fontSize: 11, fontWeight: 700, color: ui.textMuted }}>{tool.name.slice(0, 2).toUpperCase()}</span>
          }
        </div>
        {/* Status badge */}
        <div style={{
          position: 'absolute', bottom: -2, right: -2,
          width: 12, height: 12, borderRadius: '50%',
          background: ui.bgSecondary,
          border: `1.5px solid ${ui.bgSecondary}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {state.status === 'checking' ? (
            <svg style={{ animation: 'spin 1s linear infinite' }} width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={ui.textDim} strokeWidth="3">
              <circle cx="12" cy="12" r="9" strokeDasharray="30 20" strokeLinecap="round" />
            </svg>
          ) : state.status === 'installed' ? (
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={ui.success} strokeWidth="3.5" strokeLinecap="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: `${ui.danger}88` }} />
          )}
        </div>
      </div>

      {/* Name + description */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: ui.text }}>{tool.name}</span>
          {state.status === 'installed' && state.version && (
            <span style={{ fontSize: 9, color: ui.success, background: `${ui.success}18`, padding: '1px 5px', borderRadius: 3, fontWeight: 500 }}>
              v{state.version}
            </span>
          )}
        </div>
        <div style={{ fontSize: 10, color: ui.textDim, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {tool.description}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 3, flexShrink: 0, opacity: hovered ? 1 : (state.status === 'missing' ? 0.6 : 0), transition: 'opacity 0.15s' }}>
        {state.status === 'installed' ? (
          <SmallBtn label="Recheck" ui={ui} onClick={onRecheck} />
        ) : state.status === 'missing' && hasInstallCmd ? (
          <SmallBtn label="Install" accent ui={ui} onClick={onInstall} />
        ) : state.status === 'missing' && !hasInstallCmd ? (
          <span style={{ fontSize: 10, color: ui.textDim, padding: '2px 4px' }}>Manual</span>
        ) : null}
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function CategoryPill({ label, active, onClick, ui }: { label: string; active: boolean; onClick: () => void; ui: any }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '2px 7px',
        fontSize: 10,
        fontWeight: active ? 600 : 400,
        background: active ? ui.accent : ui.bgTertiary,
        border: `1px solid ${active ? ui.accent : ui.border}`,
        borderRadius: 10,
        color: active ? ui.bg : ui.textMuted,
        cursor: 'pointer',
        transition: 'background 0.15s, color 0.15s, border-color 0.15s, opacity 0.15s',
      }}
      onMouseEnter={e => { if (!active) (e.currentTarget.style.borderColor = ui.accent) }}
      onMouseLeave={e => { if (!active) (e.currentTarget.style.borderColor = ui.border) }}
    >
      {label}
    </button>
  )
}

function SmallBtn({ label, ui, onClick, accent, danger }: { label: string; ui: any; onClick: () => void; accent?: boolean; danger?: boolean }) {
  const bg = accent ? ui.accent : danger ? `${ui.danger}22` : ui.bgTertiary
  const color = accent ? ui.bg : danger ? ui.danger : ui.textMuted
  return (
    <button
      onClick={onClick}
      style={{ padding: '3px 8px', fontSize: 10, fontWeight: accent ? 600 : 400, background: bg, border: 'none', borderRadius: 4, color, cursor: 'pointer', transition: 'opacity 0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      {label}
    </button>
  )
}

