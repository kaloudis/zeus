import * as React from 'react';
import { Keyboard, TouchableOpacity, View } from 'react-native';
import EncryptedStorage from 'react-native-encrypted-storage';
import { inject, observer } from 'mobx-react';
import { Route } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import Header from '../components/Header';
import Screen from '../components/Screen';
import Button from '../components/Button';

import { localeString } from '../utils/LocaleUtils';
import { themeColor } from '../utils/ThemeUtils';

import NotesStore from '../stores/NotesStore';
import TextInput from '../components/TextInput';

import SaveIcon from '../assets/images/SVG/Save.svg';

interface AddNotesProps {
    navigation: NativeStackNavigationProp<any, any>;
    NotesStore: NotesStore;
    route: Route<
        'AddNotes',
        { payment_hash: string; txid: string; getRPreimage: string }
    >;
}
interface AddNotesState {
    notes?: string;
    payment_hash?: string;
    txid?: string;
    getRPreimage?: string;
    isNoteStored?: boolean;
}

@inject('NotesStore')
@observer
export default class AddNotes extends React.Component<
    AddNotesProps,
    AddNotesState
> {
    constructor(props: any) {
        super(props);
        const { payment_hash, txid, getRPreimage } =
            this.props.route.params ?? {};

        this.state = {
            notes: '',
            payment_hash,
            txid,
            getRPreimage,
            isNoteStored: false
        };
    }
    async componentDidMount() {
        const key: string =
            'note-' +
            (this.state.txid ||
                this.state.payment_hash ||
                this.state.getRPreimage);
        const storedNotes = await EncryptedStorage.getItem(key);
        if (storedNotes) {
            this.setState({ notes: storedNotes, isNoteStored: true });
        }
    }

    render() {
        const { navigation, NotesStore } = this.props;
        const { storeNoteKeys, removeNoteKeys } = NotesStore;
        const { payment_hash, txid, getRPreimage, isNoteStored } = this.state;
        const { notes } = this.state;

        const saveNote = async () => {
            const key: string =
                'note-' + (payment_hash || txid || getRPreimage);
            EncryptedStorage.setItem(key, notes);
            await storeNoteKeys(key, notes);
            navigation.goBack();
        };

        const SaveButton = () => (
            <TouchableOpacity onPress={() => saveNote()}>
                <SaveIcon
                    stroke={themeColor('text')}
                    fill={themeColor('text')}
                    height={40}
                    width={40}
                />
            </TouchableOpacity>
        );
        return (
            <Screen>
                <View
                    style={{
                        flexDirection: 'column',
                        height: '100%'
                    }}
                >
                    <Header
                        leftComponent="Back"
                        centerComponent={{
                            text: isNoteStored
                                ? localeString(
                                      'views.SendingLightning.UpdateNote'
                                  )
                                : localeString(
                                      'views.SendingLightning.AddANote'
                                  ),
                            style: {
                                color: themeColor('text'),
                                fontFamily: 'PPNeueMontreal-Book',
                                fontSize: 20
                            }
                        }}
                        rightComponent={SaveButton}
                        navigation={navigation}
                    />
                    <TextInput
                        onChangeText={(text: string) => {
                            this.setState({ notes: text });
                            if (!text) {
                                const key: string =
                                    'note-' +
                                    (payment_hash || txid || getRPreimage);
                                removeNoteKeys(key);
                            }
                        }}
                        multiline
                        numberOfLines={0}
                        style={{
                            padding: 20,
                            flexGrow: 1,
                            flexShrink: 1,
                            backgroundColor: 'none'
                        }}
                        textInputStyle={{
                            height: '100%',
                            textAlignVertical: 'top',
                            marginTop: -13
                        }}
                        value={notes}
                        placeholder={localeString('views.Payment.writeNote')}
                        onSubmitEditing={() => Keyboard.dismiss()}
                    />
                    <View
                        style={{
                            marginHorizontal: 20,
                            marginBottom: 20,
                            marginTop: 10
                        }}
                    >
                        <Button
                            title={localeString(
                                'views.Settings.SetPassword.save'
                            )}
                            onPress={() => saveNote()}
                            buttonStyle={{
                                padding: 15
                            }}
                        />
                    </View>
                </View>
            </Screen>
        );
    }
}
