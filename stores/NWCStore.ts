import { observable, runInAction, action } from 'mobx';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { NWCWalletService, NWCWalletServiceKeyPair } from '@alby/js-sdk'; // Assuming js-sdk is installed

import settingsStoreInstance from './SettingsStore'; // To access NWC settings and wallet details
import TransactionsStore from './TransactionsStore';
import NodeInfoStore from './NodeInfoStore';
import BalanceStore from './BalanceStore';
import ChannelsStore from './ChannelsStore';
// Import other necessary stores or utils for payment processing (LND, Cashu)
// e.g. import cashuStore from './CashuStore';

const DEFAULT_NWC_RELAY = 'wss://relay.getalby.com/v1';

export default class NWCStore {
    @observable public isServiceEnabled: boolean = false;
    @observable public serviceUri: string | null = null;
    @observable public error: string | null = null;
    @observable public loading: boolean = false; // Renamed from public_loading

    private walletService: NWCWalletService | null = null;
    private walletServiceSecretKey: string | null = null;
    private walletServicePubkey: string | null = null;
    // Store active subscriptions/keypairs if needed
    private activeSubscriptions: Map<string, () => void> = new Map();

    private transactionsStore: TransactionsStore;
    private nodeInfoStore: NodeInfoStore;
    private balanceStore: BalanceStore;
    private channelsStore: ChannelsStore;

    constructor() {
        // In a real app, these would likely be injected or part of a root store
        this.channelsStore = new ChannelsStore(settingsStoreInstance);
        this.nodeInfoStore = new NodeInfoStore(this.channelsStore, settingsStoreInstance);
        this.transactionsStore = new TransactionsStore(settingsStoreInstance, this.nodeInfoStore, this.channelsStore);
        this.balanceStore = new BalanceStore(settingsStoreInstance);

        this.initializeFromSettings();
    }

    @action
    private initializeFromSettings = async () => {
        const { nwcService } = settingsStoreInstance.settings;
        if (nwcService.enabled && nwcService.secretKey && nwcService.publicKey) {
            this.walletServiceSecretKey = nwcService.secretKey;
            this.walletServicePubkey = nwcService.publicKey;
            this.isServiceEnabled = true;
            await this.startService();
        } else {
            this.isServiceEnabled = false;
        }
    }

    @action
    public enableService = async () => {
        if (this.isServiceEnabled) return;
        this.loading = true;
        try {
            const secret = generateSecretKey();
            this.walletServiceSecretKey = bytesToHex(secret);
            this.walletServicePubkey = getPublicKey(secret);

            await settingsStoreInstance.updateSettings({
                nwcService: {
                    ...settingsStoreInstance.settings.nwcService,
                    enabled: true,
                    secretKey: this.walletServiceSecretKey,
                    publicKey: this.walletServicePubkey,
                    relayUrl: settingsStoreInstance.settings.nwcService.relayUrl || DEFAULT_NWC_RELAY,
                }
            });
            await this.startService();
            this.isServiceEnabled = true;
            this.error = null;
        } catch (e: any) {
            console.error("Failed to enable NWC Service:", e);
            this.error = `Failed to enable NWC Service: ${e.message}`;
            this.isServiceEnabled = false;
        } finally {
            this.loading = false;
        }
    }

    @action
    public disableService = async () => {
        if (!this.isServiceEnabled) return;
        this.loading = true;
        try {
            this.stopService();
            await settingsStoreInstance.updateSettings({
                nwcService: {
                    ...settingsStoreInstance.settings.nwcService,
                    enabled: false,
                    // Optionally clear secretKey and publicKey for security,
                    // or keep them if user might re-enable with same keys.
                    // secretKey: undefined,
                    // publicKey: undefined,
                }
            });
            this.isServiceEnabled = false;
            this.serviceUri = null;
            this.error = null;
        } catch (e: any) {
            console.error("Failed to disable NWC Service:", e);
            this.error = `Failed to disable NWC Service: ${e.message}`;
        } finally {
            this.loading = false;
        }
    }

    @action
    private startService = async () => {
        if (!this.walletServiceSecretKey || !this.walletServicePubkey) {
            this.error = "NWC Service keys are not set.";
            return;
        }

        const relayUrl = settingsStoreInstance.settings.nwcService.relayUrl || DEFAULT_NWC_RELAY;
        this.walletService = new NWCWalletService({
            relayUrl,
        });

        // Publish wallet service info event (e.g., supported methods)
        // TODO: Define actual supported methods based on LND/Cashu capabilities
        const supportedMethods = ["get_info", "pay_invoice", "get_balance" /*, "lookup_invoice", etc. */];
        try {
            await this.walletService.publishWalletServiceInfoEvent(
                hexToBytes(this.walletServiceSecretKey),
                supportedMethods,
                [], // Assuming no notification types for now
            );
            console.info("NWC Service info event published.");

            // The NWC URL is generated per client connection request, not a single static one for the service itself.
            // This URI is a template or needs to be generated when a client wants to connect.
            // For now, let's store a template or a way to generate it.
            // A specific client secret needs to be generated for each NWC URL.
            // This part needs more thought on how clients will initiate pairing.
            // For now, we can log that the service is ready to accept connections.
            console.info(`NWC Service ready on relay: ${relayUrl} with pubkey: ${this.walletServicePubkey}`);
            this.serviceUri = `nostr+walletconnect://${this.walletServicePubkey}?relay=${relayUrl}&secret=CLIENT_SECRET_HERE`;


            // Example: Subscribing to a specific client (this would happen upon a client connection)
            // This is a placeholder for how you might handle individual client connections.
            // const clientPubkey = "some_client_pubkey_obtained_during_pairing";
            // const keypair = new NWCWalletServiceKeyPair(
            //     hexToBytes(this.walletServiceSecretKey),
            //     clientPubkey,
            // );
            // const unsub = await this.walletService.subscribe(keypair, {
            //     getInfo: this.handleGetInfo,
            //     payInvoice: this.handlePayInvoice,
            //     getBalance: this.handleGetBalance,
            //     // ... other handlers
            // });
            // this.activeSubscriptions.set(clientPubkey, unsub);

        } catch (e: any) {
            console.error("Error starting NWC service or publishing info:", e);
            this.error = `Error starting NWC service: ${e.message}`;
            this.walletService = null;
        }
    }

    private stopService = () => {
        if (this.walletService) {
            // Unsubscribe all active connections
            this.activeSubscriptions.forEach(unsub => unsub());
            this.activeSubscriptions.clear();

            this.walletService.close();
            this.walletService = null;
            console.info("NWC Service stopped.");
        }
    }

    // NIP-47 Method Handlers
    // These methods will need to interact with your LND or Cashu stores/logic

    private handleGetInfo = async () => {
        console.log("NWC: Received get_info request");
        try {
            await this.nodeInfoStore.getNodeInfo(); // Ensure nodeInfo is fresh
            const nodeInfo = this.nodeInfoStore.nodeInfo;
            const alias = nodeInfo?.alias || settingsStoreInstance.settings.nodes?.[settingsStoreInstance.settings.selectedNode || 0]?.nickname || "Zeus Wallet";
            const network = nodeInfo?.isTestNet ? "testnet" : nodeInfo?.isRegTest ? "regtest" : "mainnet";
            // block_height and block_hash might not be directly available or relevant for all node types in NodeInfo model
            // const block_height = nodeInfo?.block_height;
            // const block_hash = nodeInfo?.block_hash;

            return Promise.resolve({
                result: {
                    methods: ["get_info", "pay_invoice", "get_balance"], // Reflect actual capabilities
                    alias: alias,
                    color: "#FCE588", // Zeus yellow, can be customized
                    pubkey: this.walletServicePubkey,
                    network: network,
                    // block_height: block_height,
                    // block_hash: block_hash,
                },
                error: undefined,
            });
        } catch (e: any) {
            console.error("NWC: Error in get_info:", e);
            return Promise.resolve({
                error: { code: "INTERNAL", message: `Error fetching node info: ${e.message}` },
            });
        }
    }

    private handleGetBalance = async () => {
        console.log("NWC: Received get_balance request");
        try {
            // Assuming getLightningBalance fetches and sets the balance in the store
            await this.balanceStore.getLightningBalance(true, true); // set=true, reset=true to refresh
            const lightningBalanceSats = Number(this.balanceStore.lightningBalance) || 0;
            const balanceMsats = lightningBalanceSats * 1000;

            return Promise.resolve({
                result: {
                    balance: balanceMsats, // in msats
                    // TODO: Add max_amount and budget_renewal if applicable based on settings
                },
                error: undefined,
            });
        } catch (e: any) {
            console.error("NWC: Error in get_balance:", e);
            return Promise.resolve({
                error: { code: "INTERNAL", message: `Error fetching balance: ${e.message}` },
            });
        }
    }

    private handlePayInvoice = async (params: { invoice: string, amount?: number }) => {
        console.log("NWC: Received pay_invoice request", params);
        const { invoice, amount } = params; // NWC amount is in msat, TransactionsStore.sendPayment expects sats for 'amount' if not keysend

        if (!invoice) {
            return Promise.resolve({ error: { code: "INVALID_PARAMETER", message: "Missing invoice" } });
        }

        try {
            // TransactionsStore.sendPayment handles both bolt11 and keysend (pubkey + amount)
            // For NWC, 'amount' is optional for bolt11, but if provided, it's in msat.
            // sendPayment takes amount in sats.
            // If it's a keysend, the amount from NWC (msat) needs to be converted to sats for the 'amount' field of sendPayment.
            // If it's a BOLT11 invoice, the amount is usually encoded in the invoice itself.
            // The `sendPayment` interface in `TransactionsStore` might need adjustment or clarification
            // on how it handles amounts for BOLT11 vs keysend.
            // For now, we pass the invoice directly. If amount is for keysend, it should be handled by sendPayment.

            // Resetting payment state in transactionsStore before new payment
            this.transactionsStore.payment_preimage = null;
            this.transactionsStore.payment_error = null;
            this.transactionsStore.error_msg = null;
            this.transactionsStore.error = false;


            // The sendPayment method in TransactionStore is not async and uses .then().catch()
            // We need to wrap it in a Promise to use await here for cleaner flow.
            await new Promise<void>((resolve, reject) => {
                this.transactionsStore.sendPayment({
                    payment_request: invoice,
                    // amount: amount ? (amount / 1000).toString() : undefined, // Convert msat to sat if amount is present
                    // The `amount` field in `SendPaymentReq` is for keysend.
                    // If `invoice` is a BOLT11, `amount` here would be ignored or conflict.
                    // NWC `amount` is for BOLT11 if the invoice has amount 0.
                    // This needs careful handling based on invoice type.
                    // For simplicity, assuming `invoice` contains amount or is keysend handled by `sendPayment`.
                });

                // Poll for result or use a callback mechanism if sendPayment supports it.
                // Since sendPayment updates store observables, we can watch them.
                // This is a simplified polling approach. A more robust solution would use reactions or event emitters.
                const maxAttempts = 20; // Approx 10 seconds
                let attempts = 0;
                const interval = setInterval(() => {
                    attempts++;
                    if (this.transactionsStore.payment_preimage) {
                        clearInterval(interval);
                        resolve();
                    } else if (this.transactionsStore.payment_error || this.transactionsStore.error) {
                        clearInterval(interval);
                        reject(new Error(this.transactionsStore.payment_error || this.transactionsStore.error_msg || "Payment failed"));
                    } else if (attempts >= maxAttempts) {
                        clearInterval(interval);
                        reject(new Error("Payment timeout"));
                    }
                }, 500);
            });

            if (this.transactionsStore.payment_preimage) {
                return Promise.resolve({
                    result: {
                        preimage: this.transactionsStore.payment_preimage,
                    },
                    error: undefined,
                });
            } else {
                // Error should have been caught by the promise rejection
                return Promise.resolve({
                    error: { code: "PAYMENT_FAILED", message: this.transactionsStore.payment_error || this.transactionsStore.error_msg || "Payment failed without specific error" },
                });
            }
        } catch (e: any) {
            console.error("NWC: Error in pay_invoice:", e);
            return Promise.resolve({
                error: { code: "INTERNAL", message: e.message || `Error processing payment` },
            });
        }
    }

    // TODO: Add handlers for other methods like:
    // - lookup_invoice
    // - list_transactions
    // - make_invoice
    // - sign_message (if applicable)

    // Method to generate an NWC URI for a new client
    // This would typically be called when the user wants to pair a new client app.
    @action
    public generateNewClientUri = async (): Promise<string | null> => {
        if (!this.isServiceEnabled || !this.walletServicePubkey || !this.walletServiceSecretKey) {
            this.error = "NWC Service is not enabled or keys are missing.";
            console.error(this.error);
            return null;
        }
        this.loading = true;
        try {
            const clientSecretKeyBytes = generateSecretKey();
            const clientSecretKeyBytes = generateSecretKey();
            const clientSecretKeyHex = bytesToHex(clientSecretKeyBytes);
            const clientPubkeyHex = getPublicKey(clientSecretKeyBytes);

            const relayUrl = settingsStoreInstance.settings.nwcService.relayUrl || DEFAULT_NWC_RELAY;
            const nwcUrl = `nostr+walletconnect://${this.walletServicePubkey}?relay=${relayUrl}&secret=${clientSecretKeyHex}`;

            // Now, subscribe this new client to our service
            const keypair = new NWCWalletServiceKeyPair(
                hexToBytes(this.walletServiceSecretKey),
                clientPubkeyHex, // The public key of the client we just generated a secret for
            );

            const unsub = await this.walletService!.subscribe(keypair, {
                // Define methods the client can call
                get_info: this.handleGetInfo,
                get_balance: this.handleGetBalance,
                pay_invoice: this.handlePayInvoice,
                // TODO: Add other handlers like lookup_invoice, list_transactions, make_invoice
            });

            this.activeSubscriptions.set(clientPubkeyHex, unsub);
            console.log(`NWC: Subscribed new client: ${clientPubkeyHex.substring(0,10)}... URI: ${nwcUrl}`);
            this.error = null;
            return nwcUrl;
        } catch (e: any) {
            console.error("Failed to generate NWC client URI or subscribe:", e);
            this.error = `Failed to generate NWC URI: ${e.message}`;
            return null;
        } finally {
            this.loading = false;
        }
    }
}
