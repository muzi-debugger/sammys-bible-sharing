import { NavLink } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { cn } from '@/lib/cn';
import { NAV_ITEMS } from '@/lib/navigation';
import { Brand } from '@/components/SidebarNavigation';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';

export function MobileHeader() {
  const { user } = useApp();
  const { signOut } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-sage/25 bg-ivory/90 backdrop-blur-md md:hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <Brand compact />
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-full border border-sage/50 bg-cream/50 px-2 py-1.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-forest font-serif text-[0.7rem] text-ivory">
              {user.initials}
            </span>
            <span className="font-sans text-[0.62rem] uppercase tracking-[0.1em] text-charcoal/60">
              {user.name}
            </span>
          </span>
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="rounded-full border border-sage/50 p-2.5 text-charcoal/45 transition-colors hover:text-forest"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </header>
  );
}

export function MobileNavigation() {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-sage/30 bg-ivory/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      aria-label="Main"
    >
      <ul className="flex items-stretch justify-between px-1.5 py-1.5">
        {NAV_ITEMS.map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[42px] flex-col items-center justify-center gap-1 rounded-[10px] px-1 py-2 transition-colors duration-300',
                  isActive ? 'text-forest' : 'text-charcoal/45',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full transition-colors duration-300',
                      isActive && 'bg-cream',
                    )}
                  >
                    <item.icon size={16} strokeWidth={isActive ? 2 : 1.6} />
                  </span>
                  <span className="font-sans text-[0.62rem] font-medium tracking-[0.03em]">
                    {item.shortLabel}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
