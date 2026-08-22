import type { ChatSettings, SettingRow } from './settings';

export type EditableChatSettings = Omit<ChatSettings, 'chat_grounding_policy'>;

export type SettingsRepository = {
  list: () => Promise<SettingRow[]>;
  updateEditable: (settings: EditableChatSettings) => Promise<void>;
};
