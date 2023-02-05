import * as React from 'react';
import { View } from 'react-native';
import { Header, Icon } from 'react-native-elements';
import { inject, observer } from 'mobx-react';

import Screen from '../../components/Screen';
import SetFeesForm from '../../components/SetFeesForm';

import FeeStore from '../../stores/FeeStore';

import { localeString } from '../../utils/LocaleUtils';
import { themeColor } from '../../utils/ThemeUtils';

interface SetFeesProps {
    navigation: any;
    FeeStore: FeeStore;
}

@inject('FeeStore')
@observer
export default class SetFees extends React.PureComponent<SetFeesProps, {}> {
    render() {
        const { FeeStore, navigation } = this.props;

        const BackButton = () => (
            <Icon
                name="arrow-back"
                onPress={() => navigation.goBack()}
                color={themeColor('text')}
                underlayColor="transparent"
            />
        );

        return (
            <Screen>
                <Header
                    leftComponent={<BackButton />}
                    centerComponent={{
                        text: localeString('views.Routing.SetFees'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'Lato-Regular'
                        }
                    }}
                    backgroundColor="transparent"
                    containerStyle={{
                        borderBottomWidth: 0
                    }}
                />
                <View
                    style={{
                        color: themeColor('text'),
                        top: 5,
                        padding: 15
                    }}
                >
                    <SetFeesForm FeeStore={FeeStore} expanded />
                </View>
            </Screen>
        );
    }
}
