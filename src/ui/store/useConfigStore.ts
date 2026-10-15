import { create } from 'zustand';
import {
  DEMO_DEFAULT_ASSIGNED_TO,
  DEMO_DOMAIN,
  DEMO_ORGANIZATION_ID,
  DEMO_TOKEN,
} from '../../constants/demoConstants';
import { YXBChromeStorageCache, YXBInMemoryCache, type YXBCache } from '../../core/YXBCache';
import type { Edition, YXBConfiguration } from '../../models/YXBConfiguration';

export interface ConfigStoreState {
  domain: string;
  aiServiceDomain: string;
  organizationID: string;
  defaultToken: string;
  defaultAssignedTo: string;
  defaultProjectID: string;
  edition: Edition;
  projectID: string;
  assignedTo: string;
  assignedToName: string;
  workitemTypeID: string;
  cacheEnabled: boolean;
  cacheBackend: 'memory' | 'chromeStorage';
  workitemTypeCacheTTL: number;
  tokenCacheTTL: number;
  token: string;
  loaded: boolean;

  // Actions
  setField: <K extends keyof ConfigStoreState>(key: K, value: ConfigStoreState[K]) => void;
  load: () => Promise<void>;
  save: () => Promise<void>;
  isConfigured: () => boolean;
  validationErrors: () => string[];
  resolvedToken: () => string;
  buildConfiguration: (overrides?: Partial<YXBConfiguration>) => YXBConfiguration;
  buildConfigurationForProjectListing: (overrides?: Partial<YXBConfiguration>) => YXBConfiguration;
  buildConfigurationForMemberListing: (overrideProjId?: string) => YXBConfiguration;
}

const STORAGE_KEY = 'com.yunxiao.bugreporter.config.v1';

export const useConfigStore = create<ConfigStoreState>((set, get) => ({
  domain: DEMO_DOMAIN,
  aiServiceDomain: '',
  organizationID: DEMO_ORGANIZATION_ID,
  defaultToken: DEMO_TOKEN,
  defaultAssignedTo: DEMO_DEFAULT_ASSIGNED_TO,
  defaultProjectID: '',
  edition: 'standard',
  projectID: '',
  assignedTo: DEMO_DEFAULT_ASSIGNED_TO,
  assignedToName: '',
  workitemTypeID: '',
  cacheEnabled: true,
  cacheBackend: 'chromeStorage',
  workitemTypeCacheTTL: 3600,
  tokenCacheTTL: 300,
  token: DEMO_TOKEN,
  loaded: false,

  setField: (key, value) => set({ [key]: value }),

  load: async () => {
    try {
      const data = await chrome.storage.local.get(STORAGE_KEY);
      const saved = data[STORAGE_KEY];
      if (saved && typeof saved === 'object') {
        set({
          organizationID: saved.organizationID !== undefined ? saved.organizationID : DEMO_ORGANIZATION_ID,
          edition: saved.edition || 'standard',
          projectID: saved.projectID || '',
          assignedTo: saved.assignedTo || DEMO_DEFAULT_ASSIGNED_TO,
          assignedToName: saved.assignedToName || '',
          workitemTypeID: saved.workitemTypeID || '',
          cacheEnabled: saved.cacheEnabled !== undefined ? saved.cacheEnabled : true,
          cacheBackend: saved.cacheBackend || 'chromeStorage',
          workitemTypeCacheTTL: saved.workitemTypeCacheTTL || 3600,
          tokenCacheTTL: saved.tokenCacheTTL || 300,
          token: saved.token !== undefined ? saved.token : DEMO_TOKEN,
          loaded: true,
        });
        return;
      }
    } catch {}
    set({ loaded: true });
  },

  save: async () => {
    const state = get();
    const toSave = {
      organizationID: state.organizationID.trim(),
      edition: state.edition,
      projectID: state.projectID,
      assignedTo: state.assignedTo,
      assignedToName: state.assignedToName,
      workitemTypeID: state.workitemTypeID,
      cacheEnabled: state.cacheEnabled,
      cacheBackend: state.cacheBackend,
      workitemTypeCacheTTL: state.workitemTypeCacheTTL,
      tokenCacheTTL: state.tokenCacheTTL,
      token: state.token,
    };
    try {
      await chrome.storage.local.set({ [STORAGE_KEY]: toSave });
    } catch (e) {
      console.warn('[useConfigStore] 保存配置失败:', e);
    }
  },

  isConfigured: () => {
    return get().validationErrors().length === 0;
  },

  validationErrors: () => {
    const issues: string[] = [];
    const state = get();
    if (state.edition === 'standard' && !state.organizationID.trim()) {
      issues.push('请填写组织 ID');
    }
    if (!state.resolvedToken().trim()) {
      issues.push('请填写云效访问 Token');
    }
    return issues;
  },

  resolvedToken: () => {
    const state = get();
    const trimmed = state.token.trim();
    return trimmed.length > 0 ? trimmed : state.defaultToken;
  },

  buildConfiguration: (overrides?: Partial<YXBConfiguration>) => {
    const state = get();
    const token = state.resolvedToken();
    let cache: YXBCache | undefined;
    if (state.cacheEnabled) {
      cache = state.cacheBackend === 'chromeStorage' ? new YXBChromeStorageCache() : new YXBInMemoryCache();
    }

    const baseConfig: YXBConfiguration = {
      domain: state.domain.trim(),
      edition: state.edition,
      organizationID: state.organizationID.trim(),
      projectID: state.projectID.trim(),
      workitemTypeID: state.workitemTypeID.trim() || undefined,
      assignedTo: state.assignedTo.trim(),
      tokenProvider: async () => token,
      cache,
      workitemTypeCacheTTL: state.workitemTypeCacheTTL,
      tokenCacheTTL: state.tokenCacheTTL,
    };

    return { ...baseConfig, ...overrides };
  },

  buildConfigurationForProjectListing: (overrides?: Partial<YXBConfiguration>) => {
    const base = get().buildConfiguration(overrides);
    return {
      ...base,
      projectID: base.projectID || 'PLACEHOLDER_NOT_USED',
      assignedTo: base.assignedTo || 'PLACEHOLDER_NOT_USED',
    };
  },

  buildConfigurationForMemberListing: (overrideProjId?: string) => {
    const base = get().buildConfiguration(overrideProjId ? { projectID: overrideProjId.trim() } : undefined);
    return {
      ...base,
      assignedTo: base.assignedTo || 'PLACEHOLDER_NOT_USED',
    };
  },
}));
