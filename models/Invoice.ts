import { observable, computed } from 'mobx';
import humanizeDuration from 'humanize-duration';
import BigNumber from 'bignumber.js';

import BaseModel from './BaseModel';
import Base64Utils from './../utils/Base64Utils';
import DateTimeUtils from './../utils/DateTimeUtils';
import { localeString } from './../utils/LocaleUtils';

interface HopHint {
    fee_proportional_millionths: number;
    chan_id: string;
    fee_base_msat: number;
    cltv_expiry_delta: number;
    node_id: string;
}

interface RouteHint {
    hop_hints: Array<HopHint>;
}

interface HTLC {
    custom_records?: CustomRecords;
}

interface CustomRecords {
    [key: number]: string;
}

const keySendMessageType = '34349334';

export default class Invoice extends BaseModel {
    public route_hints: Array<RouteHint>;
    public fallback_addr: string;
    public r_hash: any;
    public settle_date: string;
    public expiry: string;
    public memo: string;
    public receipt: string;
    public settle_index: string;
    public add_index: string;
    public payment_request: string;
    public value: string;
    public settled: boolean;
    public amt_paid_msat: string;
    public amt_paid: string;
    public amt_paid_sat: string;
    public private: boolean;
    public creation_date: string;
    public description_hash: string;
    public r_preimage: any;
    public cltv_expiry: string;
    public htlcs: Array<HTLC>;
    // c-lightning, eclair
    public bolt11: string;
    public label: string;
    public description: string;
    public msatoshi: number;
    public msatoshi_received: number;
    @observable public payment_hash: string;
    public paid_at: number;
    public expires_at: number;
    public status: string;
    // pay req
    public timestamp?: string | number;
    public destination?: string;
    public num_satoshis?: string | number;
    public features?: any;
    // lndhub
    public amt?: number;
    public ispaid?: boolean;
    public expire_time?: number;
    public millisatoshis?: string;
    public pay_req?: string;

    public formattedTimeUntilExpiry: string;

    @computed public get model(): string {
        return localeString('views.Invoice.title');
    }

    @computed public get getRPreimage(): string {
        if (!this.r_preimage) return '';
        const preimage = this.r_preimage.data || this.r_preimage;
        return typeof preimage === 'object'
            ? Base64Utils.bytesToHexString(preimage)
            : typeof preimage === 'string'
            ? preimage.includes('=')
                ? Base64Utils.base64ToHex(preimage)
                : preimage
            : '';
    }

    @computed public get getRHash(): string {
        if (!this.r_hash) return '';
        const hash = this.r_hash.data || this.r_hash;
        return typeof hash === 'object'
            ? Base64Utils.bytesToHexString(hash)
            : typeof hash === 'string'
            ? hash.includes('=')
                ? Base64Utils.base64ToHex(hash)
                : hash
            : '';
    }

    @computed public get getDescriptionHash(): string {
        const hash = this.description_hash;
        return typeof hash === 'string'
            ? hash.includes('=')
                ? Base64Utils.base64ToHex(hash)
                : hash
            : '';
    }

    @computed public get getTimestamp(): string | number {
        return (
            this.paid_at ||
            this.creation_date ||
            this.timestamp ||
            this.settle_date ||
            0
        );
    }

    @computed public get getMemo(): string {
        return this.memo || this.description;
    }

    @computed public get isPaid(): boolean {
        return this.status === 'paid' || this.settled || this.ispaid || false;
    }

    @computed public get key(): string {
        return this.bolt11 || this.r_hash;
    }

    @computed public get getPaymentRequest(): string {
        return this.bolt11 || this.payment_request || this.pay_req;
    }

    // return amount in satoshis
    @computed public get getAmount(): number {
        if (this.msatoshi_received) {
            const msatoshi = this.msatoshi_received.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        if (this.msatoshi) {
            const msatoshi = this.msatoshi.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        if (this.amount_received_msat) {
            const msatoshi = this.amount_received_msat.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        return this.settled
            ? Number(this.amt_paid_sat)
            : Number(this.value) || Number(this.amt) || 0;
    }

    // return amount in satoshis
    @computed public get getRequestAmount(): number {
        if (this.msatoshi) {
            const msatoshi = this.msatoshi.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        if (this.amount_msat) {
            const msatoshi = this.amount_msat.toString();
            return Number(msatoshi.replace('msat', '')) / 1000;
        }
        if (this.millisatoshis) {
            const msatoshi = this.millisatoshis;
            return Number(msatoshi) / 1000;
        }
        return Number(this.num_satoshis || 0);
    }

    @computed public get getDisplayTime(): string {
        return this.isPaid
            ? this.settleDate
            : DateTimeUtils.listFormattedDate(
                  this.expires_at || this.creation_date || this.timestamp || 0
              );
    }

    @computed public get getDisplayTimeOrder(): string {
        return DateTimeUtils.listFormattedDateOrder(
            new Date(
                Number(
                    this.settle_date || this.paid_at || this.timestamp || 0
                ) * 1000
            )
        );
    }

    @computed public get getDisplayTimeShort(): string {
        return this.isPaid
            ? DateTimeUtils.listFormattedDateShort(
                  this.settle_date || this.paid_at || this.timestamp || 0
              )
            : DateTimeUtils.listFormattedDateShort(
                  this.expires_at || this.creation_date || this.timestamp || 0
              );
    }

    @computed public get getFormattedRhash(): string {
        return this.r_hash
            ? typeof this.r_hash === 'string'
                ? this.r_hash.replace(/\+/g, '-').replace(/\//g, '_')
                : this.r_hash.data
                ? Base64Utils.bytesToHexString(this.r_hash.data)
                : Base64Utils.bytesToHexString(this.r_hash)
            : '';
    }

    @computed public get getDate(): string | number | Date {
        return this.isPaid
            ? this.settleDate
            : DateTimeUtils.listDate(
                  this.expires_at || this.creation_date || this.timestamp || 0
              );
    }

    @computed public get settleDate(): Date {
        return DateTimeUtils.listFormattedDate(
            this.settle_date || this.paid_at || this.timestamp || 0
        );
    }

    @computed public get creationDate(): Date {
        return DateTimeUtils.listFormattedDate(this.creation_date);
    }

    @computed public get expirationDate(): Date | string {
        const expiry = this.expiry || this.expire_time;

        // handle LNDHub
        if (expiry && new BigNumber(expiry).gte(1600000000)) {
            return DateTimeUtils.listFormattedDate(expiry);
        }

        if (expiry) {
            if (expiry == '0') return localeString('models.Invoice.never');
            return `${expiry} ${localeString('models.Invoice.seconds')}`;
        }

        return this.expires_at
            ? DateTimeUtils.listFormattedDate(this.expires_at)
            : localeString('models.Invoice.never');
    }

    @computed public get isExpired(): boolean {
        const expiry = this.expiry || this.expire_time;

        if (expiry && new BigNumber(expiry).gte(1600000000)) {
            return (
                new Date().getTime() / 1000 >
                DateTimeUtils.listFormattedDate(expiry)
            );
        }

        if (expiry) {
            return (
                new Date().getTime() / 1000 >
                Number(this.creation_date) + Number(expiry)
            );
        }

        return false;
    }

    @computed public get getKeysendMessage(): string {
        if (
            this.htlcs &&
            this.htlcs[0] &&
            this.htlcs[0].custom_records &&
            this.htlcs[0].custom_records[keySendMessageType]
        ) {
            const encodedMessage =
                this.htlcs[0].custom_records[keySendMessageType];
            try {
                const decoded = Base64Utils.atob(encodedMessage);
                return decoded;
            } catch (e) {
                return '';
            }
        }

        return '';
    }

    public determineFormattedTimeUntilExpiry(locale: string | undefined): void {
        if (
            this.expiry === '0' ||
            (this.expiry == null &&
                this.expire_time == null &&
                this.expires_at == null)
        ) {
            this.formattedTimeUntilExpiry = localeString(
                'models.Invoice.never'
            );
            return;
        }

        const millisecondsUntilExpiry = this.getMillisecondsUntilExpiry();

        this.formattedTimeUntilExpiry =
            millisecondsUntilExpiry <= 0
                ? localeString('views.Activity.expired')
                : humanizeDuration(millisecondsUntilExpiry, {
                      language: locale === 'zh' ? 'zh_CN' : locale,
                      fallbacks: ['en'],
                      round: true,
                      largest: 2
                  })
                      .replace(/(\d+) /g, '$1 ')
                      .replace(/ (\d+)/g, ' $1');
    }

    private getMillisecondsUntilExpiry(): number {
        const creationDate = this.creation_date
            ? Number(this.creation_date)
            : Number(this.timestamp);
        if (this.expiry) {
            return (
                (creationDate + Number(this.expiry)) * 1000 -
                new Date().getTime()
            );
        }
        if (this.expire_time) {
            return (
                (creationDate + this.expire_time) * 1000 - new Date().getTime()
            );
        }
        return this.expires_at * 1000 - new Date().getTime();
    }
}
