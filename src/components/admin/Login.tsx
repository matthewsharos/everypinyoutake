import { useEffect, useRef, useState } from 'react';

export default function Login({ onAuthed }: { onAuthed: () => void }) {
  const [digits, setDigits] = useState(['', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const submit = async (code: string) => {
    setBusy(true);
    setErr('');
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pin: code }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Incorrect code.');
      onAuthed();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Incorrect code.');
      setDigits(['', '', '', '']);
      setBusy(false);
      refs.current[0]?.focus();
    }
  };

  const onChange = (i: number, val: string) => {
    const d = val.replace(/\D/g, '').slice(-1);
    setErr('');
    const next = [...digits];
    next[i] = d;
    setDigits(next);
    if (d && i < 3) refs.current[i + 1]?.focus();
    if (next.every((x) => x !== '')) submit(next.join(''));
  };

  const onKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  const onPaste = (e: React.ClipboardEvent) => {
    const txt = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (txt.length === 4) {
      e.preventDefault();
      setDigits(txt.split(''));
      submit(txt);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <div className="w-full max-w-xs rounded-3xl border border-line bg-surface p-8 text-center shadow-xl">
        <img
          src="/favicon.png"
          alt=""
          width="56"
          height="56"
          className="mx-auto h-14 w-14 rounded-full bg-white object-contain p-1 shadow-sm ring-1 ring-black/5"
        />
        <h1 className="mt-4 font-display text-2xl font-semibold">EveryPinYouTake</h1>
        <p className="mt-1 text-sm text-muted">Enter your code to manage the collection.</p>

        <div className="mt-6 flex justify-center gap-2.5" onPaste={onPaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                refs.current[i] = el;
              }}
              value={d}
              onChange={(e) => onChange(i, e.target.value)}
              onKeyDown={(e) => onKeyDown(i, e)}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              maxLength={1}
              disabled={busy}
              aria-label={`Digit ${i + 1}`}
              className="h-14 w-12 rounded-2xl border border-line bg-white text-center font-display text-2xl outline-none transition-colors focus:border-sky/70 disabled:opacity-60"
            />
          ))}
        </div>

        <div className="mt-4 h-5 text-sm">
          {busy ? <span className="text-muted">Checking…</span> : err ? <span className="text-magenta">{err}</span> : null}
        </div>

        <p className="mt-3 text-xs text-muted">This device stays unlocked after you enter the code.</p>
      </div>
    </div>
  );
}
