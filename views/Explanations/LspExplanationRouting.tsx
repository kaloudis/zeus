import React from 'react';
import { Text, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import NavigationService from '../../NavigationService';

import Button from '../../components/Button';
import Header from '../../components/Header';
import Screen from '../../components/Screen';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface LspExplanationProps {
    navigation: NativeStackNavigationProp<any, any>;
}

const FONT_SIZE = 18;

export default class LspExplanation extends React.PureComponent<
    LspExplanationProps,
    {}
> {
    render() {
        const { navigation } = this.props;
        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.LspExplanation.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    navigation={navigation}
                />
                <View style={{ margin: 20 }}>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: FONT_SIZE,
                            marginBottom: FONT_SIZE
                        }}
                    >
                        {localeString('views.LspExplanationRouting.text1')}
                    </Text>
                    <Text
                        style={{
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book',
                            fontSize: FONT_SIZE,
                            marginBottom: FONT_SIZE + 10
                        }}
                    >
                        {localeString('views.LspExplanationRouting.text2')}
                    </Text>
                    <Button
                        title={localeString('views.LspExplanation.buttonText2')}
                        onPress={() =>
                            NavigationService.navigate('LspExplanationOverview')
                        }
                    />
                </View>
            </Screen>
        );
    }
}
