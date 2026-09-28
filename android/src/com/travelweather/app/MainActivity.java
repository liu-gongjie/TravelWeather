package com.travelweather.app;

import android.Manifest;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.webkit.*;
import android.net.Uri;
import java.io.IOException;

/** Minimal, source-owned Android shell; serves bundled assets on a secure origin. */
public class MainActivity extends Activity {
    private WebView web;
    private GeolocationPermissions.Callback locationCallback;
    private String locationOrigin;
    private static final String HOST = "appassets.androidplatform.net";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        web.setPadding(0,0,0,0);
        web.setOnApplyWindowInsetsListener(new android.view.View.OnApplyWindowInsetsListener() {
            @Override public android.view.WindowInsets onApplyWindowInsets(android.view.View view, android.view.WindowInsets insets) {
            view.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());
            return insets;
            }
        });
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setGeolocationEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri=request.getUrl();
                if (!HOST.equals(uri.getHost()) || !"https".equals(uri.getScheme())) return null;
                String path=uri.getPath();
                if("/reverse-geocode".equals(path)) return reverseGeocode(uri);
                if(path==null || path.contains("..")) return new WebResourceResponse("text/plain","UTF-8",null);
                if(path.equals("/"))path="/index.html";
                String mime=path.endsWith(".js")?"application/javascript":path.endsWith(".css")?"text/css":path.endsWith(".png")?"image/png":"text/html";
                try{return new WebResourceResponse(mime,"UTF-8",getAssets().open("web"+path));}
                catch(IOException ex){return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",null,null);}
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest request) {
                Uri uri=request.getUrl();
                if(HOST.equals(uri.getHost()) && "https".equals(uri.getScheme()))return false;
                if("https".equals(uri.getScheme()))startActivity(new android.content.Intent(android.content.Intent.ACTION_VIEW,uri));
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback callback) {
                if(!origin.equals("https://"+HOST+"/") && !origin.equals("https://"+HOST)){callback.invoke(origin,false,false);return;}
                if(checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED){callback.invoke(origin,true,false);return;}
                locationOrigin=origin;locationCallback=callback;
                requestPermissions(new String[]{Manifest.permission.ACCESS_COARSE_LOCATION,Manifest.permission.ACCESS_FINE_LOCATION},100);
            }
        });
        web.loadUrl("https://"+HOST+"/index.html");
    }
    // WebView invokes this on its request worker, never on the UI thread.
    private WebResourceResponse reverseGeocode(Uri uri) {
        try {
            double lat=Double.parseDouble(uri.getQueryParameter("lat"));
            double lon=Double.parseDouble(uri.getQueryParameter("lon"));
            if(Double.isNaN(lat)||Double.isNaN(lon)||Math.abs(lat)>90||Math.abs(lon)>180)throw new IllegalArgumentException();
            if(!android.location.Geocoder.isPresent())throw new IOException("Geocoder unavailable");
            android.location.Geocoder coder=new android.location.Geocoder(this,java.util.Locale.SIMPLIFIED_CHINESE);
            java.util.List<android.location.Address> addresses=coder.getFromLocation(lat,lon,1);
            if(addresses==null||addresses.isEmpty())throw new IOException("No address");
            android.location.Address address=addresses.get(0);
            String city=address.getLocality(), district=address.getSubLocality();
            String county=address.getSubAdminArea();
            String name=(district!=null&&!district.trim().isEmpty())?district:county;
            if(name==null||name.trim().isEmpty())name=city;
            if(name==null||name.isEmpty())throw new IOException("No city");
            String key=String.valueOf(address.getCountryCode())+"/"+String.valueOf(address.getAdminArea())+"/"+String.valueOf(address.getSubAdminArea())+"/"+String.valueOf(city)+"/"+name;
            return jsonResponse("{\"name\":"+org.json.JSONObject.quote(name)+",\"key\":"+org.json.JSONObject.quote(key)+"}",200);
        } catch(Exception error) {
            return jsonResponse("{\"error\":true,\"reason\":\"城市名称暂时解析失败\"}",503);
        }
    }
    private WebResourceResponse jsonResponse(String data,int status) {
        return new WebResourceResponse("application/json","UTF-8",status,status==200?"OK":"Unavailable",java.util.Collections.singletonMap("Cache-Control","no-store"),new java.io.ByteArrayInputStream(data.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
    }
    @Override public void onRequestPermissionsResult(int request,String[] permissions,int[] results){
        super.onRequestPermissionsResult(request,permissions,results);
        if(request==100 && locationCallback!=null){locationCallback.invoke(locationOrigin,checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED,false);locationCallback=null;}
    }
    @Override public void onBackPressed(){web.evaluateJavascript("(function(){var d=document.querySelector('dialog[open]');if(d){d.close();return true;}return false;})()",new ValueCallback<String>() { @Override public void onReceiveValue(String result){ if(!"true".equals(result))finish(); } });}
    @Override protected void onResume(){
        super.onResume();
        if(web!=null)web.evaluateJavascript("window.dispatchEvent(new Event('travelweather-resume'));",null);
    }
    @Override protected void onDestroy(){web.destroy();super.onDestroy();}
}
