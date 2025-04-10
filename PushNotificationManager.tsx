import React, { useEffect, useRef } from 'react';
import { Alert, Platform, View } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import stores from './stores/Stores';

// Set default notification handler
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true
    })
});

const PushNotificationManager: React.FC<{ children: React.ReactNode }> = ({
    children
}) => {
    const notificationListener = useRef<Notifications.Subscription>();
    const responseListener = useRef<Notifications.Subscription>();

    useEffect(() => {
        registerDevice();
        registerNotificationEvents();

        // Handle initial notification if app was opened from killed state
        Notifications.getLastNotificationResponseAsync().then((response) => {
            if (response) {
                console.log(
                    'Initial notification response:',
                    response.notification.request.content // Access content here
                );
                // Handle the initial notification response here if needed (e.g., navigation)
            }
        });

        return () => {
            // Clean up listeners
            if (notificationListener.current) {
                Notifications.removeNotificationSubscription(
                    notificationListener.current
                );
            }
            if (responseListener.current) {
                Notifications.removeNotificationSubscription(
                    responseListener.current
                );
            }
        };
    }, []);

    const registerDevice = async () => {
        if (!Device.isDevice) {
            console.warn('Must use physical device for Push Notifications');
            return;
        }

        const { status: existingStatus } =
            await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }
        if (finalStatus !== 'granted') {
            console.warn('Failed to get push token permission for push notification!');
            // Optionally inform the user they need to enable permissions in settings
            return;
        }

        try {
            // Get the native device token (APNS on iOS, FCM on Android)
            const token = (await Notifications.getDevicePushTokenAsync()).data;
            console.log('Native Push Token Received:', token);
            // Ensure the store method is compatible with the native token format
            stores.lightningAddressStore.setDeviceToken(token);
        } catch (error) {
            console.error('Error getting native push token:', error);
            // Handle the error appropriately (e.g., show a message to the user)
        }

        // Setup Android channel (does nothing on iOS)
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX, // Or other importance level
                vibrationPattern: [0, 250, 250, 250], // Optional vibration pattern
                lightColor: '#FF231F7C' // Optional light color
            }).catch(err => console.warn("Failed to set notification channel:", err));
        }
    };

    const registerNotificationEvents = () => {
        // Listener for when a notification is received while the app is foregrounded
        notificationListener.current =
            Notifications.addNotificationReceivedListener((notification) => {
                console.log(
                    'Notification Received - Foreground:',
                    notification.request.content // Access content here
                );
                const content = notification.request.content;
                const data = content.data; // Custom data payload
                const title = content.title;
                const body = content.body;

                // Example: Check custom data payload for specific conditions
                // Adjust the condition based on your actual payload structure
                const isAutoRedeemNotification = JSON.stringify(data).includes(
                    'Redeem within the next 24 hours'
                );

                if (
                    stores.settingsStore.settings?.lightningAddress
                        ?.automaticallyAccept &&
                    isAutoRedeemNotification
                ) {
                    console.log('Auto-redeem enabled, skipping foreground alert/action.');
                    // The default handler already decided if a system notification should show.
                    // You might perform background actions here if needed.
                    return;
                }

                // If not auto-redeeming, you might want to show an in-app alert
                // or update UI based on the notification content.
                // Note: The system notification might still be shown based on the handler set earlier.
                Alert.alert(title ?? 'Notification', body ?? '', [
                    { text: 'OK', onPress: () => console.log('OK Pressed') }
                ]);
            });

        // Listener for when a user taps on or interacts with a notification
        // (works when app is foregrounded, backgrounded, or killed)
        responseListener.current =
            Notifications.addNotificationResponseReceivedListener(
                (response) => {
                    console.log(
                        'Notification opened by device user:',
                        response.notification.request.content // Access content here
                    );
                    console.log(
                        `Notification opened with action identifier: ${response.actionIdentifier}`
                    );
                    // Handle notification tap here (e.g., navigate to a specific screen based on response.notification.request.content.data)
                }
            );
    };

    // Render children within a View
    return <View style={{ flex: 1 }}>{children}</View>;
};

export default PushNotificationManager;
