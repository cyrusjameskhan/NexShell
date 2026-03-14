import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

const globalStyle = document.createElement('style')
globalStyle.textContent = '@keyframes spin { to { transform: rotate(360deg) } }'
document.head.appendChild(globalStyle)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
