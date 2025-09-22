import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import type { Lang } from '@/i18n';
import { getUIText } from '@/i18n';

// Kolory akcentów
const MINT = '#3DF1C9';
const MAGENTA = '#FF2BA6';

type Track = {
  id: string;
  title: string;
  artist: string;
  cover?: string;
  url?: string;
  description?: string;
  playlist?: string;
  tags?: string[];
};

type Comment = {
  id: string;
  name: string;
  message: string;
  createdAt: number;
  reactions: { up: number; down: number; laugh: number; angry: number };
};

type Channel = 'podcast' | 'music' | 'mix';

const STORAGE_KEYS = {
  STREAM_URL: 'ra_stream_url',
  COMMENTS: 'ra_comments',
};

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch (err) {
      void err;
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
      void err;
    }
  }, [key, value]);
  return [value, setValue] as const;
}

function filenameToTitle(file: string): string {
  const parts = file.split('/');
  const base = parts[parts.length - 1] || file;
  const noExt = base.replace(/\.[^/.]+$/, '');
  return decodeURIComponent(noExt.replace(/[_-]+/g, ' ')).replace(/\s*\(\s*(\d+)\s*\)\s*/g, ' $1');
}

function normalizeTrack(x: unknown): Track {
  const obj = (typeof x === 'object' && x !== null ? (x as Record<string, unknown>) : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
  const arrStr = (v: unknown) => (Array.isArray(v) ? (v.filter((i) => typeof i === 'string') as string[]) : undefined);

  const file = str(obj.file);
  const category = str(obj.category) ?? str(obj.playlist) ?? str(obj.type);
  const url = file ? `/${file}` : str(obj.url) ?? str(obj.src);
  const title = str(obj.title) ?? (file ? filenameToTitle(file) : 'Nieznany tytuł');

  return {
    id: String(obj.id ?? `${title}-${category ?? 'uncat'}`),
    title,
    artist: String(str(obj.artist) ?? str(obj.author) ?? 'Radio Adamowo'),
    url,
    cover: str(obj.cover) ?? str(obj.image),
    description: str(obj.description) ?? '',
    playlist: category,
    tags: arrStr(obj.tags),
  };
}

function classifyTrack(t: Track): 'podcast' | 'music' {
  const cat = (t.playlist || '').toLowerCase();
  const url = (t.url || '').toLowerCase();
  if (cat === 'audio' || url.includes('/audio/')) return 'podcast';
  return 'music';
}

type ContentData = {
  generatedAt: string;
  data: Record<string, { full: string; snippet: string; firstLines: string[] }>;
};

function useContent() {
  const [content, setContent] = useState<ContentData | null>(null);
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/data/content_index.json', { cache: 'no-store' });
        if (res.ok) setContent((await res.json()) as ContentData);
      } catch (err) {
        void err;
      }
    };
    load();
  }, []);
  return content;
}

export default function Index({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  const t = getUIText(lang);
  // Audio element
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Stream URL
  const [streamUrl, setStreamUrl] = useLocalStorage<string>(STORAGE_KEYS.STREAM_URL, '');
  const [tempStreamUrl, setTempStreamUrl] = useState<string>(streamUrl);

  const [tracks, setTracks] = useState<Track[]>([]);
  const [channel, setChannel] = useState<Channel>('mix');
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isRadioPlaying, setIsRadioPlaying] = useState<boolean>(false);
  const [isExternalStream, setIsExternalStream] = useState<boolean>(false);

  const content = useContent();

  useEffect(() => {
    const loadPlaylist = async () => {
      try {
        const res = await fetch('/data/playlist.json', { cache: 'no-store' });
        if (!res.ok) return;
        const data: unknown = await res.json();
        let incoming: Track[] | null = null;
        if (Array.isArray(data)) {
          incoming = data.map(normalizeTrack);
        } else if (data && typeof data === 'object') {
          const obj = data as Record<string, unknown>;
          if (Array.isArray(obj.tracks)) incoming = (obj.tracks as unknown[]).map(normalizeTrack);
          const hls = typeof obj.hls === 'string' ? obj.hls : undefined;
          const stream = typeof obj.stream === 'string' ? obj.stream : undefined;
          const url = typeof obj.url === 'string' ? obj.url : undefined;
          const probableStream = hls ?? stream ?? url;
          if (!streamUrl && probableStream) {
            setStreamUrl(probableStream);
            setTempStreamUrl(probableStream);
          }
        }
        if (incoming && incoming.length) {
          setTracks(incoming);
        }
      } catch (err) {
        console.warn('Playlist load failed', err);
      }
    };
    loadPlaylist();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => setTempStreamUrl(streamUrl), [streamUrl]);

  const podcastTracks = useMemo(() => tracks.filter((t) => classifyTrack(t) === 'podcast' && t.url), [tracks]);
  const musicTracks = useMemo(() => tracks.filter((t) => classifyTrack(t) === 'music' && t.url), [tracks]);

  const currentList = useMemo(() => {
    if (channel === 'podcast') return podcastTracks;
    if (channel === 'music') return musicTracks;
    return [...podcastTracks, ...musicTracks];
  }, [channel, podcastTracks, musicTracks]);

  const currentTrack: Track | null =
    currentList.length > 0 && currentIndex >= 0 && currentIndex < currentList.length ? currentList[currentIndex] : null;

  const playUrl = (url: string) => {
    if (!audioRef.current || !url) return;
    audioRef.current.src = encodeURI(url);
    audioRef.current
      .play()
      .then(() => setIsRadioPlaying(true))
      .catch((err) => {
        console.warn('Autoplay may be blocked', err);
      });
  };

  const startRadio = (start?: number) => {
    setIsExternalStream(false);
    if (currentList.length === 0) return;
    const idx = typeof start === 'number' ? start : Math.floor(Math.random() * currentList.length);
    setCurrentIndex(idx);
    const next = currentList[idx];
    if (next?.url) playUrl(next.url);
  };

  const togglePlayPause = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el
        .play()
        .then(() => setIsRadioPlaying(true))
        .catch((err) => {
          console.warn('Play failed', err);
        });
    } else {
      el.pause();
      setIsRadioPlaying(false);
    }
  };

  const playNext = () => {
    if (currentList.length === 0) return;
    const nextIndex = (currentIndex + 1) % currentList.length;
    setCurrentIndex(nextIndex);
    const next = currentList[nextIndex];
    if (next?.url) playUrl(next.url);
  };

  const playPrev = () => {
    if (currentList.length === 0) return;
    const prevIndex = (currentIndex - 1 + currentList.length) % currentList.length;
    setCurrentIndex(prevIndex);
    const prev = currentList[prevIndex];
    if (prev?.url) playUrl(prev.url);
  };

  const onEnded = () => {
    if (isExternalStream) return;
    playNext();
  };

  // Społeczność (MVP)
  const [comments, setComments] = useLocalStorage<Comment[]>(STORAGE_KEYS.COMMENTS, []);
  const addComment = (name: string, message: string) => {
    const c: Comment = {
      id: `c_${Date.now()}`,
      name: name || 'Anonim',
      message: message.trim(),
      createdAt: Date.now(),
      reactions: { up: 0, down: 0, laugh: 0, angry: 0 },
    };
    if (!c.message) return;
    setComments([c, ...comments]);
  };

  const heroIntro = content?.data.hero_intro?.snippet || '';
  const motto = content?.data.motto?.snippet || '';
  const tldrLines = content?.data.tldr_5_faktow?.firstLines || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-neutral-900 to-black">
      {/* Pasek górny */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-black/60 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full"
              style={{
                background: `radial-gradient(40% 40% at 50% 50%, ${MINT} 0%, transparent 60%), radial-gradient(40% 40% at 70% 30%, ${MAGENTA} 0%, transparent 70%)`,
                boxShadow: `0 0 30px ${MINT}66, 0 0 24px ${MAGENTA}44`,
              }}
              aria-hidden
            />
            <h1 className="text-xl font-semibold tracking-tight">{t.appTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher lang={lang} setLang={setLang} />
            <Button
              onClick={() => {
                if (streamUrl) {
                  setIsExternalStream(true);
                  playUrl(streamUrl);
                } else {
                  startRadio();
                }
              }}
              className="text-black font-semibold"
              style={{ backgroundColor: MINT }}
            >
              {t.listenLive}
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-10">
        {/* Hero i motto */}
        <section className="relative overflow-hidden rounded-2xl border border-neutral-800">
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(60% 60% at 20% 20%, ${MAGENTA}22 0%, transparent 60%), radial-gradient(50% 50% at 80% 30%, ${MINT}22 0%, transparent 60%)`,
              filter: 'blur(8px)',
            }}
            aria-hidden
          />
          <div className="relative p-8 md:p-12 space-y-6">
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">{t.heroSubtitle}</h2>
            <p className="text-neutral-300 max-w-3xl">{heroIntro || '„Słuchaj szumu prawdy w eterze manipulacji”.'}</p>
            {lang !== 'pl' && <p className="text-xs text-neutral-400">{t.contentPLNotice}</p>}
            <div className="flex flex-wrap gap-3">
              <a href="#radio">
                <Button className="text-black font-semibold" style={{ backgroundColor: MINT }}>
                  {t.listenLive}
                </Button>
              </a>
              {motto && (
                <div className="text-sm text-neutral-400">
                  <span className="opacity-70">Motto/Akt I: </span>
                  <em>{motto}</em>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* TL;DR */}
        <section className="rounded-2xl border border-neutral-800 p-6 space-y-3">
          <h3 className="text-2xl font-bold">{t.tldrTitle}</h3>
          <ul className="list-disc pl-5 text-neutral-200 space-y-1">
            {tldrLines.length > 0 ? tldrLines.map((l, i) => <li key={i}>{l}</li>) : <li className="text-neutral-500">Brak danych TL;DR.</li>}
          </ul>
        </section>

        {/* Zakładki: Analizy / Fakty / Opowieści / Edukacja prawna */}
        <section className="rounded-2xl border border-neutral-800 p-6">
          <Tabs defaultValue="analizy">
            <TabsList className="bg-neutral-900 border border-neutral-800">
              <TabsTrigger value="analizy">{t.tabsAnalizy}</TabsTrigger>
              <TabsTrigger value="fakty">{t.tabsFakty}</TabsTrigger>
              <TabsTrigger value="opowiesci">{t.tabsOpowiesci}</TabsTrigger>
              <TabsTrigger value="edukacja">{t.tabsEdukacja}</TabsTrigger>
            </TabsList>

            <TabsContent value="analizy" className="mt-4">
              <Teaser title="Analiza psychologiczna" text={content?.data.analiza_psychologiczna?.snippet || ''} to="/analizy" readMore={t.readMore} />
              <Separator className="my-4 bg-neutral-800" />
              <Teaser title="Raport analityczny" text={content?.data.raport_analityczny?.snippet || ''} to="/analizy" readMore={t.readMore} />
            </TabsContent>

            <TabsContent value="fakty" className="mt-4">
              <Teaser title={t.tldrTitle} text={content?.data.tldr_5_faktow?.snippet || ''} to="/fakty" readMore={t.readMore} />
              <Separator className="my-4 bg-neutral-800" />
              <Teaser title="Kluczowe fakty" text={content?.data.kluczowe_fakty?.snippet || ''} to="/fakty" readMore={t.readMore} />
            </TabsContent>

            <TabsContent value="opowiesci" className="mt-4">
              <Teaser title="Polana kłamstw" text={content?.data.polana_klamstw?.snippet || ''} to="/opowiesci" readMore={t.readMore} />
              <Separator className="my-4 bg-neutral-800" />
              <Teaser title="Źródła i kronika" text={content?.data.timeline_combined?.snippet || ''} to="/opowiesci" readMore={t.readMore} />
            </TabsContent>

            <TabsContent value="edukacja" className="mt-4">
              <Teaser title="Służebność vs Dożywocie" text={content?.data.edukacja_prawna?.snippet || ''} to="/edukacja" readMore={t.readMore} />
            </TabsContent>
          </Tabs>
        </section>

        {/* Radio — odtwarzanie w tle, bez listy */}
        <section id="radio" className="rounded-2xl border border-neutral-800 p-6 space-y-4">
          <h3 className="text-2xl font-bold">{t.radio}</h3>
          <p className="text-neutral-400">Odtwarzanie w tle jak stacja radiowa. Wybierz kanał i naciśnij {t.start}.</p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-neutral-400">{t.channel}:</span>
            {(['podcast', 'music', 'mix'] as Channel[]).map((c) => (
              <Button
                key={c}
                variant={channel === c ? 'default' : 'outline'}
                className={channel === c ? 'text-black' : 'border-neutral-700 hover:bg-neutral-800'}
                style={channel === c ? { backgroundColor: MINT } : undefined}
                onClick={() => {
                  setChannel(c);
                  setCurrentIndex(0);
                  if (isRadioPlaying && !isExternalStream) {
                    const list = c === 'podcast' ? podcastTracks : c === 'music' ? musicTracks : [...podcastTracks, ...musicTracks];
                    if (list.length > 0 && list[0]?.url) playUrl(list[0].url);
                  }
                }}
              >
                {c === 'podcast' ? t.podcasts : c === 'music' ? t.music : t.mix}
              </Button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={() => startRadio()} className="text-black font-semibold" style={{ backgroundColor: MINT }}>
              {t.start}
            </Button>
            <Button variant="outline" className="border-neutral-700 hover:bg-neutral-800" onClick={togglePlayPause}>
              {isRadioPlaying ? t.pause : t.play}
            </Button>
            <Button variant="outline" className="border-neutral-700 hover:bg-neutral-800" onClick={playPrev}>
              {t.prev}
            </Button>
            <Button variant="outline" className="border-neutral-700 hover:bg-neutral-800" onClick={playNext}>
              {t.next}
            </Button>
          </div>

          <Card className="bg-neutral-950 border-neutral-800">
            <CardHeader>
              <CardTitle>{t.nowPlaying}</CardTitle>
              <CardDescription className="text-neutral-400">
                {isExternalStream ? t.externalStream : channel === 'podcast' ? t.podcasts : channel === 'music' ? t.music : t.mix}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isExternalStream ? (
                <div className="text-neutral-300">
                  <p className="text-sm">Adres: {streamUrl || '—'}</p>
                </div>
              ) : currentTrack ? (
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-lg font-medium">{currentTrack.title}</div>
                    <div className="text-sm text-neutral-400">{currentTrack.artist}</div>
                    {currentTrack.playlist && <div className="text-xs text-neutral-500 mt-1">Kategoria: {currentTrack.playlist}</div>}
                  </div>
                  <div className="text-sm text-neutral-500">{currentList.length > 0 ? `${currentIndex + 1} / ${currentList.length}` : null}</div>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">{t.readyToPlay}</p>
              )}
              <div className="rounded-lg overflow-hidden border border-neutral-800 mt-4">
                <audio ref={audioRef} controls className="w-full bg-black" onEnded={onEnded} onError={onEnded} />
              </div>
            </CardContent>
          </Card>

          {/* Zewnętrzny strumień HLS/MP3 */}
          <div className="grid md:grid-cols-[1fr,auto] gap-2">
            <div className="space-y-2">
              <Label htmlFor="stream">{t.streamUrl}</Label>
              <Input
                id="stream"
                placeholder="https://example.com/stream.m3u8 lub .mp3"
                value={tempStreamUrl}
                onChange={(e) => setTempStreamUrl(e.target.value)}
                className="bg-neutral-900 border-neutral-800"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={() => {
                  try {
                    localStorage.setItem('ra_stream_url', JSON.stringify(tempStreamUrl));
                  } catch (err) {
                    void err;
                  }
                  if (tempStreamUrl) {
                    setStreamUrl(tempStreamUrl);
                    setIsExternalStream(true);
                    playUrl(tempStreamUrl);
                  }
                }}
                className="text-black font-semibold"
                style={{ backgroundColor: MINT }}
              >
                {t.setAndPlay}
              </Button>
            </div>
          </div>
        </section>

        {/* Społeczność (MVP) */}
        <section className="rounded-2xl border border-neutral-800 p-6">
          <h3 className="text-2xl font-bold">{t.community}</h3>
          <p className="text-neutral-400 mb-3">{t.commentsNote}</p>
          <CommentForm onSubmit={addComment} />
          <Separator className="bg-neutral-800 my-4" />
          <div className="space-y-4">
            {comments.length === 0 && <p className="text-sm text-neutral-500">Brak komentarzy. Dodaj pierwszy wpis.</p>}
            {comments.map((c) => (
              <div key={c.id} className="p-3 rounded-lg border border-neutral-800 bg-neutral-950/60">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-neutral-500">{new Date(c.createdAt).toLocaleString('pl-PL')}</div>
                </div>
                <p className="mt-1 text-neutral-200 whitespace-pre-wrap">{c.message}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="mt-8 border-t border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 py-6 text-sm text-neutral-500">© {new Date().getFullYear()} Radio Adamowo.</div>
      </footer>
    </div>
  );
}

function Teaser({ title, text, to, readMore }: { title: string; text: string; to: string; readMore: string }) {
  return (
    <Card className="bg-neutral-950 border-neutral-800">
      <CardHeader>
        <CardTitle className="text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-neutral-300">{text || '—'}</p>
        <div className="mt-3">
          <Link to={to} className="inline-flex items-center text-sm font-medium" style={{ color: MINT }}>
            {readMore} →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

function CommentForm({ onSubmit }: { onSubmit: (name: string, message: string) => void }) {
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  return (
    <div className="grid md:grid-cols-[200px,1fr,auto] gap-3">
      <div className="space-y-2">
        <Label htmlFor="cf-name">Imię/Nick</Label>
        <Input id="cf-name" placeholder="Twoje imię" value={name} onChange={(e) => setName(e.target.value)} className="bg-neutral-900 border-neutral-800" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="cf-msg">Wiadomość</Label>
        <Textarea id="cf-msg" placeholder="Zostaw komentarz..." value={message} onChange={(e) => setMessage(e.target.value)} className="bg-neutral-900 border-neutral-800 min-h-[46px]" />
      </div>
      <div className="flex items-end">
        <Button
          className="text-black font-semibold"
          style={{ backgroundColor: MINT }}
          onClick={() => {
            onSubmit(name, message);
            setMessage('');
          }}
        >
          Wyślij
        </Button>
      </div>
    </div>
  );
}