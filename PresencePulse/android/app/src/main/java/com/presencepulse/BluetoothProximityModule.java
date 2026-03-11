package com.presencepulse;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.content.Context;
import android.content.pm.PackageManager;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import java.util.HashSet;
import java.util.Set;

public class BluetoothProximityModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "BluetoothProximityModule";
    private final ReactApplicationContext reactContext;
    private BluetoothAdapter bluetoothAdapter;
    private BluetoothLeScanner bluetoothLeScanner;
    private final Set<String> nearbyDevices = new HashSet<>();
    private boolean isScanning = false;

    public BluetoothProximityModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        BluetoothManager bluetoothManager = (BluetoothManager) reactContext.getSystemService(Context.BLUETOOTH_SERVICE);
        if (bluetoothManager != null) {
            bluetoothAdapter = bluetoothManager.getAdapter();
        }
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void getNearbyDeviceCount(Promise promise) {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled()) {
            resolveWithCount(0, promise);
            return;
        }

        if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.BLUETOOTH_SCAN) != PackageManager.PERMISSION_GRANTED) {
             if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                 resolveWithCount(0, promise);
                 return;
             }
        }

        bluetoothLeScanner = bluetoothAdapter.getBluetoothLeScanner();
        if (bluetoothLeScanner == null) {
            resolveWithCount(0, promise);
            return;
        }

        if (isScanning) {
            resolveWithCount(nearbyDevices.size(), promise);
            return;
        }

        nearbyDevices.clear();
        isScanning = true;

        ScanCallback scanCallback = new ScanCallback() {
            @Override
            public void onScanResult(int callbackType, ScanResult result) {
                if (result.getDevice() != null && result.getRssi() > -75) {
                    nearbyDevices.add(result.getDevice().getAddress());
                }
            }
        };

        try {
            bluetoothLeScanner.startScan(scanCallback);
            
            // Step 1 requirement: Scan duration = 3 seconds
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                if (isScanning) {
                    try {
                        bluetoothLeScanner.stopScan(scanCallback);
                    } catch (SecurityException e) {
                        // Ignore
                    }
                    isScanning = false;
                    resolveWithCount(nearbyDevices.size(), promise);
                }
            }, 3000);
            
        } catch (SecurityException e) {
            isScanning = false;
            resolveWithCount(0, promise);
        }
    }

    private void resolveWithCount(int count, Promise promise) {
        WritableMap map = Arguments.createMap();
        map.putInt("deviceCount", count);
        map.putBoolean("isSocialContext", count >= 2);
        promise.resolve(map);
    }
}
