import { Button } from '@/components/ui/button';
import type { Lang } from '@/i18n';

type Props = {
  lang: Lang;
  setLang: (lang: Lang) => void;
};

const langs: Lang[] = ['pl', 'en', 'nl'];

export default function LanguageSwitcher({ lang, setLang }: Props) {
  return (
    <div className="flex items-center gap-1">
      {langs.map((l) => (
        <Button
          key={l}
          variant={lang === l ? 'default' : 'outline'}
          className={lang === l ? 'h-8 px-2 text-black' : 'h-8 px-2 border-neutral-700 hover:bg-neutral-800'}
          style={lang === l ? { backgroundColor: '#3DF1C9' } : undefined}
          onClick={() => {
            setLang(l);
            try {
              localStorage.setItem('lang', l);
            } catch (err) {
              void err;
            }
          }}
        >
          {l.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}