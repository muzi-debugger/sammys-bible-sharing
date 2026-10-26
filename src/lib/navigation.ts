import { CalendarDays, Feather, House, NotebookPen, Settings2 } from 'lucide-react';

export interface NavItem {
  to: string;
  label: string;
  shortLabel: string;
  icon: typeof House;
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    label: 'Home',
    shortLabel: 'Home',
    icon: House,
    description: "Today's Scripture and the week ahead",
  },
  {
    to: '/weekly',
    label: 'Our Weekly Scriptures',
    shortLabel: 'Weekly',
    icon: CalendarDays,
    description: 'Two passages, one shared rhythm',
  },
  {
    to: '/sunday-study',
    label: 'Sunday Study',
    shortLabel: 'Study',
    icon: NotebookPen,
    description: 'Your private notebook and shared takeaways',
  },
  {
    to: '/journal',
    label: 'Scripture Journal',
    shortLabel: 'Journal',
    icon: Feather,
    description: 'A cherished record of what you have read',
  },
  {
    to: '/settings',
    label: 'Settings',
    shortLabel: 'Settings',
    icon: Settings2,
    description: 'Partners, schedule and translation',
  },
];
