import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import stores from '../stores/Stores';

const protectedNavigation = async (
    navigation: NativeStackNavigationProp<any, any>,
    route: string,
    disactivatePOS?: boolean,
    routeParams?: any
) => {
    const { posStatus, settings, setPosStatus } = stores.settingsStore;
    const loginRequired = settings && (settings.passphrase || settings.pin);
    const posEnabled = posStatus === 'active';

    if (posEnabled && loginRequired) {
        navigation.navigate('Lockscreen', {
            attemptAdminLogin: true
        });
    } else {
        if (disactivatePOS) setPosStatus('inactive');
        navigation.navigate(route, routeParams);
    }
};

export { protectedNavigation };
