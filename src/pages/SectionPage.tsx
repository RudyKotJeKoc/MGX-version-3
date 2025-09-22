import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Lang } from '@/i18n';
import { getUIText } from '@/i18n';
import { Link } from 'react-router-dom';

type Props = { lang: Lang; section: 'analizy' | 'fakty' | 'opowiesci' | 'edukacja' };

type ContentData = {
  generatedAt: string;
  data: Record<
    string,
    {
      full: string;
      snippet: string;
      firstLines: string[];
    }
  >;
};

function useContent() {
  const [content, setContent] = useState<ContentData | null>(null);
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/data/content_index.json', { cache: 'no-store' });
        if (res.ok) {
          setContent((await res.json()) as ContentData);
        }
      } catch {
        // ignore
      }
    };
    load();
  }, []);
  return content;
}

export default function SectionPage({ lang, section }: Props) {
  const t = getUIText(lang);
  const content = useContent();

  const blocks: { title: string; text: string }[] = (() => {
    const d = content?.data || {};
    switch (section) {
      case 'analizy':
        return [
          { title: 'Analiza psychologiczna', text: d.analiza_psychologiczna?.full || '' },
          { title: 'Raport analityczny', text: d.raport_analityczny?.full || '' },
        ];
      case 'fakty':
        return [
          { title: t.tldrTitle, text: d.tldr_5_faktow?.full || '' },
          { title: 'Kluczowe fakty', text: d.kluczowe_fakty?.full || '' },
        ];
      case 'opowiesci':
        return [
          { title: 'Polana kłamstw', text: d.polana_klamstw?.full || '' },
          { title: 'Źródła i kronika', text: d.timeline_combined?.full || '' },
        ];
      case 'edukacja':
        return [{ title: 'Służebność vs Dożywocie', text: d.edukacja_prawna?.full || '' }];
      default:
        return [];
    }
  })();

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-neutral-900 to-black">
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-black/60 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">{t.appTitle}</h1>
          <Link to="/" className="text-sm text-neutral-300 hover:text-white underline">
            ← Home
          </Link>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {blocks.map((b, idx) => (
          <Card key={idx} className="bg-neutral-950 border-neutral-800">
            <CardHeader>
              <CardTitle className="text-xl">{b.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <article className="prose prose-invert max-w-none">
                {b.text
                  ? b.text.split('\n').map((line, i) => (
                      <p key={i} className="whitespace-pre-wrap">
                        {line}
                      </p>
                    ))
                  : <p className="text-neutral-500">Brak treści.</p>}
              </article>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}