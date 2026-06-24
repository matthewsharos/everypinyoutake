import { useEffect, useState } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';

export default function Admin() {
  const [authed, setAuthed] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    let mounted = true;
    fetch('/api/admin-session')
      .then((r) => r.json())
      .then((d) => mounted && setAuthed(!!d.authed))
      .catch(() => mounted && setAuthed(false));
    return () => {
      mounted = false;
    };
  }, []);

  if (authed === undefined) {
    return <div className="grid min-h-dvh place-items-center text-muted">Loading…</div>;
  }
  if (!authed) return <Login onAuthed={() => setAuthed(true)} />;
  return <Dashboard onSignOut={() => setAuthed(false)} />;
}
