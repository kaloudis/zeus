import * as React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import EncryptedStorage from 'react-native-encrypted-storage';
import { StackNavigationProp } from '@react-navigation/stack';

import BalanceStore from '../../stores/BalanceStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore from '../../stores/SettingsStore';
import SyncStore from '../../stores/SyncStore';

import Button from '../../components/Button';
import { Row } from '../../components/layout/Row';
import Screen from '../../components/Screen';
import Text from '../../components/Text';
import AmountInput from '../../components/AmountInput';
import WalletHeader from '../../components/WalletHeader';

import { themeColor } from '../../utils/ThemeUtils';

import ArrowDown from '../../assets/images/SVG/Arrow_down.svg';
import OnChainSvg from '../../assets/images/SVG/DynamicSVG/OnChainSvg';
import LightningSvg from '../../assets/images/SVG/DynamicSVG/LightningSvg';
// import Swap from '../../assets/images/SVG/Swap.svg';

interface SwapPaneProps {
    navigation: StackNavigationProp<any, any>;
    BalanceStore: BalanceStore;
    NodeInfoStore: NodeInfoStore;
    SettingsStore: SettingsStore;
    SyncStore: SyncStore;
}

interface SwapPaneState {
    showBackupPrompt: boolean;
}

@inject('BalanceStore', 'NodeInfoStore', 'SettingsStore', 'SyncStore')
@observer
export default class SwapPane extends React.PureComponent<
    SwapPaneProps,
    SwapPaneState
> {
    state = {
        showBackupPrompt: false
    };

    async UNSAFE_componentWillMount() {
        const isBackedUp = await EncryptedStorage.getItem('backup-complete');
        if (isBackedUp !== 'true') {
            this.setState({
                showBackupPrompt: true
            });
        }
    }

    render() {
        const { NodeInfoStore, SettingsStore, navigation } = this.props;

        return (
            <Screen>
                <WalletHeader navigation={navigation} />
                <View style={{ flex: 1, margin: 10 }}>
                    <View style={{ flex: 1 }}>
                        <View style={{ alignItems: 'center' }}>
                            <Text
                                style={{
                                    fontFamily: 'PPNeueMontreal-Book',
                                    fontSize: 20
                                }}
                            >
                                Create atomic swap
                            </Text>
                        </View>
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            Min:
                        </Text>
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book'
                            }}
                        >
                            Max:
                        </Text>
                        <Row>
                            <View style={{alignItems: 'center',
        justifyContent: 'flex-start' }}>
                                <LightningSvg />
                            </View>
                            <AmountInput
                                onAmountChange={() => {}}
                                hideConversion
                            />
                        </Row>
                        <TouchableOpacity
                            style={{
                                alignItems: 'center',
                                marginBottom: -20,
                                marginTop: -20
                            }}
                        >
                            <View
                                style={{
                                    backgroundColor: themeColor('background'),
                                    borderRadius: 30,
                                    padding: 20,
                                    zIndex: 1
                                }}
                            >
                                <ArrowDown
                                    fill={themeColor('text')}
                                    height="30"
                                    width="30"
                                />
                            </View>
                        </TouchableOpacity>
                        <View style={{ top: -20, zIndex: 2 }}>
                            <Row>
                                <OnChainSvg width={50} />
                                <AmountInput
                                    onAmountChange={() => {}}
                                    hideConversion
                                />
                            </Row>
                        </View>
                    </View>
                    <View style={{ marginBottom: 15 }}>
                        <Button title="Initiate swap" />
                    </View>
                </View>
            </Screen>
        );
    }
}

const styles = StyleSheet.create({
    balance: {
        alignItems: 'center'
    },
    conversion: {
        top: 10,
        alignItems: 'center'
    },
    conversionSecondary: {
        top: 3,
        alignItems: 'center'
    }
});
