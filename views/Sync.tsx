import React from 'react';
import { Dimensions, View } from 'react-native';
import { inject, observer } from 'mobx-react';
import CircularProgress from 'react-native-circular-progress-indicator';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Button from '../components/Button';
import KeyValue from '../components/KeyValue';
import Screen from '../components/Screen';
import Header from '../components/Header';

import SyncStore from '../stores/SyncStore';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

interface SyncProps {
    navigation: NativeStackNavigationProp<any, any>;
    SyncStore: SyncStore;
}

@inject('SyncStore')
@observer
export default class Sync extends React.PureComponent<SyncProps, {}> {
    render() {
        const { navigation, SyncStore } = this.props;
        const { bestBlockHeight, currentBlockHeight, numBlocksUntilSynced } =
            SyncStore;

        const { width } = Dimensions.get('window');

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.Sync.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <View style={{ alignItems: 'center', marginBottom: 40 }}>
                        <CircularProgress
                            value={
                                currentBlockHeight && bestBlockHeight
                                    ? Number(
                                          Math.floor(
                                              (currentBlockHeight /
                                                  bestBlockHeight) *
                                                  1000
                                          ) / 1000
                                      ) * 100
                                    : 0
                            }
                            radius={width / 3}
                            inActiveStrokeOpacity={0.5}
                            activeStrokeWidth={width / 20}
                            inActiveStrokeWidth={width / 40}
                            progressValueStyle={{
                                fontWeight: '100',
                                color: 'white'
                            }}
                            activeStrokeColor={themeColor('highlight')}
                            activeStrokeSecondaryColor={themeColor('error')}
                            inActiveStrokeColor={themeColor(
                                'secondaryBackground'
                            )}
                            duration={500}
                            dashedStrokeConfig={{
                                count: 50,
                                width: 4
                            }}
                            progressFormatter={(value: number) => {
                                'worklet';
                                return value.toFixed && value.toFixed(1); // 1 decimal place
                            }}
                            valueSuffix="%"
                        />
                    </View>

                    <View
                        style={{ marginLeft: 20, marginRight: 20, height: 140 }}
                    >
                        {currentBlockHeight && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Sync.currentBlockHeight'
                                )}
                                value={currentBlockHeight}
                            />
                        )}
                        {bestBlockHeight && (
                            <KeyValue
                                keyValue={localeString('views.Sync.tip')}
                                value={bestBlockHeight}
                            />
                        )}
                        {!!numBlocksUntilSynced && (
                            <KeyValue
                                keyValue={localeString(
                                    'views.Sync.numBlocksUntilSynced'
                                )}
                                value={numBlocksUntilSynced}
                            />
                        )}
                    </View>
                </View>
                <View style={{ bottom: 15 }}>
                    <Button
                        title={localeString('general.goBack')}
                        onPress={() => navigation.goBack()}
                    />
                </View>
            </Screen>
        );
    }
}
