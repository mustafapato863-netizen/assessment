import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './app';
import './styles/fonts.css';
import './styles.css';
import './styles/mobile-polish.css';
import './styles/calm.css';

// Restore saved density preference synchronously before first paint
try {
  const savedDensity = localStorage.getItem('assessflow:density');
  if (savedDensity === 'compact' || savedDensity === 'comfortable') {
    document.documentElement.dataset.density = savedDensity;
  }
} catch {
  // Ignore storage restrictions
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
