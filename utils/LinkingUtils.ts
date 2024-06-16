import { Linking, Platform, NativeModules } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { localeString } from './LocaleUtils';
import handleAnything from './handleAnything';

class LinkingUtils {
    handleInitialUrl = (navigation: NativeStackNavigationProp<any, any>) =>
        Linking.getInitialURL().then(async (url) => {
            if (url) {
                this.handleDeepLink(url, navigation);
                return;
            }
            if (Platform.OS === 'android') {
                const nfcData =
                    await NativeModules.MobileTools.getIntentNfcData();
                if (nfcData) this.handleDeepLink(nfcData, navigation);
            }
        });
    handleDeepLink = (
        url: string,
        navigation: NativeStackNavigationProp<any, any>
    ) => {
        if (url.startsWith('nostr:')) {
            Linking.openURL(url);
        } else {
            handleAnything(url)
                .then(([route, props]) => {
                    navigation.navigate(route, props);
                })
                .catch((err) =>
                    console.error(
                        localeString('views.Wallet.Wallet.error'),
                        err
                    )
                );
        }
    };
}

const linkingUtils = new LinkingUtils();
export default linkingUtils;
