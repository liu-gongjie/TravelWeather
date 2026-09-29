package com.travelweather.app;
import java.util.concurrent.Callable;
import java.util.concurrent.atomic.AtomicInteger;

public class FallbackResolverTest {
    public static void main(String[] args) throws Exception {
        final AtomicInteger calls=new AtomicInteger();
        Callable<String> backup=new Callable<String>() { public String call(){calls.incrementAndGet();return "岳麓区";} };
        FallbackResolver resolver=new FallbackResolver();
        String result=resolver.resolve(new Callable<String>() {public String call(){return "天河区";}},backup,1000,1000);
        if(!result.equals("天河区")||calls.get()!=0)throw new AssertionError("System success must skip fallback");
        result=resolver.resolve(new Callable<String>() {public String call(){throw new IllegalStateException();}},backup,1000,1000);
        if(!result.equals("岳麓区")||calls.get()!=1)throw new AssertionError("System failure must use fallback");
        result=resolver.resolve(new Callable<String>() {public String call(){return null;}},backup,1000,1000);
        if(!result.equals("岳麓区")||calls.get()!=2)throw new AssertionError("Empty response must use fallback");
        result=resolver.resolve(new Callable<String>() {public String call() throws Exception {Thread.sleep(5000);return "late";}},backup,40,1000);
        if(!result.equals("岳麓区"))throw new AssertionError("Timeout must use fallback");
        try {
            resolver.resolve(new Callable<String>() {public String call(){throw new IllegalStateException();}},new Callable<String>() {public String call(){throw new IllegalStateException();}},1000,1000);
            throw new AssertionError("Both failures must propagate");
        } catch(java.util.concurrent.ExecutionException expected) {}
        System.out.println("PASS: system success, failure, empty, timeout, both failures");
    }
}
