import React, { useEffect, useState, useRef } from 'react';
import { Dimensions, View } from 'react-native';
import Screen from '../components/Screen';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useSharedValue } from 'react-native-reanimated';
import { Carousel, Pagination } from 'react-native-reanimated-carousel';
import type { CarouselRef } from 'react-native-reanimated-carousel';

import Header from '../components/Header';
import Text from '../components/Text';
import ContactUtils from '../utils/ContactUtils';
import { themeColor } from '../utils/ThemeUtils';
import CollapsedQR from '../components/CollapsedQR';

interface MultiQRProps {
    navigation: NativeStackNavigationProp<any, any>;
    route: Route<
        'MultiQR',
        {
            contactData: string;
            addressData: string[];
            fromContactDetailsView?: boolean;
        }
    >;
}

const MultiQR: React.FC<MultiQRProps> = (props: MultiQRProps) => {
    const [addressData, setAddressData] = useState(['']);
    const [contactLabel, setContactLabel] = useState('');

    const { navigation, route } = props;

    const ref = useRef<CarouselRef>(null);
    const progress = useSharedValue<number>(0);

    useEffect(() => {
        const { contactData, addressData } = route.params ?? {};
        let parsedContact: any = null;

        if (
            typeof contactData === 'string' &&
            contactData.startsWith('zeuscontact:')
        ) {
            try {
                parsedContact = JSON.parse(
                    contactData.replace(/^zeuscontact:/, '')
                );
            } catch (err) {
                console.error('Failed to parse contactData:', err);
            }
        }

        if (parsedContact) {
            const essentialContact = ContactUtils.toCardContact(parsedContact);

            setContactLabel(parsedContact.name ?? '');
            setAddressData([
                `zeuscontact:${JSON.stringify(essentialContact)}`,
                ...addressData
            ]);
        } else {
            setAddressData(addressData ?? []);
        }
    }, [route]);

    const screenWidth = Dimensions.get('window').width;

    const onPressPagination = (index: number) => {
        ref.current?.scrollTo({ index, animated: true });
    };

    const renderItem = ({ item, index }: { item: any; index: number }) => (
        <CollapsedQR
            value={item}
            expanded
            hideText={route.params?.fromContactDetailsView && index === 0}
            textBottom
            truncateLongValue
            valueStyle={
                route.params?.fromContactDetailsView
                    ? { fontSize: 18 }
                    : undefined
            }
        />
    );

    return (
        <Screen>
            <Header
                leftComponent="Back"
                containerStyle={{
                    borderBottomWidth: 0
                }}
                navigation={navigation}
            />
            {route.params?.fromContactDetailsView && contactLabel ? (
                <Text
                    style={{
                        fontSize: 24,
                        textAlign: 'center'
                    }}
                >
                    {contactLabel}
                </Text>
            ) : null}
            <View
                style={{
                    flex: 1,
                    justifyContent: 'flex-start'
                }}
            >
                <Carousel
                    ref={ref}
                    animation={{
                        type: 'spring',
                        damping: 40,
                        stiffness: 200
                    }}
                    data={addressData}
                    style={{ width: screenWidth }}
                    renderItem={renderItem}
                    progress={progress}
                    loop={false}
                    snapMode="page"
                    overscrollEnabled={false}
                    layout={{
                        type: 'parallax',
                        scale: 0.9,
                        offset: 0
                    }}
                    onConfigurePanGesture={(gesture) => {
                        gesture.activeOffsetX([-20, 20]).failOffsetY([-5, 5]);
                    }}
                />
            </View>
            {addressData.length > 1 && (
                <Pagination
                    progress={progress}
                    count={addressData.length}
                    dotStyle={{
                        backgroundColor: themeColor('secondaryText'),
                        borderRadius: 50
                    }}
                    activeDotStyle={{
                        backgroundColor: themeColor('highlight')
                    }}
                    containerStyle={{ gap: 5, marginBottom: 10 }}
                    onPress={onPressPagination}
                />
            )}
        </Screen>
    );
};

export default MultiQR;
