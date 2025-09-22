import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);

// Rejestracja Service Workera dla PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // pomiń błędy rejestracji w MVP
    });
  });
}