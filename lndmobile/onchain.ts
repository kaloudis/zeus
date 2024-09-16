import Long from 'long';
import { sendCommand, sendStreamCommand, decodeStreamResult } from './utils';
import { lnrpc } from '../proto/lightning';
import { OutPoint } from '../models/TransactionRequest';

/**
 * @throws
 */
export const getTransactions = async (): Promise<lnrpc.TransactionDetails> => {
    const response = await sendCommand<
        lnrpc.IGetTransactionsRequest,
        lnrpc.GetTransactionsRequest,
        lnrpc.TransactionDetails
    >({
        request: lnrpc.GetTransactionsRequest,
        response: lnrpc.TransactionDetails,
        method: 'GetTransactions',
        options: {}
    });
    return response;
};

/**
 * @throws
 */
export const newAddress = async (
    type: lnrpc.AddressType = lnrpc.AddressType.UNUSED_WITNESS_PUBKEY_HASH,
    account: string = 'default'
): Promise<lnrpc.NewAddressResponse> => {
    const response = await sendCommand<
        lnrpc.INewAddressRequest,
        lnrpc.NewAddressRequest,
        lnrpc.NewAddressResponse
    >({
        request: lnrpc.NewAddressRequest,
        response: lnrpc.NewAddressResponse,
        method: 'NewAddress',
        options: {
            type,
            account
        }
    });
    return response;
};

/**
 * @throws
 */
export const walletBalance = async ({
    account
}: {
    account?: string;
}): Promise<lnrpc.WalletBalanceResponse> => {
    const response = await sendCommand<
        lnrpc.IWalletBalanceRequest,
        lnrpc.WalletBalanceRequest,
        lnrpc.WalletBalanceResponse
    >({
        request: lnrpc.WalletBalanceRequest,
        response: lnrpc.WalletBalanceResponse,
        method: 'WalletBalance',
        options: {
            account
        }
    });
    return response;
};

/**
 * @throws
 */
export const sendCoins = async (
    address: string,
    sat: number,
    feeRate?: number,
    spend_unconfirmed?: boolean,
    send_all?: boolean,
    outpoints?: Array<OutPoint>
): Promise<lnrpc.SendCoinsResponse> => {
    const response = await sendCommand<
        lnrpc.ISendCoinsRequest,
        lnrpc.SendCoinsRequest,
        lnrpc.SendCoinsResponse
    >({
        request: lnrpc.SendCoinsRequest,
        response: lnrpc.SendCoinsResponse,
        method: 'SendCoins',
        options: {
            addr: address,
            amount: Long.fromValue(sat),
            sat_per_vbyte: feeRate ? Long.fromValue(feeRate) : undefined,
            spend_unconfirmed,
            send_all,
            outpoints
        }
    });
    return response;
};

/**
 * @throws
 */
export const sendCoinsAll = async (
    address: string
): Promise<lnrpc.SendCoinsResponse> => {
    const response = await sendCommand<
        lnrpc.ISendCoinsRequest,
        lnrpc.SendCoinsRequest,
        lnrpc.SendCoinsResponse
    >({
        request: lnrpc.SendCoinsRequest,
        response: lnrpc.SendCoinsResponse,
        method: 'SendCoins',
        options: {
            addr: address,
            send_all: true
        }
    });
    return response;
};

/**
 * @throws
 * TODO test
 */
export const subscribeTransactions = async (): Promise<string> => {
    // API docs say that GetTransactionsRequest should be used
    // https://api.lightning.community/#subscribetransactions
    const response = await sendStreamCommand<
        lnrpc.IGetTransactionsRequest,
        lnrpc.GetTransactionsRequest
    >(
        {
            request: lnrpc.GetTransactionsRequest,
            method: 'SubscribeTransactions',
            options: {}
        },
        true
    );
    return response;
};

export const decodeSubscribeTransactionsResult = (
    data: string
): lnrpc.Transaction => {
    return decodeStreamResult<lnrpc.Transaction>({
        response: lnrpc.Transaction,
        base64Result: data
    });
};
