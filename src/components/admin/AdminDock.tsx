import { useEffect, useState } from 'react';
import AddPin from './AddPin';
import Login from './Login';
import { ToastProvider } from './Toast';

type Tool = 'archive' | 'manual' | null;

function announceAdminAuth(authed: boolean) {
  window.dispatchEvent(new CustomEvent('epyt:admin-auth', { detail: { authed } }));
}

function Panel({ tool, onClose }: { tool: Exclude<Tool, null>; onClose: () => void }) {
  const title = tool === 'archive' ? 'Search pins to add' : 'Manually add a pin';

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-end p-3 sm:p-5">
      <button
        type="button"
        aria-label="Close admin tools"
        className="absolute inset-0 cursor-default bg-[rgba(42,36,28,0.28)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <section className="relative z-10 flex max-h-[86dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-2xl">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Admin tools</p>
            <h2 className="font-display text-xl font-semibold">{title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-10 w-10 place-items-center rounded-full text-muted transition hover:bg-ink-2 hover:text-text"
          >
            X
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto p-5">
          <AddPin key={tool} initialMode={tool} />
        </div>
      </section>
    </div>
  );
}

function AdminDockInner() {
  const [authed, setAuthed] = useState<boolean | undefined>(undefined);
  const [loginOpen, setLoginOpen] = useState(false);
  const [tool, setTool] = useState<Tool>(null);

  useEffect(() => {
    let mounted = true;
    fetch('/api/admin-session')
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        const next = !!d.authed;
        setAuthed(next);
        announceAdminAuth(next);
        if (next && window.location.hash === '#admin') setTool('archive');
      })
      .catch(() => mounted && setAuthed(false));
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const openLoginOrTools = () => {
      if (authed) setTool('archive');
      else setLoginOpen(true);
    };

    const onHash = () => {
      if (window.location.hash === '#admin') openLoginOrTools();
    };
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.('[data-admin-lock]') as HTMLAnchorElement | null;
      if (!link) return;
      event.preventDefault();
      history.replaceState(null, '', '#admin');
      openLoginOrTools();
    };

    window.addEventListener('hashchange', onHash);
    document.addEventListener('click', onClick);
    if (window.location.hash === '#admin') openLoginOrTools();
    return () => {
      window.removeEventListener('hashchange', onHash);
      document.removeEventListener('click', onClick);
    };
  }, [authed]);

  const signOut = async () => {
    try {
      await fetch('/api/admin-logout', { method: 'POST' });
    } finally {
      setAuthed(false);
      setTool(null);
      announceAdminAuth(false);
    }
  };

  const finishLogin = () => {
    setAuthed(true);
    setLoginOpen(false);
    setTool('archive');
    announceAdminAuth(true);
  };

  return (
    <>
      {authed && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 sm:bottom-6 sm:right-6">
          <div className="flex items-center gap-2 rounded-full border border-line bg-white/90 p-1 shadow-xl backdrop-blur">
            <button type="button" className="btn btn-ghost px-3 py-2 text-sm" onClick={() => setTool('archive')}>
              Search to add
            </button>
            <button type="button" className="btn btn-ghost px-3 py-2 text-sm" onClick={() => setTool('manual')}>
              Manual add
            </button>
            <button type="button" className="px-3 py-2 text-sm font-semibold text-muted hover:text-text" onClick={signOut}>
              Sign out
            </button>
          </div>
          <button
            type="button"
            aria-label="Manually add a pin"
            title="Manually add a pin"
            className="grid h-14 w-14 place-items-center rounded-full bg-sun text-3xl font-semibold leading-none text-[#4a3a0c] shadow-2xl ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:brightness-105"
            onClick={() => setTool('manual')}
          >
            +
          </button>
        </div>
      )}

      {loginOpen && !authed && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close login"
            className="absolute inset-0 cursor-default bg-[rgba(42,36,28,0.42)] backdrop-blur-sm"
            onClick={() => setLoginOpen(false)}
          />
          <div className="relative z-10">
            <Login compact onAuthed={finishLogin} />
          </div>
        </div>
      )}

      {tool && <Panel tool={tool} onClose={() => setTool(null)} />}
    </>
  );
}

export default function AdminDock() {
  return (
    <ToastProvider>
      <AdminDockInner />
    </ToastProvider>
  );
}
