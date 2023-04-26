import React, { useState, useEffect, useCallback } from 'react';
import {
    Dimensions,
    StyleSheet,
    Text,
    View,
    Platform,
    TouchableOpacity,
    PermissionsAndroid
} from 'react-native';
import { Camera } from 'react-native-camera-kit';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { launchImageLibrary } from 'react-native-image-picker';

const LocalQRCode = require('@remobile/react-native-qrcode-local-image');

import Button from './../components/Button';

import { localeString } from './../utils/LocaleUtils';

import FlashOffIcon from './../assets/images/SVG/Flash Off.svg';
import FlashOnIcon from './../assets/images/SVG/Flash On.svg';
import GalleryIcon from './../assets/images/SVG/Gallery.svg';
import ScanFrameSvg from './../assets/images/SVG/DynamicSVG/ScanFrameSvg';

const createHash = require('create-hash');

interface QRProps {
    text?: string;
    handleQRScanned: any;
    goBack: any;
    navigation: any;
}

const CameraAuthStatus = Object.freeze({
    AUTHORIZED: 'AUTHORIZED',
    NOT_AUTHORIZED: 'NOT_AUTHORIZED',
    UNKNOWN: 'UNKNOWN'
});

const QRCodeScanner = ({
    text,
    handleQRScanned,
    goBack,
    navigation
}: QRProps) => {
    const [cameraStatus, setCameraStatus] = useState(CameraAuthStatus.UNKNOWN);
    const [isTorchOn, setIsTorchOn] = useState(false);
    const [scannedCache, setScannedCache] = useState({});

    const maskLength = (Dimensions.get('window').width * 80) / 100;

    const handleRead = useCallback((data: any) => {
        const hash = createHash('sha256').update(data).digest().toString('hex');
        if (scannedCache[hash]) {
            // this QR was already scanned let's prevent firing duplicate
            // callbacks
            return;
        }
        setScannedCache((cache) => ({ ...cache, [hash]: +new Date() }));
        handleQRScanned(data);
    }, []);

    const handleOpenGallery = useCallback(() => {
        launchImageLibrary(
            {
                mediaType: 'photo'
            },
            (response) => {
                if (!response.didCancel) {
                    const asset = response.assets[0];
                    if (asset.uri) {
                        const uri = asset.uri.toString().replace('file://', '');
                        LocalQRCode.decode(uri, (error: any, result: any) => {
                            if (!error) {
                                handleRead(result);
                            }
                        });
                    }
                }
            }
        );
    }, []);

    const onQRCodeScan = (event: { nativeEvent: { codeStringValue: any } }) => {
        handleRead(event.nativeEvent.codeStringValue);
    };

    const toggleTorch = async () => {
        try {
            setIsTorchOn((prevState) => !prevState);
        } catch (error) {
            console.log('Error toggling torch: ', error);
        }
    };

    // componentDidMount
    useEffect(() => {
        // triggers when loaded from navigation or back action
        const listener = navigation.addListener('didFocus', () => {
            setScannedCache({});
        });

        (async function handleCameraPermissions() {
            if (Platform.OS !== 'ios' && Platform.OS !== 'macos') {
                // For Android
                // Returns true or false
                const permissionAndroid = await PermissionsAndroid.check(
                    'android.permission.CAMERA'
                );
                if (permissionAndroid) {
                    setCameraStatus(CameraAuthStatus.AUTHORIZED);
                } else
                    try {
                        const granted = await PermissionsAndroid.request(
                            PermissionsAndroid.PERMISSIONS.CAMERA,
                            {
                                title: localeString(
                                    'components.QRCodeScanner.cameraPermissionTitle'
                                ),
                                message: localeString(
                                    'components.QRCodeScanner.cameraPermission'
                                ),
                                buttonNegative: localeString('general.cancel'),
                                buttonPositive: localeString('general.ok')
                            }
                        );
                        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                            setCameraStatus(CameraAuthStatus.AUTHORIZED);
                        } else {
                            setCameraStatus(CameraAuthStatus.NOT_AUTHORIZED);
                        }
                    } catch (err) {
                        console.warn(err);
                    }

                return;
            }
            // Camera permission for IOS
            else {
                const cameraPermission = PERMISSIONS.IOS.CAMERA;
                const status = await check(cameraPermission);

                if (status === RESULTS.GRANTED) {
                    setCameraStatus(CameraAuthStatus.AUTHORIZED);
                } else if (status === RESULTS.DENIED) {
                    const result = await request(cameraPermission);

                    if (result === RESULTS.GRANTED) {
                        setCameraStatus(CameraAuthStatus.AUTHORIZED);
                    } else {
                        setCameraStatus(CameraAuthStatus.NOT_AUTHORIZED);
                    }
                } else {
                    setCameraStatus(CameraAuthStatus.NOT_AUTHORIZED);
                }
            }
        })();

        return () => {
            // componentWillUnmount
            listener && listener.remove();
        };
    }, []);

    return (
        <>
            {cameraStatus === CameraAuthStatus.AUTHORIZED && (
                <View
                    style={{
                        flex: 1
                    }}
                >
                    <Camera
                        style={styles.preview}
                        scanBarcode={true}
                        torchMode={isTorchOn ? 'on' : 'off'}
                        onReadCode={onQRCodeScan}
                        focusMode="off"
                    />
                    <View style={styles.actionOverlay}>
                        <TouchableOpacity
                            style={styles.flashButton}
                            onPress={toggleTorch}
                        >
                            {isTorchOn ? (
                                <FlashOnIcon width={35} height={35} />
                            ) : (
                                <FlashOffIcon width={35} height={35} />
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleOpenGallery}>
                            <GalleryIcon width={50} height={50} />
                        </TouchableOpacity>
                    </View>
                    {text !== undefined && (
                        <Text style={styles.textOverlay}>{text}</Text>
                    )}
                    <View
                        style={{
                            position: 'absolute',
                            top:
                                (Dimensions.get('window').height - maskLength) /
                                2,
                            alignSelf: 'center',
                            height: maskLength
                        }}
                    >
                        <View style={styles.scan}>
                            <ScanFrameSvg height="100%" />
                        </View>
                    </View>
                    <View style={styles.cancelOverlay}>
                        <Button
                            title={localeString('general.cancel')}
                            onPress={() => goBack()}
                            iconOnly
                            noUppercase
                        />
                    </View>
                </View>
            )}

            {cameraStatus === CameraAuthStatus.NOT_AUTHORIZED && (
                <View style={styles.content}>
                    <Text
                        style={{
                            fontFamily: 'Lato-Regular',
                            textAlign: 'center',
                            padding: 15
                        }}
                    >
                        {localeString(
                            'components.QRCodeScanner.noCameraAccess'
                        )}
                    </Text>
                    <Button
                        title={localeString('general.goBack')}
                        onPress={() => goBack()}
                        secondary
                        containerStyle={{ width: 200 }}
                        adaptiveWidth
                    />
                </View>
            )}
        </>
    );
};

const styles = StyleSheet.create({
    preview: {
        flex: 1
    },
    flashButton: {
        marginTop: 8,
        marginRight: 5
    },
    scan: {
        margin: 0
    },
    actionOverlay: {
        flexDirection: 'row',
        position: 'absolute',
        right: 10,
        top: 44
    },

    textOverlay: {
        backgroundColor: 'rgba(0,0,0,0.5)',
        color: 'white',
        textAlign: 'center',
        fontSize: 15
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    cancelOverlay: {
        position: 'absolute',
        width: '100%',
        bottom: 60
    }
});

export default QRCodeScanner;
