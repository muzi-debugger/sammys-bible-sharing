import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { FileWarning, ShieldCheck } from 'lucide-react';
import { isRemoteMode } from '@/lib/supabase';
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
  if (isRemoteMode) {
    return (
      <div className="mb-5 flex items-start gap-3 rounded-journal border border-sage/35 bg-cream/30 px-3.5 py-2.5 sm:mb-6 sm:px-4">
        <ShieldCheck size={13} className="mt-0.5 shrink-0 text-forest/50" />
        <p className="min-w-0 flex-1 font-sans text-[0.72rem] leading-relaxed text-charcoal/55">
          Connected · New Living Translation via API.Bible · your notebook is private to your
          account.
        </p>
      </div>
    );
  }

  return (
    <div className="mb-5 flex items-center gap-3 rounded-journal border border-gold/35 bg-gold/[0.07] px-3.5 py-2.5 sm:mb-6 sm:px-4">
      <span className="flex shrink-0 items-center gap-1.5 font-sans text-[0.66rem] font-medium uppercase tracking-[0.16em] text-[#8a6f3f]">
        <FileWarning size={12} /> Preview
      </span>
      <p className="min-w-0 flex-1 font-sans text-[0.72rem] leading-relaxed text-charcoal/60">
        Sample content only. No emails are sent.
      </p>
      <span className="hidden shrink-0 items-center gap-1.5 font-sans text-[0.66rem] text-charcoal/45 sm:flex">
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
        <div className="mx-auto w-full max-w-[1180px] px-4 pb-28 pt-5 sm:px-6 sm:pt-6 md:px-10 md:pb-16 md:pt-10">
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
