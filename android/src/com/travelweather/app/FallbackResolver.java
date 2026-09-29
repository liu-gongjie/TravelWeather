package com.travelweather.app;

import java.util.concurrent.*;

/** Bounded workers: a stuck system provider must not prevent the fallback. */
final class FallbackResolver {
    private static ExecutorService pool(int size) {
        return new ThreadPoolExecutor(size, size, 30, TimeUnit.SECONDS,
            new SynchronousQueue<Runnable>(), new ThreadFactory() {
                public Thread newThread(Runnable task) {
                    Thread thread = new Thread(task, "address-lookup");
                    thread.setDaemon(true); return thread;
                }
            });
    }
    private final ExecutorService system = pool(1), backup = pool(2);
    private <T> T attempt(ExecutorService executor, Callable<T> task, long timeout) throws Exception {
        Future<T> future = executor.submit(task);
        try {
            T value = future.get(timeout, TimeUnit.MILLISECONDS);
            if (value == null) throw new IllegalStateException("Empty address");
            return value;
        } finally { future.cancel(true); }
    }
    <T> T resolve(Callable<T> primary, Callable<T> secondary, long primaryMs, long secondaryMs) throws Exception {
        try { return attempt(system, primary, primaryMs); }
        catch (InterruptedException error) { Thread.currentThread().interrupt(); throw error; }
        catch (Exception error) { return attempt(backup, secondary, secondaryMs); }
    }
}
