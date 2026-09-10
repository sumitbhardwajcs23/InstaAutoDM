// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/auth.css';

// Automatic reload handler for stale deployment chunk errors
window.addEventListener('error', (e) => {
  if (e.message && (e.message.includes('Loading chunk') || e.message.includes('dynamically imported module') || e.message.includes('Failed to load module script') || e.message.includes('MIME type'))) {
    if (!sessionStorage.getItem('airvix_chunk_reloaded')) {
      sessionStorage.setItem('airvix_chunk_reloaded', 'true');
      window.location.reload();
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
