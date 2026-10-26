import { isRemoteMode } from '@/lib/supabase';
import { updateOwnProfile } from '@/services/remote';
import { resetDatabase, getDatabase, mutateDatabase, setSessionUser } from '@/services/storage';
import type { AppSettings, PartnerId, PreviewDatabase } from '@/types';

export interface SettingsService {
  get(): AppSettings;
  update(updater: (draft: AppSettings) => void): AppSettings;
  updatePartner(id: PartnerId, patch: { name?: string; email?: string }): void;
  switchUser(id: PartnerId): void;
  resetPreviewData(): void;
  snapshot(): PreviewDatabase;
}

export const settingsService: SettingsService = {
  get() {
    return getDatabase().settings;
  },

  update(updater) {
    let next = getDatabase().settings;
    mutateDatabase((draft) => {
      updater(draft.settings);
      draft.profiles = draft.settings.partners;
      next = { ...draft.settings };
    });
    return next;
  },

  updatePartner(id, patch) {
    mutateDatabase((draft) => {
      draft.settings.partners = draft.settings.partners.map((partner) =>
        partner.id === id ? { ...partner, ...patch } : partner,
      );
      draft.profiles = draft.settings.partners;
      for (const assignment of draft.assignments) {
        if (assignment.partnerId === id && patch.email) {
          assignment.emailDelivery = { ...assignment.emailDelivery, recipient: patch.email };
        }
      }
    });
    if (isRemoteMode) {
      void updateOwnProfile(id, {
        ...(patch.name ? { display_name: patch.name } : {}),
        ...(patch.email ? { email: patch.email } : {}),
      }).catch((error: Error) => console.error(error.message));
    }
  },

  switchUser(id) {
    setSessionUser(id);
  },

  resetPreviewData() {
    resetDatabase();
  },

  snapshot() {
    return getDatabase();
  },
};
