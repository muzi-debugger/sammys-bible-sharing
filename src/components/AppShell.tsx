import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { FileWarning, ShieldCheck } from 'lucide-react';
import { SidebarNavigation } from '@/components/SidebarNavigation';
import { MobileHeader, MobileNavigation } from '@/components/MobileNavigation';
import { InlineError } from '@/components/ui/states';
import { useApp } from '@/context/AppContext';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
}

function PreviewBanner() {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-journal border border-gold/35 bg-gold/[0.07] px-4 py-2.5">
      <span className="flex items-center gap-1.5 font-sans text-[0.66rem] font-medium uppercase tracking-[0.16em] text-[#8a6f3f]">
        <FileWarning size={12} /> Preview build
      </span>
      <p className="flex-1 font-sans text-[0.72rem] leading-relaxed text-charcoal/60">
        Sample content only. No licensed NLT text is included and no emails are sent.
      </p>
      <span className="flex items-center gap-1.5 font-sans text-[0.66rem] text-charcoal/45">
        <ShieldCheck size={11} className="text-forest/50" /> NLT preference locked
      </span>
    </div>
  );
}

export function AppShell() {
  const { bootError, retryBootstrap, bootState } = useApp();

  return (
    <div className="relative min-h-screen">
      <ScrollToTop />
      <SidebarNavigation />
      <MobileHeader />
      <main className="relative z-10 md:pl-[272px]">
        <div className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-6 sm:px-6 md:px-10 md:pb-16 md:pt-10">
          <PreviewBanner />
          {bootError ? (
            <div className="mb-6">
              <InlineError message={bootError} onRetry={retryBootstrap} />
            </div>
          ) : null}
          {bootState === 'loading' ? (
            <div className="mb-4 h-[2px] w-full overflow-hidden rounded-full bg-sage/20">
              <div className="h-full w-1/3 animate-[fade-in_1.2s_ease-in-out_infinite_alternate] rounded-full bg-gold/70" />
            </div>
          ) : null}
          <Outlet />
        </div>
      </main>
      <MobileNavigation />
    </div>
  );
}
