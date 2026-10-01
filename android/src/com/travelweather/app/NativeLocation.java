package com.travelweather.app;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
import android.os.CancellationSignal;
import java.util.ArrayList;
import java.util.List;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import org.json.JSONObject;

/** One foreground fix. All provider operations and cleanup run on the main thread. */
final class NativeLocation implements LocationListener {
    private final Activity activity;
    private final LocationManager manager;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final CountDownLatch done = new CountDownLatch(1);
    private final boolean fresh;
    private Location best;
    private final List<CancellationSignal> currentRequests = new ArrayList<>();
    private float immediateAccuracy() {
        return activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ? 3000f : 10000f;
    }
    private volatile String result;
    private boolean finished, started;
    private long startedAt;
    private final Runnable poll = new Runnable() { @Override public void run() {
        if (finished) return;
        for (String provider : new String[]{"fused", LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER}) {
            try {
                Location cached = manager.getLastKnownLocation(provider);
                consider(cached);
                if (usable(cached, fresh ? 15000L : 60000L, immediateAccuracy())) { succeed(cached); return; }
            } catch (IllegalArgumentException | SecurityException ignored) { }
        }
        handler.postDelayed(this, 2000L);
    } };
    private final Runnable enhanceFusion = new Runnable() { @Override public void run() {
        if (!finished) {
            // Escalate the fused provider too: network/GNSS selection remains the system's job.
            requestProvider("fused", true);
        }
    } };
    private final Runnable timeout = new Runnable() { @Override public void run() { completeBest(); } };

    NativeLocation(Activity activity, boolean fresh) {
        this.activity = activity;
        this.fresh = fresh;
        manager = (LocationManager) activity.getSystemService(Activity.LOCATION_SERVICE);
    }
    boolean hasPermission() {
        return activity.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }
    void start() {
        if (finished || started) return;
        started=true;
        startedAt=SystemClock.elapsedRealtime();
        android.util.Log.d("TravelWeatherLocation", "Foreground fix started; fresh=" + fresh
            + "; finePermission=" + (activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED));
        if (!hasPermission()) { fail("permission", "请在应用权限中允许使用位置信息"); return; }
        if (manager == null) { fail("unavailable", "设备定位服务暂不可用"); return; }
        // Read recent fixes first, without activating a satellite request.
        for (String provider : new String[]{"fused", LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER}) {
            try {
                if (manager.isProviderEnabled(provider)) consider(manager.getLastKnownLocation(provider));
            } catch (IllegalArgumentException | SecurityException ignored) { }
        }
        if (usable(best, fresh ? 15000L : 60000L, immediateAccuracy())) { succeed(best); return; }
        int active = 0;
        if (requestProvider("fused", false)) active++;
        if (requestProvider(LocationManager.NETWORK_PROVIDER, false)) active++;
        // Start GNSS alongside network/fused; do not spend the first seconds waiting
        // for a network provider that may be unavailable on this device.
        if (requestProvider(LocationManager.GPS_PROVIDER, true)) active++;
        if (active == 0) {
            fail("unavailable", "系统定位暂不可用，请检查定位开关与应用权限"); return;
        }
        // Keep all registered sources alive: any acceptable fix ends the request.
        handler.postDelayed(enhanceFusion, 5000L);
        handler.postDelayed(timeout, 45000L);
        handler.postDelayed(poll, 2000L);
    }
    private boolean requestProvider(String provider, boolean satellite) {
        if (LocationManager.GPS_PROVIDER.equals(provider) && activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) return false;
        try {
            if (!manager.isProviderEnabled(provider)) {
                android.util.Log.d("TravelWeatherLocation", "Provider disabled: " + provider);
                return false;
            }
            android.util.Log.d("TravelWeatherLocation", "Request provider=" + provider + "; enhanced=" + satellite);
            if (android.os.Build.VERSION.SDK_INT >= 31) {
                android.location.LocationRequest request = new android.location.LocationRequest.Builder(2000L)
                    .setQuality(satellite ? android.location.LocationRequest.QUALITY_HIGH_ACCURACY : android.location.LocationRequest.QUALITY_BALANCED_POWER_ACCURACY)
                    .setMinUpdateIntervalMillis(2000L).setDurationMillis(45000L).build();
                manager.requestLocationUpdates(provider, request, activity.getMainExecutor(), this);
                requestCurrent(provider, request);
            } else {
                manager.requestLocationUpdates(provider, 2000L, 0f, this, Looper.getMainLooper());
                if (android.os.Build.VERSION.SDK_INT >= 30) requestCurrent(provider, null);
            }
            return true;
        } catch (IllegalArgumentException | SecurityException error) {
            android.util.Log.w("TravelWeatherLocation", "Provider request rejected: " + provider + " (" + error.getClass().getSimpleName() + ")");
            return false;
        }
    }
    private void requestCurrent(String provider, android.location.LocationRequest request) {
        CancellationSignal cancellation = new CancellationSignal();
        currentRequests.add(cancellation);
        try {
            java.util.function.Consumer<Location> callback = new java.util.function.Consumer<Location>() {
                @Override public void accept(Location location) {
                    if (!finished && location != null) onLocationChanged(location);
                    else if (!finished) android.util.Log.d("TravelWeatherLocation", "Current fix returned null: " + provider);
                }
            };
            if (android.os.Build.VERSION.SDK_INT >= 31)
                manager.getCurrentLocation(provider, request, cancellation, activity.getMainExecutor(), callback);
            else if (android.os.Build.VERSION.SDK_INT >= 30)
                manager.getCurrentLocation(provider, cancellation, activity.getMainExecutor(), callback);
        } catch (IllegalArgumentException | SecurityException error) {
            cancellation.cancel();
            // Continuous updates remain active if a provider rejects its one-shot API.
            android.util.Log.w("TravelWeatherLocation", "Current fix request rejected: " + provider);
        }
    }
    private boolean usable(Location location, long maxAge, float maxAccuracy) {
        if (location == null || !location.hasAccuracy()) return false;
        long age = (SystemClock.elapsedRealtimeNanos() - location.getElapsedRealtimeNanos()) / 1000000L;
        return age >= 0 && age <= maxAge && location.getAccuracy() >= 0 && location.getAccuracy() <= maxAccuracy
            && !Double.isNaN(location.getLatitude()) && !Double.isNaN(location.getLongitude())
            && Math.abs(location.getLatitude()) <= 90 && Math.abs(location.getLongitude()) <= 180;
    }
    private void consider(Location location) {
        if (!usable(location, 300000L, 10000f)) return;
        long now = SystemClock.elapsedRealtimeNanos();
        if (best == null || LocationFixPolicy.prefer(
            (now - best.getElapsedRealtimeNanos()) / 1000000L, best.getAccuracy(),
            (now - location.getElapsedRealtimeNanos()) / 1000000L, location.getAccuracy(),
            fresh ? 15000L : 60000L, immediateAccuracy())) best = location;
    }
    @Override public void onLocationChanged(Location location) {
        if (finished) return;
        consider(location);
        if (usable(location, fresh ? 15000L : 60000L, immediateAccuracy())) succeed(location);
    }
    private void completeBest() {
        if (usable(best, 300000L, 10000f)) succeed(best);
        else {
            android.util.Log.w("TravelWeatherLocation", "No acceptable fix within foreground timeout; finePermission="
                + (activity.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED));
            fail("timeout", "系统暂未返回可用位置，请稍后点击重新定位");
        }
    }
    private void succeed(Location location) {
        android.util.Log.d("TravelWeatherLocation", "Fix accepted; provider=" + location.getProvider()
            + "; elapsedMs=" + (SystemClock.elapsedRealtime() - startedAt));
        try {
            JSONObject data = new JSONObject();
            data.put("latitude", location.getLatitude());
            data.put("longitude", location.getLongitude());
            data.put("accuracy", location.getAccuracy());
            data.put("approximate", location.getAccuracy() > 1000f);
            finish(data.toString());
        } catch (Exception error) { fail("unavailable", "设备定位服务暂不可用"); }
    }
    void fail(String code, String reason) {
        finish("{\"error\":true,\"code\":" + JSONObject.quote(code) + ",\"reason\":" + JSONObject.quote(reason) + "}");
    }
    private void finish(String json) {
        if (finished) return;
        finished = true;
        handler.removeCallbacks(timeout);
        handler.removeCallbacks(poll);
        handler.removeCallbacks(enhanceFusion);
        for (CancellationSignal cancellation : currentRequests) cancellation.cancel();
        currentRequests.clear();
        if (manager != null) try { manager.removeUpdates(this); } catch (SecurityException ignored) { }
        result = json;
        done.countDown();
    }
    String await() {
        try {
            if (done.await(75, TimeUnit.SECONDS)) return result;
        } catch (InterruptedException error) { Thread.currentThread().interrupt(); }
        handler.post(new Runnable() { @Override public void run() { fail("timeout", "定位等待超时，请重试"); } });
        return "{\"error\":true,\"code\":\"timeout\",\"reason\":\"定位等待超时，请重试\"}";
    }
    @Override public void onProviderDisabled(String provider) { }
    @Override public void onProviderEnabled(String provider) { }
    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
}
