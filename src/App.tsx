import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Index from './pages/Index';
import NotFound from './pages/NotFound';
import SectionPage from './pages/SectionPage';
import { useEffect, useState } from 'react';
import type { Lang } from './i18n';

const queryClient = new QueryClient();

const App = () => {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem('lang') as Lang | null;
      return saved === 'pl' || saved === 'en' || saved === 'nl' ? saved : 'pl';
    } catch (err) {
      void err;
      return 'pl';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('lang', lang);
    } catch (err) {
      void err;
    }
  }, [lang]);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index lang={lang} setLang={setLang} />} />
            <Route path="/analizy" element={<SectionPage lang={lang} section="analizy" />} />
            <Route path="/fakty" element={<SectionPage lang={lang} section="fakty" />} />
            <Route path="/opowiesci" element={<SectionPage lang={lang} section="opowiesci" />} />
            <Route path="/edukacja" element={<SectionPage lang={lang} section="edukacja" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;