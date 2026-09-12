// ============================================================
//  Where is Dad?  —  trip settings
//  Edit this file to change names, landmarks, and fun facts.
// ============================================================

window.TRIP = {
  // Who is watching and who is driving
  kidName: "Bam Bam",
  driverName: "Dad",

  // How often the iPad asks the server for a new position (seconds)
  pollSeconds: 10,

  // If the phone hasn't reported for this many minutes, show a "resting" message
  staleMinutes: 20,

  // How close (miles) to the LAST landmark counts as "arrived"
  arriveMiles: 6,

  // How close (miles) to a landmark counts as "Dad is in ___"
  nearMiles: 15,

  // Draw the truck ON the road when the real position is within this many miles of it
  // (the numbers on the cards always use the true position)
  snapMiles: 30,

  // Beep the horn + show a banner when the truck crosses a state line
  hornOnStateLines: true,
  // Extra long honk when Dad arrives
  hornOnArrival: true,
  // A short toot when the truck is tapped (it always bounces)
  beepOnTruckTap: true,

  // One line shown when a state is tapped for a close-up
  stateFacts: {
    FL: { emoji: "🐊", text: "The Sunshine State: home, gators, beaches and the start of the trip!" },
    AL: { emoji: "🚢", text: "A giant battleship, a tunnel under the river, and sweet tea." },
    MS: { emoji: "🦐", text: "Shrimp boats, long sandy beaches and the mighty Mississippi River." },
    LA: { emoji: "🎺", text: "Jazz, gumbo, gators and an 18-mile bridge over a swamp." },
    TX: { emoji: "🤠", text: "Everything is bigger here, and Tomball is the finish line!" },
    GA: { emoji: "🍑", text: "Dad doesn't drive through here, but the peaches say hi!" }
  },
  // Close-up returns to the whole trip by itself after this many seconds
  zoomBackSeconds: 90,

  // Landmarks along the route, in driving order.  Miami first, Tomball last.
  // The road on the map is drawn through these points, so keep them in order.
  //   minor: true  -> small dot + small label (still used for "Dad is near")
  //   label: "above" | "below" | "left" | "right" | "none" -> where to put the name on the map
  //   short: "..."  -> shorter name to print on the map (the full name is used in sentences)
  //   waypoint: true -> invisible bend in the road (not a stop), so the line follows the real highway
  landmarks: [
    { name: "Miami",          state: "FL", lat: 25.7617, lon: -80.1918, emoji: "🌴", label: "below",
      fact: "Home sweet home! This is where the trip begins." },
    { name: "West Palm Beach", short: "West Palm", state: "FL", lat: 26.7153, lon: -80.3000, emoji: "🏖️", minor: true, label: "right",
      fact: "Beaches, palm trees and the Florida Turnpike." },
    { name: "Fort Pierce bend", lat: 27.4200, lon: -80.3800, waypoint: true },
    { name: "Yeehaw Junction", state: "FL", lat: 27.7003, lon: -80.9042, emoji: "🤠", minor: true, label: "right",
      fact: "That's really its name. YEEHAW!" },
    { name: "Orlando",        state: "FL", lat: 28.5383, lon: -81.3792, emoji: "🏰", label: "right",
      fact: "Home of Walt Disney World and tons of roller coasters." },
    { name: "Wildwood bend", lat: 28.8600, lon: -82.0400, waypoint: true },
    { name: "Ocala",          state: "FL", lat: 29.1872, lon: -82.1401, emoji: "🐴", minor: true, label: "right",
      fact: "Horse country! Hundreds of horse farms live here." },
    { name: "Gainesville",    state: "FL", lat: 29.6516, lon: -82.3248, emoji: "🐊", label: "right",
      fact: "Home of the Florida Gators. Watch out for real ones too!" },
    { name: "Lake City",      state: "FL", lat: 30.1897, lon: -82.6393, emoji: "🛣️", minor: true, label: "right",
      fact: "This is where Dad turns onto I-10 and heads WEST!" },
    { name: "Tallahassee",    state: "FL", lat: 30.4383, lon: -84.2807, emoji: "🏛️", label: "below",
      fact: "Florida's capital city, with big oak trees and rolling hills." },
    { name: "Marianna bend", lat: 30.7700, lon: -85.2300, waypoint: true },
    { name: "Crestview bend", lat: 30.7500, lon: -86.5700, waypoint: true },
    { name: "Pensacola",      state: "FL", lat: 30.4800, lon: -87.2169, emoji: "✈️", label: "below",
      fact: "Home of the Blue Angels jet team and sugar-white beaches." },
    { name: "Mobile",         state: "AL", lat: 30.6954, lon: -88.0399, emoji: "🚢", label: "above",
      fact: "A giant battleship is parked here, and Dad drives through a tunnel!" },
    { name: "Biloxi",         state: "MS", lat: 30.3960, lon: -88.8853, emoji: "🦐", label: "below",
      fact: "Shrimp boats and a long sandy beach on the Gulf." },
    { name: "Slidell bend", lat: 30.2700, lon: -89.7800, waypoint: true },
    { name: "New Orleans",    state: "LA", lat: 29.9511, lon: -90.0715, emoji: "🎺", label: "below",
      fact: "Jazz music, beignets, and a giant bridge over a lake!" },
    { name: "LaPlace bend", lat: 30.0700, lon: -90.4800, waypoint: true },
    { name: "Baton Rouge",    state: "LA", lat: 30.4515, lon: -91.1871, emoji: "🏛️", label: "above",
      fact: "Louisiana's capital. Dad crosses the mighty Mississippi River here!" },
    { name: "Atchafalaya Swamp", state: "LA", lat: 30.3500, lon: -91.6500, emoji: "🐸", minor: true, label: "none",
      fact: "An 18-mile-long bridge over a swamp full of frogs and gators!" },
    { name: "Lafayette",      state: "LA", lat: 30.2241, lon: -92.0198, emoji: "🦞", label: "below",
      fact: "Cajun country: crawfish, gumbo and zydeco music." },
    { name: "Lake Charles",   state: "LA", lat: 30.2266, lon: -93.2174, emoji: "🎣", minor: true, label: "above",
      fact: "The last big town in Louisiana." },
    { name: "Texas State Line", short: "Texas!", state: "TX", lat: 30.0900, lon: -93.7300, emoji: "⭐", label: "below",
      fact: "Welcome to TEXAS! Everything is bigger here." },
    { name: "Beaumont",       state: "TX", lat: 30.0802, lon: -94.1266, emoji: "🛢️", minor: true, label: "none",
      fact: "An oil town. A gusher called Spindletop made it famous." },
    { name: "Houston",        state: "TX", lat: 29.7604, lon: -95.3698, emoji: "🚀", label: "below",
      fact: "Space City! NASA astronauts train here." },
    { name: "Tomball",        state: "TX", lat: 30.0972, lon: -95.6161, emoji: "🏠", label: "above",
      fact: "The finish line! Dad made it!" }
  ]
};
