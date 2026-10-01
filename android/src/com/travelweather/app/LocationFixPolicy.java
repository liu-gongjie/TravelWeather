package com.travelweather.app;

/** Choose a weather fix by freshness first, then accuracy within a freshness class. */
final class LocationFixPolicy {
    static boolean prefer(long oldAge, float oldAccuracy, long newAge, float newAccuracy,
                          long recentAge, float immediateAccuracy) {
        boolean oldRecent = oldAge >= 0 && oldAge <= recentAge && oldAccuracy <= immediateAccuracy;
        boolean newRecent = newAge >= 0 && newAge <= recentAge && newAccuracy <= immediateAccuracy;
        if (oldRecent != newRecent) return newRecent;
        // Keep newer fixes when the time gap is material; an older precise fix must
        // not suppress a fresh network position, or survive until it expires.
        if (Math.abs(oldAge - newAge) > 10000L) return newAge < oldAge;
        return newAccuracy < oldAccuracy;
    }
}
