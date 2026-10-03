# OpenTripPlanner

OTP 2.6 (`downloads/otp-2.6.0-shaded.jar`, fetched), Java 21. The pipeline builds one graph per
network in `graphs/` and starts and stops the server itself.

Settings that differ from OTP's defaults:

| Setting | Default | Here | Why |
| --- | --- | --- | --- |
| `transitServiceStart`, `transitServiceEnd` | a year either side of today | 2026-09-01 to 2026-12-31 | the feed's service period, independent of when the graph is built |
| `accessEgress.maxDuration` | 45 min | 2 h | long walks to a stop are part of what is measured |
| `maxDirectStreetDuration` | 4 h | 2 h | |
| `itineraryFilters.debug` | `off` | `limit-to-search-window` | OTP's filters otherwise drop itineraries by its own cost, including ones that arrive earliest or walk less than walking all the way |
| `car.pickupTime`, `car.pickupCost` | 1 min, 120 | 0 | car trips route as kiss-and-ride; OTP would charge a pickup the passenger does not make |
| `car.reluctance` | 2.0 | 1.0 | otherwise OTP walks the passenger to a farther curb to save driving |
| `walkBoardCost` (query) | 10 min | 0 | a penalty per boarding that suppressed transfers |
| `maxTransfers` (query) | 2 boardings | 5 | never binding |
