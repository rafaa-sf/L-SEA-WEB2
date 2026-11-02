// ==============================================================================
// src/core/clock.js (PLANNER CLOCK)
// ==============================================================================
// Pure arithmetic behind the mission clock. Kept out of the component so the
// speed ramp (1x, 60x, 3600x) and the day rollover can be tested without a
// browser: the component only owns the refs and the throttling.

/** Advance a simulated clock by real elapsed time.
 *
 *  @param {number} hour       simulated hour of day, 0..23
 *  @param {number} second     seconds already accumulated inside that hour
 *  @param {number} elapsed    real seconds since the previous frame
 *  @param {number} speed      simulated seconds per real second
 *  @returns {{hour:number, second:number, dayShift:number}}
 */
export function advanceClock(hour, second, elapsed, speed) {
    if (!(elapsed > 0) || !(speed > 0)) {
        return { hour, second, dayShift: 0 };
    }

    // A single frame can carry more than a day at high speed, hence the floor
    // before the wrap rather than a while loop of one-hour steps.
    let totalSeconds = second + elapsed * speed;
    let hoursToAdd = Math.floor(totalSeconds / 3600);
    totalSeconds -= hoursToAdd * 3600;

    let nextHour = hour + hoursToAdd;
    const dayShift = Math.floor(nextHour / 24);
    nextHour -= dayShift * 24;

    return { hour: nextHour, second: totalSeconds, dayShift };
}
