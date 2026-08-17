import { createRoot } from 'react-dom/client';
import { App } from '@/app/index';
import '@/styles/index.css';

createRoot(document.getElementById('root') as HTMLElement).render(<App />);
