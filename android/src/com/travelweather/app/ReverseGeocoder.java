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
        String key;
        try (InputStream in = context.getAssets().open("amap-key.txt")) {
            key = read(in).trim();
        }
        if (key.isEmpty()) throw new IOException("AMap key not configured");
        // Android Location coordinates remain WGS84 for weather and saved locations.
        // Only the address lookup uses the converted coordinates.
        JSONObject converted = request("assistant/coordinate/convert", key,
            "locations", String.format(java.util.Locale.US,"%.6f,%.6f",lon,lat), "coordsys", "gps");
        String coordinates = converted.optString("locations", "");
        if (!coordinates.matches("-?\\d+(\\.\\d+)?,-?\\d+(\\.\\d+)?")) throw new IOException("Invalid converted coordinates");
        JSONObject data = request("geocode/regeo", key, "location", coordinates, "extensions", "base");
        JSONObject address = data.getJSONObject("regeocode").getJSONObject("addressComponent");
        String district = field(address,"district"), city = field(address,"city"), province = field(address,"province");
        String name = !district.isEmpty() ? district : city;
        // Municipality responses may contain an empty city array.
        if (name.isEmpty() && (province.equals("北京市") || province.equals("上海市") || province.equals("天津市") || province.equals("重庆市"))) name = province;
        if (name.isEmpty()) throw new IOException("No city in AMap response");
        String code = field(address,"adcode");
        return new JSONObject().put("name",name).put("key","amap/"+(code.isEmpty()?province+"/"+city+"/"+name:code));
    }
    private static String field(JSONObject data, String key) {
        Object value = data.opt(key);
        return value instanceof String ? ((String)value).trim() : "";
    }
    private JSONObject request(String path, String key, String... params) throws Exception {
        Uri.Builder uri = Uri.parse("https://restapi.amap.com/v3/"+path).buildUpon().appendQueryParameter("key",key).appendQueryParameter("output","JSON");
        for (int i=0;i<params.length;i+=2) uri.appendQueryParameter(params[i],params[i+1]);
        HttpURLConnection connection = (HttpURLConnection)new URL(uri.build().toString()).openConnection();
        connection.setConnectTimeout(3000); connection.setReadTimeout(3000);
        connection.setInstanceFollowRedirects(false);
        try {
            if(connection.getResponseCode()!=200) throw new IOException("AMap HTTP failure");
            JSONObject result;
            try (InputStream in=connection.getInputStream()) { result=new JSONObject(read(in)); }
            if (!"1".equals(result.optString("status"))) {
                // Log only the numeric service code; never key, URL or precise coordinates.
                String code=result.optString("infocode","");
                if(code.matches("[0-9]{5}")) android.util.Log.w("TravelWeather", "AMap error code: "+code);
                throw new IOException("AMap service failure");
            }
            return result;
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
