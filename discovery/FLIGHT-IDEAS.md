# Flight-booking system — idea scout

25 ideas across 5 categories, with prior-art + feasibility + ToS vetting on the standouts. Unlike
the esolang hunts, flight booking is a **red ocean**, so the bar here is *useful differentiator*,
not market-absence. All picks are buildable on **licensed fare APIs (Duffel / Amadeus)** — no
scraping (avoids the Ryanair/Southwest/seats.aero litigation patterns).

## Headline insight

The idea generators piled onto **delay / missed-connection risk scoring** (7+ near-duplicate
variants). The vetting showed that lane is already occupied: **Google Flights** delay prediction,
**Flighty** Connection Assistant (Relaxed/Tight tiers from live inbound-aircraft + historical
data), **FlightAware** inbound tracking. It *feels* novel but it's a me-too against funded
incumbents with data/brand advantages. Don't build that as your differentiator.

## Recommended picks

### 🥇 Useful: **TrueFare — personalized all-in re-ranker**
Make **personalized all-in price the primary sort key**, not a footnote. Set a one-time profile
(1 checked bag, need a seat assignment, 6'4" so no basic-economy middle, want free changes); every
result is re-priced with *your* ancillary deltas and re-sorted — so a $12-cheaper Basic Economy
that charges $35 bag + $25 seat drops **below** the bundled Main Cabin, with an itemized chip
(`$228 → $288: +$35 bag, +$25 seat`).
- **Why it wins:** hits **100% of searches**; Google/Kayak only show generic "bag fee may apply"
  notes — nobody ships *per-user* all-in re-ranking that actually inverts the order.
- **Build (weekend):** Duffel/Amadeus Flight Offers + their baggage/ancillary/fare-brand fields;
  fallback hand-curated fee table for ~15 US carriers. US-domestic only for v0.
- **Honest moat:** thin (an incumbent could copy the sort in a quarter) — it's a UX/positioning
  win on cheap plumbing, not a technical moat. But highest-frequency, lowest-cost useful build in
  the set. Risk: ancillary-data completeness (curated table drifts → wrong numbers erode trust);
  frame all-in as an *estimate*.

### 🎈 Delight / viral hook: **Flyable Words**
Type a word/name/phrase → it finds a **real, bookable multi-city itinerary whose IATA codes spell
it** → shareable map card (codes + polyline + price + book link). Pure whitespace — people notice
cute code coincidences by hand, but no tool searches code+route+fare space and hands you a
purchasable trip.
- **Build (weekend):** OurAirports/OpenFlights letter→code index + a string-tiling solver
  (partition input into valid same-continent codes), then Duffel multi-city search to confirm/price
  the top 1–3 spellings. Cap ~4–5 segments; 3-letter-friendly English words first.
- **Role:** top-of-funnel acquisition/marketing (name-spelling trips, proposals, band routings),
  not revenue. Low conversion by nature — treat as the viral toy that feeds the serious product.

**The strategy:** ship **Flyable Words** as the viral hook and **TrueFare** as the thing that
actually helps — the toy feeds the tool.

## Other genuinely-differentiated lanes (less crowded than delay-scoring)

| Idea | The wedge | Who's near it |
|---|---|---|
| **EventPull** | *"I'm free this weekend + $400 — where's something actually happening, nonstop?"* event-first discovery + real fare | Kayak/Google Explore do price-first; Bandsintown/SeatGeek do event-by-proximity; nobody fuses them |
| **Jetlag-optimized ranking** | Re-rank equivalent itineraries by predicted arrival-day functionality (circadian model) | Timeshifter/StopJetLag exist as *apps*, none inside a booking flow |
| **VibeFinder** | Destination-from-description ("warm, walkable, cheap, good food, some March weekend") over real inventory | LLM intent search — the biggest UX gap most OTAs still don't nail |
| **Door-to-Door TrueTime** | True address-to-address time+cost with per-airport MCT + TSA waits + transfers | Rome2Rio is closest; the curated MCT/gate-buffer layer is the edge |
| **EU261 / DOT auto-claim** | Detect compensation eligibility at/after booking + pre-fill the claim | AirHelp/ClaimCompass exist; auto-detection *at booking time* is the hook |

## Crowded — don't lead with these

Delay/misconnect-risk scoring (Google, Flighty, FlightAware) · basic price-drop alerts (Hopper,
Google) · "explore under $X" maps (Kayak, Google) · hidden-city ticketing (**ToS landmine** —
Skiplagged was sued; avoid).

## Sleeper (with a warning)

**Points-vs-cash blended optimizer** — the math is easy, but the load-bearing dependency is
**award-availability data**, which is fragmented, partly gated, and under **active scraping
litigation** (Air Canada v. seats.aero). That data path — not the optimizer — makes it a legally
fraught *project*, not a weekend.

## Buildability note

All picks run on **Duffel** (bootstrap: free sandbox, $3/confirmed order) or **Amadeus** (2,000
free searches/mo) — licensed, no scraping. This session also has **live Expedia flight/hotel search
tools** available, usable to prototype Flyable Words' "is this spelling actually bookable?" check.
