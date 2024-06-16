import * as React from 'react';
import { Dimensions, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import {
    SuccessMessage,
    ErrorMessage
} from '../components/SuccessErrorMessage';
import Button from '../components/Button';
import CollapsedQR from '../components/CollapsedQR';
import Header from '../components/Header';
import LoadingIndicator from '../components/LoadingIndicator';
import Screen from '../components/Screen';
import Text from '../components/Text';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';
import UrlUtils from '../utils/UrlUtils';

import stores from '../stores/Stores';
import TransactionsStore from '../stores/TransactionsStore';

interface RawTxHexProps {
    navigation: NativeStackNavigationProp<any, any>;
    TransactionsStore: TransactionsStore;
    route: Route<
        'RawTxHex',
        {
            value: string;
            label: string;
            hideText: boolean;
            jumboLabel: boolean;
            logo: any;
        }
    >;
}

interface RawTxHexState {
    value: string;
    label: string;
    hideText: boolean;
    jumboLabel: boolean;
    logo: any;
}

@inject('TransactionsStore')
@observer
export default class RawTxHex extends React.PureComponent<
    RawTxHexProps,
    RawTxHexState
> {
    constructor(props: RawTxHexProps) {
        super(props);

        const value = props.route.params?.value ?? '';
        const label = props.route.params?.label ?? '';
        const { hideText, jumboLabel, logo } = props.route.params ?? {};

        this.state = {
            value,
            label,
            hideText,
            jumboLabel,
            logo
        };
    }

    render() {
        const { navigation, TransactionsStore } = this.props;
        const { value, label, hideText, jumboLabel, logo } = this.state;
        const {
            broadcastRawTxToMempoolSpace,
            broadcast_txid,
            broadcast_err,
            loading
        } = TransactionsStore;

        const { fontScale } = Dimensions.get('window');

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Transaction.rawTxHex'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                    navigation={navigation}
                />
                <View
                    style={{
                        top: 5,
                        padding: 15,
                        alignItems: 'center'
                    }}
                >
                    {jumboLabel && (
                        <Text
                            style={{
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 26 / fontScale,
                                marginBottom: 20
                            }}
                        >
                            {label || value}
                        </Text>
                    )}
                    <CollapsedQR
                        value={value}
                        textBottom
                        hideText={hideText}
                        logo={logo}
                    />
                    <Button
                        title={localeString(
                            'views.RawTxHex.broadcastToMempoolSpace'
                        )}
                        onPress={() => broadcastRawTxToMempoolSpace(value)}
                    />
                    {loading && <LoadingIndicator />}
                    {broadcast_txid && (
                        <SuccessMessage
                            message={broadcast_txid}
                            onPress={() =>
                                UrlUtils.goToBlockExplorerTXID(
                                    broadcast_txid,
                                    stores.nodeInfoStore.nodeInfo.isTestNet
                                )
                            }
                        />
                    )}
                    {broadcast_err && <ErrorMessage message={broadcast_err} />}
                </View>
            </Screen>
        );
    }
}
