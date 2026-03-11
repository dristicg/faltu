import { NativeModules, PermissionsAndroid, Platform } from 'react-native';

const { BluetoothProximityModule } = NativeModules;

export const requestBluetoothPermissions = async () => {
    if (Platform.OS !== 'android') return false;

    try {
        if (Platform.Version >= 31) {
            const granted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            ]);
            return (
                granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED &&
                granted[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED &&
                granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
            );
        } else {
            const granted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
            ]);
            return (
                granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED &&
                granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] === PermissionsAndroid.RESULTS.GRANTED
            );
        }
    } catch (err) {
        console.warn('[PresencePulse] Bluetooth permission error:', err);
        return false;
    }
};

export const checkSocialContext = async () => {
    if (!BluetoothProximityModule) {
        console.warn('[PresencePulse] BluetoothProximityModule is not available');
        return { deviceCount: 0, isSocialContext: false };
    }

    try {
        const hasPermission = await requestBluetoothPermissions();
        if (!hasPermission) {
            console.warn('[PresencePulse] Lacking Bluetooth permissions');
            return { deviceCount: 0, isSocialContext: false };
        }

        const result = await BluetoothProximityModule.getNearbyDeviceCount();
        console.log(`[PresencePulse] Nearby devices: ${result.deviceCount}`);
        if (result.isSocialContext) {
            console.log(`[PresencePulse] Social context detected`);
        }
        return result;
    } catch (error) {
        console.warn('[PresencePulse] Error checking social context:', error);
        return { deviceCount: 0, isSocialContext: false };
    }
};
