import { NavLink } from 'react-router-dom';
import { LogOut, Lock, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { NAV_ITEMS } from '@/lib/navigation';
import { OpenBook } from '@/components/Botanical';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';

export function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-sage/50 bg-cream/60 text-forest">
        <OpenBook className="h-5 w-5" />
      </span>
      <span className="leading-tight">
        <span className="block font-serif text-[1.12rem] tracking-[0.01em] text-forest">
          Sammy&rsquo;s Bible Sharing
        </span>
        {!compact ? (
          <span className="mt-0.5 block font-sans text-[0.6rem] uppercase tracking-[0.22em] text-charcoal/40">
            Grow in faith, together
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function AccountPanel() {
  const { user } = useApp();
  const { signedInAccount, signOut } = useAuth();

  return (
    <div className="rounded-journal border border-sage/35 bg-cream/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-forest font-serif text-[0.85rem] text-ivory">
            {user.initials}
          </span>
          <div className="min-w-0 leading-tight">
            <p className="truncate font-sans text-[0.78rem] font-medium text-charcoal">{user.name}</p>
            <p className="truncate font-sans text-[0.62rem] text-charcoal/45">
              {signedInAccount?.email ?? 'Signed in'}
            </p>
          </div>
        </div>
        <Lock size={12} className="shrink-0 text-forest/40" />
      </div>

      <button
        type="button"
        onClick={signOut}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-[8px] border border-sage/45 bg-soft-white px-2 py-2 font-sans text-[0.7rem] text-charcoal/60 transition-colors duration-300 hover:border-forest/40 hover:text-forest"
      >
        <LogOut size={12} /> Sign out
      </button>

      <p className="mt-2.5 flex items-start gap-1.5 font-sans text-[0.58rem] leading-relaxed text-charcoal/40">
        <ShieldCheck size={10} className="mt-[3px] shrink-0 text-gold" />
        One account per person. There is no way to open your partner&rsquo;s notebook.
      </p>
    </div>
  );
}

export function SidebarNavigation() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[272px] flex-col overflow-hidden border-r border-sage/25 bg-ivory/80 px-6 py-8 backdrop-blur-md md:flex">
      <div className="shrink-0">
        <Brand />
      </div>

      <nav
        className="mt-8 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1"
        aria-label="Main"
      >
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'group relative flex items-start gap-3 rounded-[10px] px-3 py-2.5 transition-colors duration-300 ease-gentle',
                isActive ? 'bg-cream/80 text-forest' : 'text-charcoal/60 hover:bg-cream/40 hover:text-forest',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'absolute left-0 top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full transition-opacity duration-300',
                    isActive ? 'bg-gold opacity-100' : 'opacity-0',
                  )}
                />
                <item.icon
                  size={15}
                  className={cn('mt-[3px] shrink-0', isActive ? 'text-forest' : 'text-charcoal/40')}
                  strokeWidth={1.6}
                />
                <span className="leading-tight">
                  <span className="block font-sans text-[0.82rem] font-medium">{item.label}</span>
                  <span className="mt-0.5 block font-sans text-[0.64rem] leading-snug text-charcoal/40">
                    {item.description}
                  </span>
                </span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="mt-6 shrink-0 pt-2">
        <AccountPanel />
        <p className="mt-4 px-1 font-sans text-[0.6rem] leading-relaxed text-charcoal/35">
          Preview build · data is stored locally in this browser. No emails are sent.
        </p>
      </div>
    </aside>
  );
}
