// The custom tip amount field on a standalone POS order. Left empty, the tip
// is 21% of the subtotal in sats whatever the display units are (#5854).
// Mounts the real Order view; child components are host elements.
jest.mock('mobx-react', () => ({
    inject: () => (component: any) => component,
    observer: (component: any) => component
}));
jest.mock('@rneui/themed', () => ({ ButtonGroup: 'ButtonGroup' }));
jest.mock('react-native-print', () => ({
    __esModule: true,
    default: { print: jest.fn() }
}));
jest.mock('../stores/SettingsStore', () => ({
    PosEnabled: {
        Disabled: 'disabled',
        Square: 'square',
        Standalone: 'standalone'
    }
}));
jest.mock('../stores/FiatStore', () => ({}));
jest.mock('../stores/UnitsStore', () => ({}));
jest.mock('../stores/PosStore', () => ({}));
jest.mock('../utils/BackendUtils', () => ({
    __esModule: true,
    default: { supportsCashuWallet: () => false }
}));
jest.mock('../utils/AmountUtils', () => ({
    getFormattedAmount: (value: any, units: string) => `${value} ${units}`
}));
jest.mock('../utils/LocaleUtils');
jest.mock('../utils/ThemeUtils', () => ({ themeColor: () => '#000000' }));
jest.mock('../components/Amount', () => 'Amount');
jest.mock('../components/Button', () => 'Button');
jest.mock('../components/Header', () => 'Header');
jest.mock('../components/KeyValue', () => 'KeyValue');
jest.mock('../components/Screen', () => {
    const { View } = require('react-native');
    return ({ children }: any) => <View>{children}</View>;
});
jest.mock('../components/TextInput', () => 'TextInput');
jest.mock('../components/layout/Spacer', () => ({ Spacer: 'Spacer' }));

import * as React from 'react';
import { Platform } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import RNPrint from 'react-native-print';

import OrderView from './Order';

// A $5.00 order at $100,000 per BTC: the subtotal is 5,000 sats and the
// default tip is 1,050 sats, $1.05 or 0.00001050 BTC
const mountOrder = async (units: string) => {
    const navigation = { navigate: jest.fn(), goBack: jest.fn() };
    const order = {
        id: 'order-1',
        line_items: [
            {
                name: 'Coffee',
                quantity: 1,
                base_price_money: { amount: 5, sats: 0 }
            }
        ],
        total_money: { amount: 500, sats: 0 },
        total_tax_money: { amount: 0 }
    };
    await render(
        <OrderView
            navigation={navigation as any}
            route={{ params: { order } } as any}
            SettingsStore={
                {
                    settings: {
                        fiat: 'USD',
                        fiatEnabled: true,
                        pos: {
                            posEnabled: 'standalone',
                            disableTips: false,
                            enablePrinter: true,
                            taxPercentage: '0'
                        }
                    }
                } as any
            }
            FiatStore={
                {
                    fiatRates: [{ code: 'USD', rate: 100000 }],
                    getRate: () => '$100,000.00 BTC/USD',
                    getSymbol: () => ({ symbol: '$', rtl: false }),
                    formatAmountForDisplay: (amount: string) => `$${amount}`
                } as any
            }
            UnitsStore={{ units, changeUnits: jest.fn() } as any}
            PosStore={{ getOrderPaymentById: jest.fn() } as any}
        />
    );
    return { navigation };
};

const hosts = (type: string) =>
    screen.container.queryAll((n: any) => n.type === type);
const button = (title: string) =>
    hosts('Button').find((n: any) => n.props.title === title)!;

// Custom is the fourth tip button; its amount field is the second input
const chooseEmptyCustomAmount = async () => {
    await act(async () => hosts('ButtonGroup')[0].props.onPress(3));
    const amountInput = hosts('TextInput')[1];
    await act(async () => amountInput.props.onPressIn());
    return hosts('TextInput')[1];
};

const proceedParams = (navigation: any) => {
    button('general.proceed').props.onPress();
    return navigation.navigate.mock.calls[0];
};

describe('Order custom tip amount left empty', () => {
    const originalOS = Platform.OS;
    beforeEach(() => {
        jest.clearAllMocks();
        Platform.OS = 'android';
    });
    afterEach(() => {
        Platform.OS = originalOS;
    });

    it.each([
        ['sats', '1050', '6050'],
        ['fiat', '1.05', '6.05'],
        ['BTC', '0.00001050', '0.00006050']
    ])(
        'in %s units tips 1,050 sats and shows the default as %s',
        async (units, placeholder, amount) => {
            const { navigation } = await mountOrder(units);

            const amountInput = await chooseEmptyCustomAmount();

            expect(amountInput.props.value).toBe('');
            expect(amountInput.props.placeholder).toBe(placeholder);
            expect(proceedParams(navigation)).toEqual([
                'Receive',
                expect.objectContaining({
                    orderTip: '1050',
                    orderTotal: '6050',
                    amount
                })
            ]);
        }
    );

    it('still converts an amount typed in fiat units', async () => {
        const { navigation } = await mountOrder('fiat');

        const amountInput = await chooseEmptyCustomAmount();
        await act(async () => amountInput.props.onChangeText('2.50'));

        expect(proceedParams(navigation)[1]).toMatchObject({
            orderTip: '2500',
            orderTotal: '7500',
            amount: '7.50'
        });
    });

    it('prints the same tip on the invoice in fiat units', async () => {
        await mountOrder('fiat');
        await chooseEmptyCustomAmount();

        await act(async () =>
            button('pos.views.Order.printInvoice').props.onPress()
        );

        const { html } = (RNPrint.print as jest.Mock).mock.calls[0][0];
        const row = (key: string) =>
            new RegExp(`${key.replace(/\./g, '\\.')}</td>\\s*<td[^>]*>([^<]*)<`)
                .exec(html)?.[1]
                .trim();
        expect(row('pos.views.Order.tipFiat')).toBe('$1.05');
        expect(row('pos.views.Order.totalFiat')).toBe('$6.05');
    });
});
