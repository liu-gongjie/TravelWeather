package com.travelweather.app;

import android.content.Context;
import android.net.Uri;
import java.io.*;
import java.net.*;
import java.util.concurrent.Callable;
import org.json.JSONObject;

final class ReverseGeocoder {
    private static final FallbackResolver RESOLVER = new FallbackResolver();
    private final Context context;
    ReverseGeocoder(Context context) { this.context = context.getApplicationContext(); }
    JSONObject resolve(final double lat, final double lon) throws Exception {
        return RESOLVER.resolve(new Callable<JSONObject>() {
            public JSONObject call() throws Exception { return system(lat, lon); }
        }, new Callable<JSONObject>() {
            public JSONObject call() throws Exception { return amap(lat, lon); }
        }, 8000, 16000);
    }
    private JSONObject system(double lat, double lon) throws Exception {
            if(!android.location.Geocoder.isPresent())throw new IOException("Geocoder unavailable");
            android.location.Geocoder coder=new android.location.Geocoder(context,java.util.Locale.SIMPLIFIED_CHINESE);
            java.util.List<android.location.Address> addresses;
            if (android.os.Build.VERSION.SDK_INT >= 33) {
                java.util.concurrent.CountDownLatch done = new java.util.concurrent.CountDownLatch(1);
                java.util.concurrent.atomic.AtomicReference<java.util.List<android.location.Address>> result = new java.util.concurrent.atomic.AtomicReference<>();
                coder.getFromLocation(lat, lon, 1, new android.location.Geocoder.GeocodeListener() {
                    @Override public void onGeocode(java.util.List<android.location.Address> list) { result.set(list); done.countDown(); }
                    @Override public void onError(String message) { done.countDown(); }
                });
                if (!done.await(8, java.util.concurrent.TimeUnit.SECONDS)) throw new IOException("Geocoder timeout");
                addresses = result.get();
            } else addresses=coder.getFromLocation(lat,lon,1);
            if(addresses==null||addresses.isEmpty())throw new IOException("No address");
            android.location.Address address=addresses.get(0);
            String city=address.getLocality(), district=address.getSubLocality();
            String county=address.getSubAdminArea();
            String name=(district!=null&&!district.trim().isEmpty())?district:county;
            if(name==null||name.trim().isEmpty())name=city;
            if(name==null||name.isEmpty())throw new IOException("No city");
            String key=String.valueOf(address.getCountryCode())+"/"+String.valueOf(address.getAdminArea())+"/"+String.valueOf(address.getSubAdminArea())+"/"+String.valueOf(city)+"/"+name;
            return new org.json.JSONObject().put("name",name).put("key",key);
    }
    private JSONObject amap(double lat, double lon) throws Exception {
        String endpoint;
        try (InputStream in = context.getAssets().open("geocoder-proxy.txt")) {
            endpoint = read(in).trim();
        }
        Uri base = Uri.parse(endpoint);
        if (!"https".equals(base.getScheme()) || base.getHost()==null || base.getUserInfo()!=null
                || base.getQuery()!=null || base.getFragment()!=null) throw new IOException("HTTPS proxy not configured");
        Uri uri = base.buildUpon().appendQueryParameter("lat",Double.toString(lat))
            .appendQueryParameter("lon",Double.toString(lon)).build();
        HttpURLConnection connection = (HttpURLConnection)new URL(uri.toString()).openConnection();
        connection.setConnectTimeout(3000); connection.setReadTimeout(11000);
        connection.setInstanceFollowRedirects(false);
        try {
            if(connection.getResponseCode()!=200) throw new IOException("Address proxy unavailable");
            JSONObject result;
            try (InputStream in=connection.getInputStream()) { result=new JSONObject(read(in)); }
            String name=result.optString("name","").trim(), key=result.optString("key","").trim();
            if(name.isEmpty() || name.length()>100 || key.isEmpty() || key.length()>300) throw new IOException("Invalid proxy response");
            return new JSONObject().put("name",name).put("key",key);
        } finally { connection.disconnect(); }
    }
    private static String read(InputStream in) throws IOException {
        ByteArrayOutputStream out=new ByteArrayOutputStream(); byte[] buffer=new byte[4096]; int count;
        while((count=in.read(buffer))!=-1) {
            if(Thread.currentThread().isInterrupted()) throw new IOException("Cancelled");
            if(out.size()+count>262144) throw new IOException("Response too large");
            out.write(buffer,0,count);
        }
        return out.toString("UTF-8");
    }
}
