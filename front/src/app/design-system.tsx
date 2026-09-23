import React from 'react';
import { createRoot } from 'react-dom/client';
import { DesignSystemGallery } from './design-system/gallery';
import '@/styles/index.css';
import '@/styles/surfaces/design-system.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesignSystemGallery />
  </React.StrictMode>,
);
