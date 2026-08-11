/**
 * The on-device SQLite schema — the single definition of it.
 *
 * This lives in the shared contract rather than in either the generator or the
 * client because both must agree exactly. `@streetlevel/data` emits INSERT
 * statements positionally against these tables, and the Expo client executes
 * them; a column renamed on one side and not the other is a seed that fails to
 * load on a phone, which is discovered underground with no signal. Keeping one
 * string means that class of drift cannot happen.
 *
 * The CHECK constraints are load-bearing, not decoration. This data feeds
 * instructions given to someone who cannot verify them independently, so a
 * corner code of 'MIDDLE' or a car index of 47 must fail at write time — where
 * it can be logged and fixed — rather than at read time in a tunnel.
 */
export const ON_DEVICE_SCHEMA_SQL = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS mta_stations (
    station_id TEXT PRIMARY KEY NOT NULL,
    complex_id TEXT NOT NULL,
    station_name TEXT NOT NULL,
    borough TEXT CHECK(borough IN ('M', 'B', 'Q', 'X', 'SI')) NOT NULL,
    lines_served TEXT NOT NULL,
    latitude REAL NOT NULL CHECK(latitude BETWEEN 40.4 AND 41.0),
    longitude REAL NOT NULL CHECK(longitude BETWEEN -74.3 AND -73.6)
);

CREATE TABLE IF NOT EXISTS station_entrances (
    entrance_id TEXT PRIMARY KEY NOT NULL,
    station_id TEXT NOT NULL,
    street_name TEXT NOT NULL,
    cross_street TEXT NOT NULL,
    corner_code TEXT CHECK(corner_code IN ('NW', 'NE', 'SW', 'SE', 'MID')) NOT NULL,
    entrance_type TEXT CHECK(entrance_type IN ('STAIRS', 'ELEVATOR', 'ESCALATOR')) NOT NULL,
    has_omny_turnstile INTEGER CHECK(has_omny_turnstile IN (0, 1)) DEFAULT 1,
    landmark_description TEXT NOT NULL,
    avoidance_notes TEXT,
    latitude REAL NOT NULL CHECK(latitude BETWEEN 40.4 AND 41.0),
    longitude REAL NOT NULL CHECK(longitude BETWEEN -74.3 AND -73.6),
    provenance TEXT CHECK(provenance IN ('FIELD_SURVEYED', 'SAMPLE_UNVERIFIED')) NOT NULL,
    surveyed_on TEXT,
    CHECK (provenance <> 'FIELD_SURVEYED' OR surveyed_on IS NOT NULL),
    FOREIGN KEY (station_id) REFERENCES mta_stations(station_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS platform_connections (
    connection_id TEXT PRIMARY KEY NOT NULL,
    origin_station_id TEXT NOT NULL,
    target_line_id TEXT NOT NULL,
    direction_bound TEXT CHECK(direction_bound IN ('UPTOWN', 'DOWNTOWN', 'BROOKLYN', 'QUEENS', 'BRONX')) NOT NULL,
    walking_path_instructions TEXT NOT NULL,
    ceiling_sign_markers TEXT NOT NULL,
    avoidance_track_noise TEXT,
    provenance TEXT CHECK(provenance IN ('FIELD_SURVEYED', 'SAMPLE_UNVERIFIED')) NOT NULL,
    surveyed_on TEXT,
    CHECK (provenance <> 'FIELD_SURVEYED' OR surveyed_on IS NOT NULL),
    FOREIGN KEY (origin_station_id) REFERENCES mta_stations(station_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS exit_car_alignments (
    alignment_id TEXT PRIMARY KEY NOT NULL,
    origin_station_id TEXT NOT NULL,
    destination_station_id TEXT NOT NULL,
    transit_line_id TEXT NOT NULL,
    optimal_car_index INTEGER NOT NULL CHECK(optimal_car_index BETWEEN 1 AND 11),
    platform_landmark_marker TEXT NOT NULL,
    exit_stairwell_identifier TEXT NOT NULL,
    surfacing_street_corner TEXT NOT NULL,
    provenance TEXT CHECK(provenance IN ('FIELD_SURVEYED', 'SAMPLE_UNVERIFIED')) NOT NULL,
    surveyed_on TEXT,
    CHECK (origin_station_id <> destination_station_id),
    CHECK (provenance <> 'FIELD_SURVEYED' OR surveyed_on IS NOT NULL),
    FOREIGN KEY (origin_station_id) REFERENCES mta_stations(station_id),
    FOREIGN KEY (destination_station_id) REFERENCES mta_stations(station_id)
);

CREATE INDEX IF NOT EXISTS idx_stations_coords ON mta_stations (latitude, longitude);
CREATE INDEX IF NOT EXISTS idx_entrances_station ON station_entrances (station_id);
CREATE INDEX IF NOT EXISTS idx_alignments_lookup ON exit_car_alignments (origin_station_id, destination_station_id, transit_line_id);
`;

/**
 * The traveller's own downloaded trips. Client-only: nothing on the server
 * generates these rows, and they must survive indefinitely regardless of
 * billing state — a packet already on the device is never taken away.
 */
export const PINNED_PACKETS_SQL = `
CREATE TABLE IF NOT EXISTS pinned_packets (
    packet_id TEXT PRIMARY KEY NOT NULL,
    compiled_at TEXT NOT NULL,
    expires_at TEXT,
    origin_address TEXT NOT NULL,
    destination_address TEXT NOT NULL,
    packet_json TEXT NOT NULL,
    pinned_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pinned_packets_recent ON pinned_packets (pinned_at DESC);
`;

/** Column order for positional INSERTs. Generator and client read the same list. */
export const TABLE_COLUMNS = {
  mta_stations: [
    'station_id', 'complex_id', 'station_name', 'borough', 'lines_served', 'latitude', 'longitude',
  ],
  station_entrances: [
    'entrance_id', 'station_id', 'street_name', 'cross_street', 'corner_code', 'entrance_type',
    'has_omny_turnstile', 'landmark_description', 'avoidance_notes', 'latitude', 'longitude',
    'provenance', 'surveyed_on',
  ],
  platform_connections: [
    'connection_id', 'origin_station_id', 'target_line_id', 'direction_bound',
    'walking_path_instructions', 'ceiling_sign_markers', 'avoidance_track_noise',
    'provenance', 'surveyed_on',
  ],
  exit_car_alignments: [
    'alignment_id', 'origin_station_id', 'destination_station_id', 'transit_line_id',
    'optimal_car_index', 'platform_landmark_marker', 'exit_stairwell_identifier',
    'surfacing_street_corner', 'provenance', 'surveyed_on',
  ],
} as const;
