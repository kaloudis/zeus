import { observable, runInAction, action } from 'mobx';
import { generateSecretKey, getPublicKey } from 'nostr-tools';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';
import { NWCWalletService, NWCWalletServiceKeyPair } from '@alby/js-sdk'; // Assuming js-sdk is installed

import settingsStore from './SettingsStore'; // To access NWC settings and wallet details
// Import other necessary stores or utils for payment processing (LND, Cashu)
// e.g. import lndStore from './LndStore';
// e.g. import cashuStore from './CashuStore';

const DEFAULT_NWC_RELAY = 'wss://relay.getalby.com/v1';

export default class NWCStore {
    @observable public isServiceEnabled: boolean = false;
    @observable public serviceUri: string | null = null;
    @observable public error: string | null = null;
    @observable public_loading: boolean = false;

    private walletService: NWCWalletService | null = null;
    private walletServiceSecretKey: string | null = null;
    private walletServicePubkey: string | null = null;
    // Store active subscriptions/keypairs if needed
    private activeSubscriptions: Map<string, () => void> = new Map();


    constructor() {
        this.initializeFromSettings();
    }

    @action
    private initializeFromSettings = async () => {
        const { nwcService } = settingsStore.settings;
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

            await settingsStore.updateSettings({
                nwcService: {
                    ...settingsStore.settings.nwcService,
                    enabled: true,
                    secretKey: this.walletServiceSecretKey,
                    publicKey: this.walletServicePubkey,
                    relayUrl: settingsStore.settings.nwcService.relayUrl || DEFAULT_NWC_RELAY,
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
            await settingsStore.updateSettings({
                nwcService: {
                    ...settingsStore.settings.nwcService,
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

        const relayUrl = settingsStore.settings.nwcService.relayUrl || DEFAULT_NWC_RELAY;
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
        // TODO: Implement based on currently connected node (LND/Cashu)
        // const alias = settingsStore.settings.nodes[settingsStore.settings.selectedNode]?.nickname || "Zeus Wallet";
        // const balance = await lndStore.getBalance(); // or cashuStore.totalBalanceSats
        return Promise.resolve({
            result: {
                methods: ["get_info", "pay_invoice", "get_balance"], // Reflect actual capabilities
                alias: "Zeus Wallet", // TODO: Make dynamic
                // color: "#yourbrandcolor",
                // pubkey: this.walletServicePubkey,
                // network: settingsStore.settings.nodes[settingsStore.settings.selectedNode]?.embeddedLndNetwork || "mainnet", // TODO: Make dynamic
                // block_height: lndStore.blockHeight, // TODO
                // block_hash: lndStore.blockHash, // TODO
            },
            error: undefined,
        });
    }

    private handleGetBalance = async () => {
        console.log("NWC: Received get_balance request");
        try {
            // TODO: Implement based on currently connected node (LND/Cashu)
            // This is a placeholder. You'll need to fetch the actual balance.
            // For LND: const balance = await lndStore.getWalletBalance(); // or similar
            // For Cashu: const balance = cashuStore.totalBalanceSats;
            const placeholderBalanceMsats = 100000 * 1000; // Example: 100,000 sats
            return Promise.resolve({
                result: {
                    balance: placeholderBalanceMsats, // in msats
                    // max_amount: 1000000, // in sats, optional
                    // budget_renewal: "daily" // optional
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
        const { invoice, amount } = params; // amount is in msat

        if (!invoice) {
            return Promise.resolve({ error: { code: "INVALID_PARAMETER", message: "Missing invoice" } });
        }

        try {
            // TODO: Implement payment logic using LNDStore or CashuStore
            // This is a placeholder.
            // Example for LND:
            // const paymentResult = await lndStore.sendPayment(invoice);
            // if (paymentResult.payment_error) {
            //    return Promise.resolve({ error: { code: "PAYMENT_FAILED", message: paymentResult.payment_error } });
            // }
            // return Promise.resolve({ result: { preimage: paymentResult.payment_preimage } });

            // Placeholder success:
            const placeholderPreimage = bytesToHex(generateSecretKey()); // Just a random hex string
            console.log(`NWC: Mock payment success for invoice ${invoice.substring(0, 20)}...`);
            return Promise.resolve({
                result: {
                    preimage: placeholderPreimage,
                },
                error: undefined,
            });

        } catch (e: any) {
            console.error("NWC: Error in pay_invoice:", e);
            return Promise.resolve({
                error: { code: "INTERNAL", message: `Error processing payment: ${e.message}` },
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
            const clientSecretKeyHex = bytesToHex(clientSecretKeyBytes);
            const clientPubkeyHex = getPublicKey(clientSecretKeyBytes);

            const relayUrl = settingsStore.settings.nwcService.relayUrl || DEFAULT_NWC_RELAY;
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
