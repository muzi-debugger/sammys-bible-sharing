import type { ReactNode } from 'react';
import { LeafCorner, OpenBook, DivineDivider } from '@/components/Botanical';

export function AuthLayout({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4 py-10 sm:px-6">
      <div className="grid w-full max-w-[980px] overflow-hidden rounded-journal-lg border border-sage/35 bg-soft-white shadow-paper-lift lg:grid-cols-[0.95fr_1.05fr]">
        {/* Editorial panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-cream/70 p-9 lg:flex">
          <LeafCorner className="pointer-events-none absolute -bottom-12 -left-10 h-64 w-64 text-sage/40" />
          <div className="relative flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full border border-sage/50 bg-ivory/70 text-forest">
              <OpenBook className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block font-serif text-[1.1rem] text-forest">
                Sammy&rsquo;s Bible Sharing
              </span>
              <span className="mt-0.5 block font-sans text-[0.58rem] uppercase tracking-[0.22em] text-charcoal/40">
                Grow in faith, together
              </span>
            </span>
          </div>

          <div className="relative">
            <p className="font-serif text-[1.6rem] leading-[1.5] text-forest/85 italic">
              Two Scriptures. Two perspectives. One conversation.
            </p>
            <div className="mt-6 max-w-[34ch] space-y-3 font-sans text-[0.78rem] leading-relaxed text-charcoal/55">
              <p>
                Every Monday a different passage is prepared for each of you. You write in your own
                private notebook during the week, then unpack both together on Sunday.
              </p>
              <p className="flex items-start gap-2">
                <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-gold" />
                Your notebook is yours alone. Your partner can never read it.
              </p>
            </div>
          </div>

          <div className="relative">
            <DivineDivider />
            <p className="mt-4 font-sans text-[0.62rem] uppercase tracking-[0.18em] text-charcoal/35">
              New Living Translation · preferred throughout
            </p>
          </div>
        </div>

        {/* Form panel */}
        <div className="p-6 sm:p-9">
          <div className="lg:hidden">
            <div className="mb-6 flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-sage/50 bg-cream/60 text-forest">
                <OpenBook className="h-4 w-4" />
              </span>
              <span className="font-serif text-[1rem] text-forest">Sammy&rsquo;s Bible Sharing</span>
            </div>
          </div>

          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 font-serif text-[1.8rem] leading-tight text-forest sm:text-[2rem]">
            {title}
          </h1>
          <p className="mt-2 font-sans text-[0.82rem] leading-relaxed text-charcoal/55">{subtitle}</p>

          <div className="mt-7">{children}</div>

          {footer ? <div className="mt-6 border-t border-sage/25 pt-5">{footer}</div> : null}
        </div>
      </div>

      <p className="mt-6 max-w-md text-center font-sans text-[0.64rem] leading-relaxed text-charcoal/35">
        Preview build · accounts and Scripture are stored in this browser only. No emails are sent
        and no NLT text is included.
      </p>
    </div>
  );
}
