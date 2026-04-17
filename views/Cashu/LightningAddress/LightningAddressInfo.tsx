import * as React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Screen from '../../../components/Screen';
import Header from '../../../components/Header';
import KeyValue from '../../../components/KeyValue';

import { localeString } from '../../../utils/LocaleUtils';
import { themeColor } from '../../../utils/ThemeUtils';

import LightningAddressStore from '../../../stores/LightningAddressStore';
import SettingsStore, {
    DEFAULT_SATS_SYMBOL
} from '../../../stores/SettingsStore';

interface CashuLightningAddressInfoProps {
    navigation: NativeStackNavigationProp<any, any>;
    LightningAddressStore: LightningAddressStore;
    SettingsStore: SettingsStore;
}

@inject('LightningAddressStore', 'SettingsStore')
@observer
export default class CashuLightningAddressInfo extends React.Component<
    CashuLightningAddressInfoProps,
    {}
> {
    render() {
        const { navigation, LightningAddressStore, SettingsStore } = this.props;
        const { minimumSats } = LightningAddressStore;
        const satsSymbol =
            SettingsStore?.settings?.display?.satsSymbol || DEFAULT_SATS_SYMBOL;

        return (
            <Screen>
                <View style={{ flex: 1 }}>
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: localeString(
                                'views.Settings.LightningAddressInfo.title'
                            ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book'
                            }
                        }}
                        navigation={navigation}
                    />
                    <ScrollView style={{ margin: 5 }}>
                        <View
                            style={{
                                margin: 10
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 18
                                }}
                            >
                                {localeString(
                                    'views.Cashu.LightningAddressInfo.explainer1'
                                )}
                            </Text>
                        </View>
                        <View
                            style={{
                                margin: 10
                            }}
                        >
                            <Text
                                style={{
                                    color: themeColor('text'),
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 18
                                }}
                            >
                                {localeString(
                                    'views.Cashu.LightningAddressInfo.explainer2'
                                )}
                            </Text>
                        </View>
                        <View
                            style={{
                                margin: 10
                            }}
                        >
                            {minimumSats && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Settings.LightningAddressInfo.minimumAmount'
                                    )}
                                    value={`${minimumSats} ${
                                        satsSymbol === 'beta'
                                            ? 'β'
                                            : minimumSats === 1
                                            ? 'sat'
                                            : 'sats'
                                    }`}
                                />
                            )}
                        </View>
                    </ScrollView>
                </View>
            </Screen>
        );
    }
}
