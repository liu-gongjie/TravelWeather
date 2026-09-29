package com.travelweather.app;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.os.Bundle;
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
    private volatile String result;
    private boolean finished;
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
        if (finished) return;
        if (!hasPermission()) { fail("permission", "请在应用权限中允许使用位置信息"); return; }
        if (manager == null) { fail("unavailable", "设备定位服务暂不可用"); return; }
        int active = 0;
        // Platform fused provider does not require a Google Play Services dependency.
        for (String provider : new String[]{"fused", LocationManager.NETWORK_PROVIDER, LocationManager.GPS_PROVIDER}) {
            try {
                if (!manager.isProviderEnabled(provider)) continue;
                consider(manager.getLastKnownLocation(provider));
                manager.requestLocationUpdates(provider, 1000L, 0f, this, Looper.getMainLooper());
                active++;
            } catch (IllegalArgumentException | SecurityException ignored) { }
        }
        if (active == 0) { fail("disabled", "请开启手机系统定位，并检查应用位置权限"); return; }
        if (!fresh && usable(best, 60000L, 1000f)) { succeed(best); return; }
        handler.postDelayed(timeout, 25000L);
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
        if (best == null || location.getElapsedRealtimeNanos() > best.getElapsedRealtimeNanos() + 60000000000L
            || location.getAccuracy() < best.getAccuracy()) best = location;
    }
    @Override public void onLocationChanged(Location location) {
        if (finished) return;
        consider(location);
        if (usable(location, 60000L, 1000f)) succeed(location);
    }
    private void completeBest() {
        if (usable(best, 300000L, 10000f)) succeed(best);
        else fail("timeout", "定位暂未成功，请到信号较好的位置重试；省电模式可能限制定位");
    }
    private void succeed(Location location) {
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
        if (manager != null) try { manager.removeUpdates(this); } catch (SecurityException ignored) { }
        result = json;
        done.countDown();
    }
    String await() {
        try {
            if (done.await(55, TimeUnit.SECONDS)) return result;
        } catch (InterruptedException error) { Thread.currentThread().interrupt(); }
        handler.post(new Runnable() { @Override public void run() { fail("timeout", "定位等待超时，请重试"); } });
        return "{\"error\":true,\"code\":\"timeout\",\"reason\":\"定位等待超时，请重试\"}";
    }
    @Override public void onProviderDisabled(String provider) { }
    @Override public void onProviderEnabled(String provider) { }
    @Override public void onStatusChanged(String provider, int status, Bundle extras) { }
}
