import React from 'react';
import { ScrollView, View, TouchableOpacity } from 'react-native';
import { LinearProgress } from '@rneui/themed';

import ReactNativeBlobUtil from 'react-native-blob-util';
import { inject, observer } from 'mobx-react';
import { crypto } from 'bitcoinjs-lib';
import BigNumber from 'bignumber.js';
import bolt11 from 'bolt11';
import { StackNavigationProp } from '@react-navigation/stack';
import { Route } from '@react-navigation/native';

import lndMobile from '../../lndmobile/LndMobileInjection';
const { createClaimTransaction, createReverseClaimTransaction } =
    lndMobile.swaps;

import Screen from '../../components/Screen';
import Header from '../../components/Header';
import KeyValue from '../../components/KeyValue';
import Amount from '../../components/Amount';
import Button from '../../components/Button';
import LoadingIndicator from '../../components/LoadingIndicator';
import { ErrorMessage } from '../../components/SuccessErrorMessage';
import { Row } from '../../components/layout/Row';
import Text from '../../components/Text';

import handleAnything from '../../utils/handleAnything';
import BackendUtils from '../../utils/BackendUtils';
import { localeString, pascalToHumanReadable } from '../../utils/LocaleUtils';
import { sleep } from '../../utils/SleepUtils';
import { font } from '../../utils/FontUtils';
import { themeColor } from '../../utils/ThemeUtils';
import { numberWithCommas } from '../../utils/UnitsUtils';
import UrlUtils from '../../utils/UrlUtils';

import NodeInfoStore from '../../stores/NodeInfoStore';
import SwapStore from '../../stores/SwapStore';
import { nodeInfoStore, unitsStore } from '../../stores/Stores';

import Swap, { SwapState, SwapType } from '../../models/Swap';

import CaretDown from '../../assets/images/SVG/Caret Down.svg';
import CaretRight from '../../assets/images/SVG/Caret Right.svg';
import QR from '../../assets/images/SVG/QR.svg';

interface SwapDetailsProps {
    navigation: StackNavigationProp<any, any>;
    route: Route<
        'SwapDetails',
        {
            swapData: Swap;
            privateKeyHex?: string;
            keys?: any;
            endpoint: string;
            serviceProvider: string;
            invoice: string;
            fee: string;
        }
    >;
    NodeInfoStore?: NodeInfoStore;
    SwapStore?: SwapStore;
}

interface SwapDetailsState {
    updates: string | null;
    failureReason: string;
    error: string | { message?: string } | null;
    loading: boolean;
    socketConnected: boolean;
    swapTreeToggle: boolean;
    swapData: Swap;
    privateKeyHex: string;
}

@inject('NodeInfoStore', 'SwapStore')
@observer
export default class SwapDetails extends React.Component<
    SwapDetailsProps,
    SwapDetailsState
> {
    constructor(props: SwapDetailsProps) {
        super(props);
        const rawSwapData = props.route.params.swapData;
        this.state = {
            updates: null,
            failureReason: '',
            error: null,
            loading: false,
            socketConnected: true,
            swapTreeToggle: false,
            swapData: new Swap(rawSwapData),
            privateKeyHex: props.route.params.privateKeyHex || ''
        };
    }

    /**
     * Resolve privateKeyHex from route params, stored keys, or rescue key.
     */
    resolvePrivateKeyHex = (): string => {
        const { privateKeyHex, keys } = this.props.route.params;
        if (privateKeyHex) return privateKeyHex;

        // Fall back to stored keys (serialized ECPair from storage)
        const storedKeys = keys || this.state.swapData?.keys;
        if (storedKeys?.__D) {
            const d = storedKeys.__D;
            if (d.type === 'Buffer' && Array.isArray(d.data)) {
                return Buffer.from(d.data).toString('hex');
            }
            // Real Buffer (shouldn't happen after serialization, but handle it)
            return Buffer.from(d).toString('hex');
        }

        return '';
    };

    /**
     * For rescued reverse swaps, derive missing destinationAddress and preimage.
     */
    resolveReverseSwapData = async (swapData: Swap): Promise<Swap> => {
        const { SwapStore } = this.props;
        let needsUpdate = false;
        const updates: any = {};

        // Derive preimage from rescue key if missing
        if (!swapData.preimage && swapData.keyIndex != null) {
            try {
                const preimageBuffer =
                    await SwapStore!.derivePreimageFromRescueKey(
                        swapData.keyIndex
                    );
                updates.preimage = preimageBuffer.toString('hex');
                needsUpdate = true;
                console.log('Derived preimage from rescue key');
            } catch (e) {
                console.error('Failed to derive preimage:', e);
            }
        }

        // Generate a new destination address if missing
        if (!swapData.destinationAddress) {
            try {
                const data = await BackendUtils.getNewAddress({});
                const address =
                    data.address ||
                    data.bech32 ||
                    data.p2tr ||
                    (data[0] && data[0].address);
                if (address) {
                    updates.destinationAddress = address;
                    needsUpdate = true;
                    console.log(
                        'Generated destination address for rescued swap:',
                        address
                    );
                }
            } catch (e) {
                console.error('Failed to generate destination address:', e);
            }
        }

        if (needsUpdate) {
            return new Swap({ ...swapData, ...updates });
        }
        return swapData;
    };

    async componentDidMount() {
        let { swapData } = this.state;

        // reset units to help prevent wrong amount being sent
        unitsStore.resetUnits();

        if (!swapData) {
            console.error('No swap data provided.');
            return;
        }

        // Resolve privateKeyHex from available sources
        const privateKeyHex = this.resolvePrivateKeyHex();
        if (privateKeyHex) {
            this.setState({ privateKeyHex });
        }

        if (swapData.isSubmarineSwap) {
            const finalStatus = [
                SwapState.TransactionRefunded,
                SwapState.TransactionClaimed
            ];

            const failedStatus = [
                SwapState.InvoiceFailedToPay,
                SwapState.TransactionLockupFailed,
                SwapState.SwapExpired
            ];

            if (
                finalStatus.includes(swapData?.status) ||
                (failedStatus.includes(swapData?.status) &&
                    swapData?.lockupTransaction?.hex)
            ) {
                this.setState({
                    updates: swapData.status,
                    socketConnected: false
                });
                return;
            }

            this.getSwapUpdates(swapData, swapData.isSubmarineSwap);
        } else {
            // For reverse swaps, resolve missing data before connecting
            swapData = await this.resolveReverseSwapData(swapData);
            if (swapData !== this.state.swapData) {
                this.setState({ swapData });
            }

            const failedStatus = [
                SwapState.InvoiceExpired,
                SwapState.TransactionRefunded,
                SwapState.SwapExpired
            ];
            if (failedStatus.includes(swapData?.status)) {
                this.setState({
                    updates: swapData.status,
                    socketConnected: false
                });
                return;
            }

            this.getReverseSwapUpdates(swapData, swapData.isSubmarineSwap);
        }
    }

    renderSwapTree = (swapTree: any) => {
        const { swapTreeToggle } = this.state;
        if (!swapTree) return null;

        return (
            <View>
                <TouchableOpacity
                    onPress={() => {
                        this.setState({
                            swapTreeToggle: !swapTreeToggle
                        });
                    }}
                >
                    <View
                        style={{
                            marginTop: 10,
                            marginBottom: 10
                        }}
                    >
                        <Row justify="space-between">
                            <View style={{ flex: 1 }}>
                                <KeyValue
                                    keyValue={localeString(
                                        'views.SwapDetails.swapTree'
                                    )}
                                />
                            </View>
                            {swapTreeToggle ? (
                                <CaretDown
                                    fill={themeColor('text')}
                                    width="20"
                                    height="20"
                                />
                            ) : (
                                <CaretRight
                                    fill={themeColor('text')}
                                    width="20"
                                    height="20"
                                />
                            )}
                        </Row>
                    </View>
                </TouchableOpacity>
                {swapTreeToggle &&
                    Object.entries(swapTree).map(
                        ([key, value]: [string, any]) => {
                            key = pascalToHumanReadable(key);
                            return (
                                <View key={key}>
                                    <KeyValue keyValue={key} />
                                    {typeof value === 'object' ? (
                                        Object.entries(value).map(
                                            ([nestedKey, nestedValue]: [
                                                string,
                                                any
                                            ]) => {
                                                nestedKey =
                                                    pascalToHumanReadable(
                                                        nestedKey
                                                    );
                                                return (
                                                    <KeyValue
                                                        key={nestedKey}
                                                        keyValue={nestedKey}
                                                        value={nestedValue}
                                                    />
                                                );
                                            }
                                        )
                                    ) : (
                                        <KeyValue
                                            key={key}
                                            keyValue={key}
                                            value={value}
                                        />
                                    )}
                                </View>
                            );
                        }
                    )}
            </View>
        );
    };

    getSwapUpdates = async (createdResponse: any, isSubmarineSwap: boolean) => {
        const { endpoint, invoice } = this.props.route.params;
        const { privateKeyHex } = this.state;

        const { SwapStore } = this.props;

        if (!createdResponse || !createdResponse.id) {
            console.error('Invalid response:', createdResponse);
            this.setState({ error: 'Invalid response received.' });
            return;
        }

        let submitted = false;

        console.log('Connecting to WebSocket for updates...');
        this.setState({ loading: true });

        // Create a WebSocket connection
        const webSocket = new WebSocket(
            endpoint.replace('https', 'wss') + '/ws'
        );

        // Handle WebSocket connection open
        webSocket.onopen = () => {
            console.log('WebSocket connection opened');
            webSocket.send(
                JSON.stringify({
                    op: 'subscribe',
                    channel: 'swap.update',
                    args: [createdResponse.id]
                })
            );
        };

        // Handle incoming WebSocket messages
        webSocket.onmessage = async (event) => {
            const msg = JSON.parse(event.data);

            if (msg.event !== 'update') {
                return;
            }

            console.log('Got WebSocket update');
            console.log(msg);

            const data = msg.args[0];

            // Check for API errors
            if (data?.error) {
                if (data.error === 'Operation timeout') {
                    this.setState({
                        error: 'The operation timed out.',
                        loading: false,
                        socketConnected: false
                    });
                    webSocket.close();
                    return;
                }

                this.setState({
                    error: data.error,
                    loading: false,
                    socketConnected: false
                });
                webSocket.close();
                return;
            }

            // Update the status in the component state
            this.setState({
                updates: data.status,
                failureReason: data.failureReason,
                loading: false
            });

            // Update the status in Encrypted Storage
            await SwapStore?.updateSwapStatus(
                createdResponse.id,
                data.status,
                isSubmarineSwap,
                data.failureReason
            );

            switch (data.status) {
                case SwapState.InvoiceSet:
                    console.log('Waiting for onchain transaction...');
                    break;
                case SwapState.TransactionClaimPending:
                    if (submitted) {
                        console.log(
                            'Cooperative claim transaction already created and submitted successfully. Skipping.'
                        );
                    } else {
                        console.log(
                            'Creating cooperative claim transaction...'
                        );

                        const claimTxDetails = await this.fetchClaimDetails(
                            createdResponse.id,
                            endpoint
                        );
                        console.log('Fetched claim details:', claimTxDetails);

                        const isValid = this.validatePreimage(
                            claimTxDetails?.preimage,
                            invoice
                        );
                        console.log('Is valid?', isValid);

                        if (!isValid) {
                            console.error('Invalid preimage received');
                            return;
                        }

                        console.log(
                            'Preimage validated. Proceeding with claim transaction...'
                        );
                        submitted = await this.createClaimTransaction(
                            claimTxDetails,
                            createdResponse,
                            privateKeyHex,
                            endpoint
                        );
                    }
                    break;

                case SwapState.InvoiceFailedToPay:
                case SwapState.TransactionLockupFailed:
                case SwapState.SwapExpired:
                    if (
                        isSubmarineSwap &&
                        !this.state.swapData?.lockupTransaction?.hex
                    ) {
                        const lockupTx = await SwapStore?.getLockupTransaction(
                            createdResponse.id
                        );
                        this.setState((prevState) => ({
                            swapData: new Swap({
                                ...prevState.swapData,
                                lockupTransaction: lockupTx
                            })
                        }));
                    }

                    if (data?.failureReason) {
                        webSocket.close();
                        this.setState({
                            error: data?.failureReason,
                            socketConnected: false
                        });
                    }
                    break;

                case SwapState.TransactionClaimed:
                    webSocket.close();
                    data?.failureReason &&
                        this.setState({
                            error: data?.failureReason,
                            socketConnected: false
                        });
                    break;

                default:
                    console.log('Unhandled status:', data.status);
            }
        };

        webSocket.onerror = (error) => {
            if (error.message) {
                this.setState({
                    error: error.message,
                    loading: false
                });
            }
            console.error('WebSocket error:', error);
        };

        webSocket.onclose = () => {
            console.log('WebSocket connection closed');
        };

        this.componentWillUnmount = () => {
            if (webSocket) {
                webSocket.close();
            }
        };
    };

    getReverseSwapUpdates = (
        createdResponse: any,
        isSubmarineSwap: boolean
    ) => {
        console.log('getReverseSwapUpdates');
        const { endpoint, fee } = this.props.route.params;

        const { SwapStore } = this.props;

        if (!createdResponse || !createdResponse.id) {
            console.error('Invalid response:', createdResponse);
            this.setState({ error: 'Invalid response received.' });
            return;
        }

        let submitted = false;

        console.log('Connecting to WebSocket for updates...');
        this.setState({ loading: true });

        // Create a WebSocket connection
        const webSocket = new WebSocket(
            endpoint.replace('https', 'wss') + '/ws'
        );

        // Handle WebSocket connection open
        webSocket.onopen = () => {
            console.log('WebSocket connection opened');
            webSocket.send(
                JSON.stringify({
                    op: 'subscribe',
                    channel: 'swap.update',
                    args: [createdResponse.id]
                })
            );
        };

        // Handle incoming WebSocket messages
        webSocket.onmessage = async (event) => {
            const msg = JSON.parse(event.data);

            if (msg.event !== 'update') {
                return;
            }

            console.log('Got WebSocket update');
            console.log(msg);

            const data = msg.args[0];

            // Check for API errors
            if (data?.error) {
                if (data.error === 'Operation timeout') {
                    this.setState({
                        error: 'The operation timed out.',
                        loading: false,
                        socketConnected: false
                    });
                    webSocket.close();
                    return;
                }

                this.setState({
                    error: data.error,
                    loading: false,
                    socketConnected: false
                });
                webSocket.close();
                return;
            }

            // Update the status in the component state
            this.setState({ updates: data.status, loading: false });

            // Update the status in Encrypted Storage
            await SwapStore?.updateSwapStatus(
                createdResponse.id,
                data.status,
                isSubmarineSwap
            );

            switch (data.status) {
                case SwapState.Created:
                    console.log('Waiting for invoice to be paid');
                    break;

                case SwapState.TransactionMempool:
                case SwapState.TransactionConfirmed:
                    if (submitted) {
                        console.log(
                            'Claim transaction already created and submitted successfully. Skipping.'
                        );
                    } else {
                        console.log('Creating claim transaction');

                        try {
                            const { swapData: currentSwapData, privateKeyHex } = this.state;
                            submitted = await this.createReverseClaimTransaction(
                                createdResponse,
                                privateKeyHex,
                                endpoint,
                                currentSwapData.effectiveLockupAddress!,
                                currentSwapData.destinationAddress!,
                                currentSwapData.preimage as string,
                                data.transaction.hex,
                                fee
                            );
                        } catch(e) {
                            console.log('Error creating reverse claim tx', e);
                        }
                    }
                    break;

                case SwapState.InvoiceExpired:
                case SwapState.TransactionFailed:
                case SwapState.SwapExpired:
                    webSocket.close();
                    data?.failureReason &&
                        this.setState({
                            error: data?.failureReason,
                            socketConnected: false
                        });
                    break;

                case SwapState.InvoiceSettled:
                    console.log('Swap successful');
                    webSocket.close();
                    this.setState({
                        socketConnected: false
                    });
                    break;

                default:
                    console.log('Unhandled status:', data.status);
                    break;
            }
        };

        webSocket.onerror = (error) => {
            if (error.message) {
                this.setState({
                    error: error.message,
                    loading: false
                });
            }
            console.error('WebSocket error:', error);
        };

        webSocket.onclose = () => {
            console.log('WebSocket connection closed');
        };

        this.componentWillUnmount = () => {
            if (webSocket) {
                webSocket.close();
            }
        };
    };

    fetchClaimDetails = async (swapId: string, endpoint: string) => {
        const response = await ReactNativeBlobUtil.fetch(
            'GET',
            `${endpoint}/swap/submarine/${swapId}/claim`,
            { 'Content-Type': 'application/json' }
        );
        return response.json();
    };

    /**
     * Validate the preimage by comparing its hash with the invoice's payment hash.
     */
    validatePreimage = (preimage: string, invoice: string): boolean => {
        let invoicePreimageHash: any;
        let decoded: any;
        let result: any;

        try {
            decoded = bolt11.decode(invoice);
        } catch (error) {
            console.log(error);
        }

        const paymentHash = decoded.tags.find(
            (tag: any) => tag.tagName === 'payment_hash'
        );
        invoicePreimageHash = Buffer.from(paymentHash!.data || '', 'hex');

        result = crypto
            .sha256(Buffer.from(preimage, 'hex'))
            .equals(invoicePreimageHash);

        return result;
    };

    /**
     * Create and send a claim transaction
     */
    createClaimTransaction = async (
        claimTxDetails: any,
        createdResponse: any,
        privateKeyHex: string,
        endpoint: string
    ): Promise<boolean> => {
        try {
            const swapTree = createdResponse.swapTreeDetails;
            await createClaimTransaction({
                endpoint,
                swapId: createdResponse.id,
                claimLeaf: swapTree.claimLeaf.output,
                refundLeaf: swapTree.refundLeaf.output,
                privateKey: privateKeyHex,
                servicePubKey: createdResponse.servicePubKey,
                transactionHash: claimTxDetails.transactionHash,
                pubNonce: claimTxDetails.pubNonce
            });

            console.log('Claim transaction submitted successfully.');
            return true;
        } catch (error) {
            console.log('Error submitting claim tx', error);
            return false;
        }
    };

    reverseSwapReceiveAmount = (): number => {
        const { SwapStore } = this.props;
        return new BigNumber(this.state.swapData?.getAmount || 0)
            .minus(SwapStore?.reverseSwapClaimFee || 0)
            .toNumber();
    };

    /**
     * Create and send a claim transaction for a reverse swap
     */
    createReverseClaimTransaction = async (
        createdResponse: Swap,
        privateKeyHex: string,
        endpoint: string,
        lockupAddress: string,
        destinationAddress: string,
        preimage: string,
        transactionHex: string,
        fee: string
    ): Promise<boolean> => {
        try {

            // allow some retries in case of alt network
            // tx propagation issues
            for (let i = 0; i <= 10; i++) {
                try {
                    await sleep(1000);
                    const swapTree = createdResponse.swapTreeDetails;
                    await createReverseClaimTransaction({
                        endpoint,
                        swapId: createdResponse.id,
                        claimLeaf: swapTree.claimLeaf.output,
                        refundLeaf: swapTree.refundLeaf.output,
                        privateKey: privateKeyHex,
                        servicePubKey: createdResponse.refundPubKey,
                        preimageHex: preimage,
                        transactionHex,
                        lockupAddress,
                        destinationAddress,
                        feeRate: Number(fee || 2),
                        receiveAmount: this.reverseSwapReceiveAmount(),
                        isTestnet: this.props.NodeInfoStore!.nodeInfo.isTestNet
                    });

                    console.log(
                        'Reverse claim transaction submitted successfully.',
                        { attempt: i + 1 }
                    );
                    return true;
                } catch (error) {
                    console.log('Error submitting reverse claim tx', {
                        error,
                        attempt: i + 1
                    });
                }
            }
            return false;
        } catch (e) {
            console.log('Error creating reverse claim tx ', e);
            return false;
        }
    };

    timelockIndicator = () => {
        const { swapData } = this.state;

        if (!nodeInfoStore.nodeInfo.currentBlockHeight) return '';

        if (
            new BigNumber(swapData.timeoutBlockHeight).gt(
                nodeInfoStore.nodeInfo.currentBlockHeight
            )
        ) {
            return '🔒';
        }

        return '';
    };

    render() {
        const { navigation, SwapStore } = this.props;

        const { updates, error, failureReason, swapData } = this.state;

        const serviceProvider = this.props.route.params?.serviceProvider ?? '';

        const progressUpdate = swapData.isSubmarineSwap
            ? updates === SwapState.InvoiceSet
                ? localeString('views.SwapDetails.waitingForOnchainTx')
                : updates === SwapState.TransactionMempool
                ? localeString('views.SwapDetails.waitingForConf')
                : ''
            : updates === SwapState.Created
            ? localeString('views.SwapDetails.waitingForInvoicePayment')
            : updates === SwapState.TransactionMempool
            ? localeString('views.SwapDetails.waitingForConf')
            : '';

        const QRButton = () => {
            if (!swapData.qrCodeValue) {
                return null;
            }

            return (
                <TouchableOpacity
                    onPress={() =>
                        navigation.navigate('QR', {
                            value: swapData.qrCodeValue
                        })
                    }
                >
                    <QR
                        fill={themeColor('text')}
                        style={{ alignSelf: 'center' }}
                    />
                </TouchableOpacity>
            );
        };

        const failure = failureReason || swapData.failureReason;

        const showRefundButton =
            swapData.lockupTransaction &&
            (updates === SwapState.InvoiceFailedToPay ||
                updates === SwapState.TransactionLockupFailed ||
                (swapData.isSubmarineSwap &&
                    updates === SwapState.SwapExpired) ||
                (failure && error));

        return (
            <Screen>
                <Header
                    leftComponent="Back"
                    centerComponent={{
                        text: localeString('views.SwapDetails.title'),
                        style: {
                            color: themeColor('text'),
                            fontFamily: 'PPNeueMontreal-Book'
                        }
                    }}
                    rightComponent={
                        <Row style={{ gap: 10 }}>
                            {this.state.loading && (
                                <LoadingIndicator size={35} />
                            )}
                            {!this.state.loading &&
                                (updates === SwapState.InvoiceSet ||
                                    (swapData.type === SwapType.Reverse &&
                                        updates === SwapState.Created)) && (
                                    <QRButton />
                                )}
                        </Row>
                    }
                    navigation={navigation}
                />
                <ScrollView
                    style={{ marginHorizontal: 20 }}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={{ marginBottom: 15 }}>
                        <Text
                            style={{
                                textAlign: 'center',
                                fontFamily: font('marlideBold'),
                                fontSize: 28
                            }}
                        >
                            {swapData.type}
                        </Text>
                        <Text
                            style={{
                                textAlign: 'center',
                                fontFamily: font('marlide'),
                                fontSize: 22
                            }}
                        >
                            {swapData.type === SwapType.Submarine
                                ? 'on-chain to Lightning'
                                : 'Lightning to on-chain'}
                        </Text>
                    </View>
                    {this.state.socketConnected && progressUpdate && (
                        <View
                            style={{
                                flex: 1,
                                justifyContent: 'center',
                                alignItems: 'center',
                                margin: 15,
                                gap: 4
                            }}
                        >
                            <LinearProgress color={themeColor('highlight')} />
                            <Text
                                style={{
                                    textAlign: 'center',
                                    fontSize: 14,
                                    fontFamily: 'PPNeueMontreal-Book',
                                    marginTop: 10
                                }}
                            >
                                {progressUpdate}
                            </Text>
                        </View>
                    )}
                    {error && (
                        <ErrorMessage
                            message={
                                typeof error === 'object' && 'message' in error
                                    ? error?.message
                                    : String(error)
                            }
                        />
                    )}

                    {updates && (
                        <KeyValue
                            keyValue={localeString('views.Channel.status')}
                            value={SwapStore?.formatStatus(updates)}
                            color={SwapStore?.statusColor(updates as SwapState)}
                        />
                    )}

                    {failure && (
                        <KeyValue
                            keyValue={localeString(
                                'views.SwapSettings.failureReason'
                            )}
                            value={SwapStore?.formatStatus(failure)}
                            color={SwapStore?.statusColor(failure as SwapState)}
                        />
                    )}

                    {(serviceProvider || swapData?.serviceProvider) && (
                        <KeyValue
                            keyValue={localeString('general.serviceProvider')}
                            value={serviceProvider || swapData.serviceProvider}
                        />
                    )}

                    <KeyValue
                        keyValue={localeString('views.SwapDetails.swapId')}
                        value={swapData.id}
                    />

                    {swapData.isSubmarineSwap && (
                        <>
                            <KeyValue
                                keyValue={localeString(
                                    'views.SwapDetails.expectedAmount'
                                )}
                                value={
                                    <Amount
                                        sats={swapData?.getAmount}
                                        sensitive
                                        toggleable
                                    />
                                }
                            />
                        </>
                    )}
                    {swapData.isSubmarineSwap && (
                        <KeyValue
                            keyValue={localeString('general.address')}
                            value={swapData.effectiveLockupAddress}
                        />
                    )}
                    {swapData?.txid && (
                        <KeyValue
                            keyValue={localeString('views.SendingOnChain.txid')}
                            value={swapData.txid}
                            mempoolLink={() =>
                                UrlUtils.goToBlockExplorerTXID(
                                    swapData?.txid!,
                                    this.props.NodeInfoStore!.nodeInfo.isTestNet
                                )
                            }
                            sensitive
                        />
                    )}
                    {swapData.isReverseSwap && (
                        <>
                            {swapData?.invoice && (
                                <KeyValue
                                    keyValue={localeString(
                                        'views.Invoice.title'
                                    )}
                                    value={swapData.invoice}
                                />
                            )}
                            <KeyValue
                                keyValue={localeString(
                                    'views.SwapDetails.onchainAmount'
                                )}
                                value={
                                    <Amount
                                        sats={this.reverseSwapReceiveAmount()}
                                        sensitive
                                        toggleable
                                    />
                                }
                            />
                        </>
                    )}
                    {swapData.isReverseSwap && (
                        <KeyValue
                            keyValue={localeString(
                                'views.SwapDetails.lockupAddress'
                            )}
                            value={swapData.lockupAddress}
                        />
                    )}

                    <KeyValue
                        keyValue={localeString(
                            'views.SwapDetails.timeoutBlockHeight'
                        )}
                        infoModalText={localeString(
                            'views.SwapDetails.timeoutBlockHeight.explainer'
                        )}
                        value={`${numberWithCommas(
                            swapData.timeoutBlockHeight
                        )} ${this.timelockIndicator()}`}
                    />
                    {swapData.isSubmarineSwap && (
                        <KeyValue
                            keyValue={localeString(
                                'views.SwapDetails.claimPublicKey'
                            )}
                            value={swapData?.servicePubKey}
                        />
                    )}
                    {swapData.isReverseSwap && swapData.refundPubKey && (
                        <KeyValue
                            keyValue={localeString(
                                'views.SwapDetails.refundPublicKey'
                            )}
                            value={swapData.refundPubKey}
                        />
                    )}
                    {swapData.isReverseSwap && swapData?.preimageHash && (
                        <KeyValue
                            keyValue={localeString(
                                'views.SwapDetails.preimageHash'
                            )}
                            value={swapData?.preimageHash}
                        />
                    )}

                    {/* Render Swap Tree */}
                    {this.renderSwapTree(swapData?.swapTree || swapData?.tree)}
                </ScrollView>
                {(updates === SwapState.InvoiceSet ||
                    updates === SwapState.Created) && (
                    <Button
                        title={localeString('views.PaymentRequest.payInvoice')}
                        containerStyle={{
                            paddingVertical: 10
                        }}
                        onPress={() => {
                            if (swapData.qrCodeValue) {
                                handleAnything(swapData.qrCodeValue).then(
                                    ([route, props]) => {
                                        navigation.navigate(route, props);
                                    }
                                );
                            }
                        }}
                        secondary
                    />
                )}
                {showRefundButton && (
                    <Button
                        title={localeString('views.Swaps.refundSwap')}
                        containerStyle={{ paddingVertical: 10 }}
                        onPress={() => {
                            const { endpoint } = this.props.route.params;
                            navigation.navigate('RefundSwap', {
                                swapData: new Swap({
                                    ...swapData,
                                    endpoint
                                })
                            });
                        }}
                        secondary
                    />
                )}
            </Screen>
        );
    }
}
