package com.travelweather.app;

public final class LocationFixPolicyTest {
    public static void main(String[] args) {
        // New network fix must beat an old but more accurate GNSS fix.
        assert LocationFixPolicy.prefer(70000, 5, 5000, 1500, 60000, 3000);
        assert !LocationFixPolicy.prefer(5000, 1500, 70000, 5, 60000, 3000);
        // Manual retry requires a fix younger than 15 seconds.
        assert LocationFixPolicy.prefer(30000, 5, 1000, 1000, 15000, 3000);
        // A stale precise fix may not mask a more recent fallback candidate.
        assert LocationFixPolicy.prefer(290000, 5, 65000, 4000, 60000, 3000);
        // Approximate-only permission accepts fresh city-scale positions.
        assert LocationFixPolicy.prefer(120000, 100, 1000, 6000, 60000, 10000);
        // Among similarly timed acceptable fixes, prefer the more accurate one.
        assert LocationFixPolicy.prefer(5000, 2000, 6000, 1000, 60000, 3000);
        assert !LocationFixPolicy.prefer(5000, 1000, 6000, 2000, 60000, 3000);
        System.out.println("PASS: freshness, accuracy, manual retry and approximate permission candidate ordering");
    }
}
