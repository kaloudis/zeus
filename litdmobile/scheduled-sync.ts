import { NativeModules } from 'react-native';
import type { WorkInfo } from './LitdMobile.d.ts';
const { LitdMobileScheduledSync } = NativeModules;

export const checkScheduledSyncWorkStatus = async (): Promise<WorkInfo> => {
    return await LitdMobileScheduledSync.checkScheduledSyncWorkStatus();
};
