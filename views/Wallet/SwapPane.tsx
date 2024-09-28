import * as React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import EncryptedStorage from 'react-native-encrypted-storage';
import { StackNavigationProp } from '@react-navigation/stack';
import BigNumber from 'bignumber.js';

import BalanceStore from '../../stores/BalanceStore';
import NodeInfoStore from '../../stores/NodeInfoStore';
import SettingsStore from '../../stores/SettingsStore';
import SyncStore from '../../stores/SyncStore';
import SwapStore from '../../stores/SwapStore';

import Amount from '../../components/Amount';
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
    SettingsStore: SettingsStore;
    SyncStore: SyncStore;
    SwapStore: SwapStore;
}

interface SwapPaneState {
    showBackupPrompt: boolean;
    reverse: boolean;
    serviceFeeSats: number;
    inputSats: number;
    outputSats: number;
}

@inject('BalanceStore', 'SettingsStore', 'SyncStore', 'SwapStore')
@observer
export default class SwapPane extends React.PureComponent<
    SwapPaneProps,
    SwapPaneState
> {
    state = {
        showBackupPrompt: false,
        reverse: false,
        serviceFeeSats: 0,
        inputSats: 0,
        outputSats: 0
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
        const { SettingsStore, SwapStore, navigation } = this.props;
        const { reverse, serviceFeeSats, inputSats, outputSats } = this.state;
        const { subInfo, reverseInfo } = SwapStore;
        const info: any = reverse ? reverseInfo : subInfo;
        const min = info.limits.minimal;
        const max = info.limits.maximal;

        const serviceFeePct = info.fees.percentage;
        const networkFee = reverse
            ? new BigNumber(info.fees.minerFees.claim).plus(
                  info.fees.minerFees.lockup
              )
            : info.fees.minerFees;

        const errorInput = inputSats < min;
        const errorOutput = outputSats < 0;
        const error = errorInput || errorOutput;

        return (
            <Screen>
                <WalletHeader navigation={navigation} />
                <View style={{ flex: 1, margin: 10 }}>
                    <View style={{ alignItems: 'center' }}>
                        <Text
                            style={{
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 20,
                                marginBottom: 20
                            }}
                        >
                            Create atomic swap
                        </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={{ flex: 1 }}>
                            <Row style={{ position: 'absolute', zIndex: 1 }}>
                                <AmountInput
                                    prefix={
                                        <View style={{ marginLeft: -10 }}>
                                            {reverse ? (
                                                <LightningSvg width={60} />
                                            ) : (
                                                <OnChainSvg width={60} />
                                            )}
                                        </View>
                                    }
                                    onAmountChange={(
                                        _,
                                        satAmount: string | number
                                    ) => {
                                        console.log('//satAmount', satAmount);
                                        if (!satAmount || satAmount === '0') {
                                            this.setState({
                                                serviceFeeSats: 0,
                                                outputSats: 0
                                            });
                                        }

                                        console.log(
                                            'serviceFeePct',
                                            serviceFeePct
                                        );

                                        const serviceFeeSats = satAmount
                                            ? new BigNumber(satAmount)
                                                  .times(serviceFeePct)
                                                  .div(100)
                                                  .toNumber()
                                            : 0;

                                        console.log(
                                            'serviceFeeSats',
                                            serviceFeeSats
                                        );

                                        const outputSats = satAmount
                                            ? new BigNumber(satAmount)
                                                  .minus(serviceFeeSats)
                                                  .minus(networkFee)
                                                  .toNumber()
                                            : 0;

                                        console.log('outputSats', outputSats);

                                        this.setState({
                                            serviceFeeSats,
                                            inputSats: Number(satAmount),
                                            outputSats
                                        });
                                    }}
                                    sats={inputSats ? inputSats.toString() : ''}
                                    hideConversion
                                    error={errorInput}
                                />
                            </Row>
                            <TouchableOpacity
                                style={{
                                    alignSelf: 'center',
                                    position: 'absolute',
                                    zIndex: 100,
                                    top: 50
                                }}
                                onPress={() => {
                                    this.setState({
                                        reverse: !reverse,
                                        inputSats: 0,
                                        outputSats: 0,
                                        serviceFeeSats: 0
                                    });
                                }}
                            >
                                <View
                                    style={{
                                        backgroundColor:
                                            themeColor('background'),
                                        borderRadius: 30,
                                        padding: 10
                                    }}
                                >
                                    <ArrowDown
                                        fill={themeColor('text')}
                                        height="30"
                                        width="30"
                                    />
                                </View>
                            </TouchableOpacity>
                            <View style={{ zIndex: 2 }}>
                                <Row
                                    style={{
                                        position: 'absolute',
                                        zIndex: 1,
                                        top: 70
                                    }}
                                >
                                    <AmountInput
                                        prefix={
                                            <View style={{ marginLeft: -10 }}>
                                                {reverse ? (
                                                    <OnChainSvg width={60} />
                                                ) : (
                                                    <LightningSvg width={60} />
                                                )}
                                            </View>
                                        }
                                        onAmountChange={(
                                            _,
                                            satAmount: string | number
                                        ) => {
                                            console.log(
                                                '//satAmount2',
                                                satAmount
                                            );
                                            if (
                                                !satAmount ||
                                                satAmount === '0'
                                            ) {
                                                this.setState({
                                                    serviceFeeSats: 0,
                                                    inputSats: 0
                                                });
                                            }
                                            const serviceFeeSats = satAmount
                                                ? new BigNumber(1)
                                                      .div(serviceFeePct)
                                                      .div(100)
                                                      .times(satAmount)
                                                      .toNumber()
                                                : 0;

                                            console.log(
                                                'serviceFeeSats2',
                                                serviceFeeSats
                                            );

                                            const inputSats = satAmount
                                                ? new BigNumber(satAmount)
                                                      .plus(serviceFeeSats)
                                                      .plus(networkFee)
                                                      .toNumber()
                                                : 0;

                                            console.log(
                                                'inputSats2',
                                                inputSats
                                            );
                                            this.setState({
                                                serviceFeeSats,
                                                inputSats,
                                                outputSats: Number(satAmount)
                                            });
                                        }}
                                        hideConversion
                                        sats={
                                            outputSats
                                                ? outputSats.toString()
                                                : ''
                                        }
                                        error={errorOutput}
                                    />
                                </Row>
                            </View>
                            <Row justify="space-between">
                                <View style={{ top: 165 }}>
                                    <Row>
                                        <Text
                                            style={{
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            Service fee:{' '}
                                        </Text>
                                        <Amount sats={serviceFeeSats} />
                                        <Text
                                            style={{
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            {' '}
                                            ({serviceFeePct}%)
                                        </Text>
                                    </Row>
                                    <Row>
                                        <Text
                                            style={{
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            Network fee:{' '}
                                        </Text>
                                        <Amount sats={networkFee} />
                                    </Row>
                                </View>
                                <View style={{ top: 165 }}>
                                    <Row>
                                        <Text
                                            style={{
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            Min:{' '}
                                        </Text>
                                        <Amount sats={min} />
                                    </Row>
                                    <Row>
                                        <Text
                                            style={{
                                                fontFamily:
                                                    'PPNeueMontreal-Book'
                                            }}
                                        >
                                            Max:{' '}
                                        </Text>
                                        <Amount sats={max} />
                                    </Row>
                                </View>
                            </Row>
                        </View>
                    </View>
                    <View style={{ marginBottom: 0 }}>
                        <Button title="Initiate swap" disabled={error} />
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
