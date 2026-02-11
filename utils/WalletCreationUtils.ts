import { v4 as uuidv4 } from 'uuid';

import { optimizeNeutrinoPeers, createLndWallet } from './LndMobileUtils';
import { localeString } from './LocaleUtils';

import SettingsStore from '../stores/SettingsStore';

interface WalletCreationParams {
    settingsStore: SettingsStore;
    enableCashu: boolean;
    clipboard: boolean;
    fiatEnabled: boolean;
    selectedCurrency: string;
    fiatRatesSource: string;
    initialMintUrls?: string[];
    onChoosingPeers: () => void;
    onCreatingWallet: () => void;
    onError: () => void;
    onSuccess: () => void;
}

export async function createOnboardingWallet(params: WalletCreationParams) {
    const {
        settingsStore,
        enableCashu,
        clipboard,
        fiatEnabled,
        selectedCurrency,
        fiatRatesSource,
        initialMintUrls,
        onChoosingPeers,
        onCreatingWallet,
        onError,
        onSuccess
    } = params;

    const { setConnectingStatus, updateSettings, settings } = settingsStore;

    onChoosingPeers();

    try {
        await optimizeNeutrinoPeers(undefined);
    } catch (e) {
        onError();
        return;
    }

    onCreatingWallet();

    const lndDir = uuidv4();

    let response;
    try {
        response = await createLndWallet({ lndDir });
    } catch (e) {
        onError();
        return;
    }

    const { wallet, seed, randomBase64 }: any = response;
    if (wallet && wallet.admin_macaroon) {
        const nodes = [
            {
                adminMacaroon: wallet.admin_macaroon,
                seedPhrase: seed.cipher_seed_mnemonic,
                walletPassword: randomBase64,
                embeddedLndNetwork: 'Mainnet',
                implementation: 'embedded-lnd',
                nickname: localeString('general.defaultNodeNickname'),
                lndDir
            }
        ];

        await updateSettings({
            nodes,
            privacy: {
                ...settings.privacy,
                clipboard
            },
            fiatEnabled,
            fiat: selectedCurrency,
            fiatRatesSource,
            ecash: {
                ...settings.ecash,
                enableCashu,
                ...(initialMintUrls && initialMintUrls.length > 0
                    ? { initialMintUrls }
                    : {})
            }
        });

        setConnectingStatus(true);
        onSuccess();
    } else {
        onError();
    }
}
