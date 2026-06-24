import { useState } from 'react';
import AddPin from './AddPin';
import ManagePins from './ManagePins';

type Tab = 'add' | 'manage';

export default function Dashboard({ onSignOut }: { onSignOut: () => void }) {
  const [tab, setTab] = useState<Tab>('add');

  const tabBtn = (t: Tab) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition ${
      tab === t ? 'bg-sun text-[#4a3a0c]' : 'text-muted hover:text-text'
    }`;

  const signOut = async () => {
    try {
      await fetch('/api/admin-logout', { method: 'POST' });
    } finally {
      onSignOut();
    }
  };

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur-xl">
        <div className="wrap flex h-16 items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img src="/favicon.png" alt="" width="32" height="32" className="h-8 w-8 rounded-full bg-white object-contain p-0.5 shadow-sm ring-1 ring-black/5" />
            <span className="font-display text-lg font-semibold">Studio</span>
          </div>

          <nav className="flex items-center gap-1 rounded-full border border-line bg-white/60 p-1">
            <button className={tabBtn('add')} onClick={() => setTab('add')}>Add a pin</button>
            <button className={tabBtn('manage')} onClick={() => setTab('manage')}>Manage</button>
          </nav>

          <div className="flex items-center gap-3">
            <a href="/" className="hidden text-sm text-muted hover:text-text sm:inline">View site ↗</a>
            <button onClick={signOut} className="text-sm text-muted hover:text-text">Sign out</button>
          </div>
        </div>
      </header>

      <main className="wrap py-8">{tab === 'add' ? <AddPin /> : <ManagePins />}</main>
    </div>
  );
}
