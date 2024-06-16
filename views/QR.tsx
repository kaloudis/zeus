import * as React from 'react';
import { Dimensions, View } from 'react-native';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import CollapsedQR from '../components/CollapsedQR';
import Header from '../components/Header';
import Screen from '../components/Screen';
import Text from '../components/Text';

import { themeColor } from '../utils/ThemeUtils';

interface QRProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<
        'QR',
        {
            value: string;
            label: string;
            hideText: boolean;
            jumboLabel: boolean;
            logo: any;
        }
    >;
}

interface QRState {
    value: string;
    label: string;
    hideText: boolean;
    jumboLabel: boolean;
    logo: any;
}

export default class QR extends React.PureComponent<QRProps, QRState> {
    constructor(props: QRProps) {
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
        const { navigation } = this.props;
        const { value, label, hideText, jumboLabel, logo } = this.state;

        const { fontScale } = Dimensions.get('window');

        return (
            <Screen>
                <Header
                    leftComponent="Back"
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
                        expanded
                        textBottom
                        hideText={hideText}
                        logo={logo}
                    />
                </View>
            </Screen>
        );
    }
}
