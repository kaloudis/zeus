import React, { Component } from 'react';
import { View, ScrollView, Alert, Share, Clipboard } from 'react-native';
import { observer, inject } from 'mobx-react';
import { StackNavigationProp } from '@react-navigation/stack';

import SettingsStore, { Node } from '../../stores/SettingsStore';
import NWCStore from '../../stores/NWCStore';
import ModalStore from '../../stores/ModalStore';

import { localeString } from '../../utils/LocaleUtils';
import { showToast } from '../../utils/ToastUtils';

import Header from '../../components/Header';
import Switch from '../../components/Switch';
import Input from '../../components/Input';
import Button from '../../components/Button';
import Text from '../../components/Text';
import ListItem from '../../components/ListItem';
import Loading from '../../components/Loading';
import Screen from '../../components/Screen';

interface NWCServiceProps {
    navigation: StackNavigationProp<any, any>;
    SettingsStore: SettingsStore;
    NWCStore: NWCStore;
    ModalStore: ModalStore;
}

@inject('SettingsStore', 'NWCStore', 'ModalStore')
@observer
class NWCService extends Component<NWCServiceProps> {
    state = {
        relayUrl: this.props.SettingsStore.settings.nwcService.relayUrl,
        generatingClientUri: false,
    };

    componentDidMount() {
        // Ensure relayUrl in state is updated if store changes externally
        // or if component remounts after store has been initialized
        runInAction(() => {
            this.setState({ relayUrl: this.props.SettingsStore.settings.nwcService.relayUrl || DEFAULT_NWC_RELAY });
        });
    }

    handleToggleService = async (value: boolean) => {
        const { NWCStore } = this.props;
        if (value) {
            await NWCStore.enableService();
            if (NWCStore.error) {
                Alert.alert('Error Enabling NWC', NWCStore.error);
            } else {
                showToast(localeString('views.Settings.NWCService.serviceEnabled'));
                // Update relayUrl in state after enabling, in case it was default
                this.setState({ relayUrl: this.props.SettingsStore.settings.nwcService.relayUrl });
            }
        } else {
            Alert.alert(
                localeString('views.Settings.NWCService.disableServiceTitle'),
                localeString('views.Settings.NWCService.disableServiceMessage'),
                [
                    { text: localeString('common.cancel'), style: 'cancel' },
                    {
                        text: localeString('common.disable'),
                        style: 'destructive',
                        onPress: async () => {
                            await NWCStore.disableService();
                            if (NWCStore.error) {
                                Alert.alert('Error Disabling NWC', NWCStore.error);
                            } else {
                                showToast(localeString('views.Settings.NWCService.serviceDisabled'));
                            }
                        },
                    },
                ],
            );
        }
    };

    handleRelayUrlChange = (text: string) => {
        this.setState({ relayUrl: text });
    };

    handleSaveRelayUrl = async () => {
        const { SettingsStore, NWCStore } = this.props;
        const { relayUrl } = this.state;
        // Ensure relayUrl is not empty, fallback to default if it is
        const urlToSave = relayUrl.trim() === '' ? DEFAULT_NWC_RELAY : relayUrl;

        await SettingsStore.updateSettings({
            nwcService: {
                ...SettingsStore.settings.nwcService,
                relayUrl: urlToSave,
            },
        });
        // If service is active, restart it to apply new relay
        if (NWCStore.isServiceEnabled) {
            showToast(localeString('views.Settings.NWCService.restartingServiceWithNewRelay'));
            await NWCStore.disableService(); // Stop with old settings
            await NWCStore.enableService();  // Start with new settings
            if (NWCStore.error) {
                 Alert.alert(localeString('views.Settings.NWCService.errorRestartingService'), NWCStore.error);
            }
        }
        showToast(localeString('views.Settings.NWCService.relayUrlUpdated'));
        // Update state in case it was changed (e.g. fallback to default)
        this.setState({ relayUrl: urlToSave });
    };

    handleGenerateClientUri = async () => {
        const { NWCStore, ModalStore } = this.props;
        this.setState({ generatingClientUri: true });
        const clientUri = await NWCStore.generateNewClientUri();
        this.setState({ generatingClientUri: false });

        if (clientUri) {
            ModalStore.showAlertModal = true;
            ModalStore.infoModalTitle = localeString('views.Settings.NWCService.newClientUriTitle');
            ModalStore.infoModalText = `${localeString('views.Settings.NWCService.newClientUriMessage')}\n\n${clientUri}`;
            ModalStore.clipboardValue = clientUri; // For copy button in modal
        } else if (NWCStore.error) {
            Alert.alert(localeString('views.Settings.NWCService.errorGeneratingUri'), NWCStore.error);
        }
    };

    copyToClipboard = (value: string, message: string) => {
        if (!value) return;
        Clipboard.setString(value);
        showToast(message);
    };

    render() {
        const { SettingsStore, NWCStore, navigation } = this.props;
        const { nwcService } = SettingsStore.settings;
        const { relayUrl, generatingClientUri } = this.state;
        const serviceEnabled = NWCStore.isServiceEnabled;

        const activeNode: Node | undefined = SettingsStore.settings.nodes?.[SettingsStore.settings.selectedNode || 0];
        // NWC is primarily for LND or Cashu backends that can make payments.
        // Other backends might not support the required actions.
        const isCompatibleBackend = activeNode?.implementation === 'embedded-lnd' ||
                                   activeNode?.implementation === 'lnd' ||
                                   activeNode?.implementation === 'cln-rest' || // Assuming CLN can also be made to work
                                   SettingsStore.settings.ecash.enableCashu;


        if (!isCompatibleBackend && !serviceEnabled) {
             return (
                <Screen>
                    <Header
                        title={localeString('views.Settings.NWCService.title')}
                        onBack={() => navigation.goBack()}
                    />
                    <View style={{ padding: 16, alignItems: 'center', flex: 1, justifyContent: 'center' }}>
                        <Text style={{textAlign: 'center'}}>
                            {localeString('views.Settings.NWCService.notAvailableForNode')}
                        </Text>
                         <Text note style={{textAlign: 'center', marginTop: 8}}>
                            {localeString('views.Settings.NWCService.switchToCompatibleBackend')}
                        </Text>
                    </View>
                </Screen>
            );
        }


        return (
            <Screen>
                <Header
                    title={localeString('views.Settings.NWCService.title')}
                    onBack={() => navigation.goBack()}
                />
                <ScrollView keyboardShouldPersistTaps="handled">
                    {(NWCStore.loading || SettingsStore.settingsUpdateInProgress) && <Loading text={NWCStore.loading ? localeString('common.loading') : localeString('common.saving')} />}
                    <ListItem
                        title={localeString('views.Settings.NWCService.enableService')}
                        rightItem={
                            <Switch
                                value={serviceEnabled}
                                onValueChange={this.handleToggleService}
                                disabled={NWCStore.loading || SettingsStore.settingsUpdateInProgress}
                            />
                        }
                    />
                    {serviceEnabled && (
                        <>
                            <Input
                                label={localeString('views.Settings.NWCService.relayUrl')}
                                value={relayUrl}
                                onChangeText={this.handleRelayUrlChange}
                                onBlur={this.handleSaveRelayUrl}
                                placeholder="wss://relay.example.com"
                                autoCapitalize="none"
                                keyboardType="url"
                                disabled={NWCStore.loading || SettingsStore.settingsUpdateInProgress}
                            />
                            {NWCStore.walletServicePubkey && ( // Use NWCStore.walletServicePubkey directly
                                <View style={{ marginHorizontal: 16, marginVertical: 8 }}>
                                     <Text bold>{localeString('views.Settings.NWCService.servicePublicKey')}:</Text>
                                     <Text selectable>{NWCStore.walletServicePubkey}</Text>
                                     <Button
                                        title={localeString('views.Settings.NWCService.copyServicePublicKey')}
                                        onPress={() => this.copyToClipboard(NWCStore.walletServicePubkey || '', localeString('views.Settings.NWCService.publicKeyCopied'))}
                                        small
                                        style={{marginTop: 8}}
                                        disabled={NWCStore.loading || SettingsStore.settingsUpdateInProgress}
                                    />
                                </View>
                            )}
                            <View style={{ marginHorizontal: 16, marginVertical: 20 }}>
                                <Button
                                    title={localeString('views.Settings.NWCService.generateClientUri')}
                                    onPress={this.handleGenerateClientUri}
                                    loading={generatingClientUri}
                                    disabled={generatingClientUri || NWCStore.loading || SettingsStore.settingsUpdateInProgress}
                                />
                                <Text note style={{marginTop: 8, textAlign: 'center'}}>
                                    {localeString('views.Settings.NWCService.generateClientUriNote')}
                                </Text>
                            </View>
                        </>
                    )}
                    {NWCStore.error && (
                        <View style={{ padding: 16 }}>
                            <Text error>{NWCStore.error}</Text>
                        </View>
                    )}
                     {!isCompatibleBackend && serviceEnabled && (
                        <View style={{ padding: 16, alignItems: 'center', marginTop: 10, backgroundColor: themeColor('warningBackground') }}>
                            <Text warning style={{textAlign: 'center'}}>
                                {localeString('views.Settings.NWCService.warningIncompatibleBackend')}
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </Screen>
        );
    }
}

// Make sure DEFAULT_NWC_RELAY is accessible or defined here if not imported
const DEFAULT_NWC_RELAY = 'wss://relay.getalby.com/v1';

export default NWCService;
