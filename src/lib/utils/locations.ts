export interface LocationCity {
  name: string;
  lat: number;
  lng: number;
}

export interface LocationState {
  code: string;
  name: string;
  cities: LocationCity[];
}

export interface LocationCountry {
  code: string;
  name: string;
  dialCode: string;
  flag: string;
  states: LocationState[];
}

export const COUNTRIES: LocationCountry[] = [
  {
    code: "NG", name: "Nigeria", dialCode: "+234", flag: "🇳🇬",
    states: [
      { code: "LA", name: "Lagos", cities: [
        { name: "Lagos", lat: 6.5244, lng: 3.3792 },
        { name: "Ikeja", lat: 6.6018, lng: 3.3515 },
        { name: "Victoria Island", lat: 6.4281, lng: 3.4219 },
        { name: "Lekki", lat: 6.4698, lng: 3.5852 },
      ]},
      { code: "FC", name: "Abuja FCT", cities: [
        { name: "Abuja", lat: 9.0765, lng: 7.3986 },
        { name: "Garki", lat: 9.0403, lng: 7.4803 },
        { name: "Wuse", lat: 9.0574, lng: 7.4898 },
      ]},
      { code: "RV", name: "Rivers", cities: [
        { name: "Port Harcourt", lat: 4.8156, lng: 7.0498 },
        { name: "Obio", lat: 4.7799, lng: 7.0199 },
      ]},
      { code: "OG", name: "Ogun", cities: [
        { name: "Abeokuta", lat: 7.1475, lng: 3.3619 },
        { name: "Sagamu", lat: 6.8372, lng: 3.6486 },
      ]},
      { code: "KN", name: "Kano", cities: [
        { name: "Kano", lat: 12.0022, lng: 8.5920 },
        { name: "Fagge", lat: 11.9945, lng: 8.5090 },
      ]},
    ],
  },
  {
    code: "GH", name: "Ghana", dialCode: "+233", flag: "🇬🇭",
    states: [
      { code: "GA", name: "Greater Accra", cities: [
        { name: "Accra", lat: 5.6037, lng: -0.1870 },
        { name: "Tema", lat: 5.6698, lng: -0.0166 },
        { name: "Kumasi", lat: 6.6885, lng: -1.6244 },
      ]},
      { code: "AS", name: "Ashanti", cities: [
        { name: "Kumasi", lat: 6.6885, lng: -1.6244 },
        { name: "Obuasi", lat: 6.2000, lng: -1.6833 },
      ]},
      { code: "WR", name: "Western Region", cities: [
        { name: "Takoradi", lat: 4.8845, lng: -1.7554 },
        { name: "Cape Coast", lat: 5.1053, lng: -1.2466 },
      ]},
    ],
  },
  {
    code: "ZA", name: "South Africa", dialCode: "+27", flag: "🇿🇦",
    states: [
      { code: "GP", name: "Gauteng", cities: [
        { name: "Johannesburg", lat: -26.2041, lng: 28.0473 },
        { name: "Pretoria", lat: -25.7479, lng: 28.2293 },
        { name: "Sandton", lat: -26.1074, lng: 28.0567 },
      ]},
      { code: "WC", name: "Western Cape", cities: [
        { name: "Cape Town", lat: -33.9249, lng: 18.4241 },
        { name: "Stellenbosch", lat: -33.9321, lng: 18.8602 },
      ]},
      { code: "KZN", name: "KwaZulu-Natal", cities: [
        { name: "Durban", lat: -29.8587, lng: 31.0218 },
        { name: "Pietermaritzburg", lat: -29.5990, lng: 30.3788 },
      ]},
    ],
  },
  {
    code: "KE", name: "Kenya", dialCode: "+254", flag: "🇰🇪",
    states: [
      { code: "NBI", name: "Nairobi", cities: [
        { name: "Nairobi", lat: -1.2921, lng: 36.8219 },
        { name: "Westlands", lat: -1.2637, lng: 36.8055 },
        { name: "Karen", lat: -1.3218, lng: 36.7226 },
      ]},
      { code: "MSA", name: "Mombasa", cities: [
        { name: "Mombasa", lat: -4.0435, lng: 39.6682 },
        { name: "Nyali", lat: -4.0222, lng: 39.7178 },
      ]},
      { code: "KSM", name: "Kisumu", cities: [
        { name: "Kisumu", lat: -0.0917, lng: 34.7679 },
      ]},
    ],
  },
  {
    code: "IN", name: "India", dialCode: "+91", flag: "🇮🇳",
    states: [
      { code: "MH", name: "Maharashtra", cities: [
        { name: "Mumbai", lat: 19.0760, lng: 72.8777 },
        { name: "Pune", lat: 18.5204, lng: 73.8567 },
        { name: "Nagpur", lat: 21.1458, lng: 79.0882 },
      ]},
      { code: "DL", name: "Delhi", cities: [
        { name: "New Delhi", lat: 28.6139, lng: 77.2090 },
        { name: "Gurgaon", lat: 28.4595, lng: 77.0266 },
        { name: "Noida", lat: 28.5355, lng: 77.3910 },
      ]},
      { code: "KA", name: "Karnataka", cities: [
        { name: "Bangalore", lat: 12.9716, lng: 77.5946 },
        { name: "Mysore", lat: 12.2958, lng: 76.6394 },
      ]},
      { code: "TN", name: "Tamil Nadu", cities: [
        { name: "Chennai", lat: 13.0827, lng: 80.2707 },
        { name: "Coimbatore", lat: 11.0168, lng: 76.9558 },
      ]},
    ],
  },
  {
    code: "AE", name: "United Arab Emirates", dialCode: "+971", flag: "🇦🇪",
    states: [
      { code: "DU", name: "Dubai", cities: [
        { name: "Dubai", lat: 25.2048, lng: 55.2708 },
        { name: "Jumeirah", lat: 25.1972, lng: 55.2403 },
        { name: "Deira", lat: 25.2722, lng: 55.3095 },
      ]},
      { code: "AZ", name: "Abu Dhabi", cities: [
        { name: "Abu Dhabi", lat: 24.4539, lng: 54.3773 },
        { name: "Al Ain", lat: 24.2075, lng: 55.7447 },
      ]},
      { code: "SH", name: "Sharjah", cities: [
        { name: "Sharjah", lat: 25.3463, lng: 55.4209 },
      ]},
    ],
  },
  {
    code: "SG", name: "Singapore", dialCode: "+65", flag: "🇸🇬",
    states: [
      { code: "CEN", name: "Central Region", cities: [
        { name: "Singapore", lat: 1.3521, lng: 103.8198 },
        { name: "Orchard", lat: 1.3048, lng: 103.8318 },
        { name: "Clarke Quay", lat: 1.2905, lng: 103.8462 },
      ]},
      { code: "EAST", name: "East Region", cities: [
        { name: "Tampines", lat: 1.3540, lng: 103.9454 },
        { name: "Changi", lat: 1.3602, lng: 103.9899 },
      ]},
    ],
  },
  {
    code: "GB", name: "United Kingdom", dialCode: "+44", flag: "🇬🇧",
    states: [
      { code: "ENG", name: "England", cities: [
        { name: "London", lat: 51.5074, lng: -0.1278 },
        { name: "Manchester", lat: 53.4808, lng: -2.2426 },
        { name: "Birmingham", lat: 52.4862, lng: -1.8904 },
        { name: "Leeds", lat: 53.8008, lng: -1.5491 },
        { name: "Bristol", lat: 51.4545, lng: -2.5879 },
      ]},
      { code: "SCT", name: "Scotland", cities: [
        { name: "Edinburgh", lat: 55.9533, lng: -3.1883 },
        { name: "Glasgow", lat: 55.8642, lng: -4.2518 },
      ]},
      { code: "WLS", name: "Wales", cities: [
        { name: "Cardiff", lat: 51.4816, lng: -3.1791 },
        { name: "Swansea", lat: 51.6214, lng: -3.9436 },
      ]},
    ],
  },
  {
    code: "US", name: "United States", dialCode: "+1", flag: "🇺🇸",
    states: [
      { code: "CA", name: "California", cities: [
        { name: "Los Angeles", lat: 34.0522, lng: -118.2437 },
        { name: "San Francisco", lat: 37.7749, lng: -122.4194 },
        { name: "San Diego", lat: 32.7157, lng: -117.1611 },
        { name: "Sacramento", lat: 38.5816, lng: -121.4944 },
      ]},
      { code: "TX", name: "Texas", cities: [
        { name: "Houston", lat: 29.7604, lng: -95.3698 },
        { name: "Dallas", lat: 32.7767, lng: -96.7970 },
        { name: "Austin", lat: 30.2672, lng: -97.7431 },
        { name: "San Antonio", lat: 29.4241, lng: -98.4936 },
      ]},
      { code: "NY", name: "New York", cities: [
        { name: "New York City", lat: 40.7128, lng: -74.0060 },
        { name: "Brooklyn", lat: 40.6782, lng: -73.9442 },
        { name: "Buffalo", lat: 42.8864, lng: -78.8784 },
      ]},
      { code: "FL", name: "Florida", cities: [
        { name: "Miami", lat: 25.7617, lng: -80.1918 },
        { name: "Orlando", lat: 28.5383, lng: -81.3792 },
        { name: "Tampa", lat: 27.9506, lng: -82.4572 },
      ]},
      { code: "IL", name: "Illinois", cities: [
        { name: "Chicago", lat: 41.8781, lng: -87.6298 },
        { name: "Aurora", lat: 41.7606, lng: -88.3201 },
      ]},
      { code: "GA", name: "Georgia", cities: [
        { name: "Atlanta", lat: 33.7490, lng: -84.3880 },
        { name: "Savannah", lat: 32.0835, lng: -81.0998 },
      ]},
      { code: "WA", name: "Washington", cities: [
        { name: "Seattle", lat: 47.6062, lng: -122.3321 },
        { name: "Spokane", lat: 47.6588, lng: -117.4260 },
      ]},
      { code: "CO", name: "Colorado", cities: [
        { name: "Denver", lat: 39.7392, lng: -104.9903 },
        { name: "Colorado Springs", lat: 38.8339, lng: -104.8214 },
      ]},
    ],
  },
  {
    code: "CA", name: "Canada", dialCode: "+1", flag: "🇨🇦",
    states: [
      { code: "ON", name: "Ontario", cities: [
        { name: "Toronto", lat: 43.6532, lng: -79.3832 },
        { name: "Ottawa", lat: 45.4215, lng: -75.6972 },
        { name: "Mississauga", lat: 43.5890, lng: -79.6441 },
      ]},
      { code: "BC", name: "British Columbia", cities: [
        { name: "Vancouver", lat: 49.2827, lng: -123.1207 },
        { name: "Victoria", lat: 48.4284, lng: -123.3656 },
      ]},
      { code: "QC", name: "Quebec", cities: [
        { name: "Montreal", lat: 45.5017, lng: -73.5673 },
        { name: "Quebec City", lat: 46.8139, lng: -71.2080 },
      ]},
      { code: "AB", name: "Alberta", cities: [
        { name: "Calgary", lat: 51.0447, lng: -114.0719 },
        { name: "Edmonton", lat: 53.5461, lng: -113.4938 },
      ]},
    ],
  },
  {
    code: "AU", name: "Australia", dialCode: "+61", flag: "🇦🇺",
    states: [
      { code: "NSW", name: "New South Wales", cities: [
        { name: "Sydney", lat: -33.8688, lng: 151.2093 },
        { name: "Newcastle", lat: -32.9283, lng: 151.7817 },
        { name: "Wollongong", lat: -34.4278, lng: 150.8931 },
      ]},
      { code: "VIC", name: "Victoria", cities: [
        { name: "Melbourne", lat: -37.8136, lng: 144.9631 },
        { name: "Geelong", lat: -38.1499, lng: 144.3617 },
      ]},
      { code: "QLD", name: "Queensland", cities: [
        { name: "Brisbane", lat: -27.4698, lng: 153.0251 },
        { name: "Gold Coast", lat: -28.0167, lng: 153.4000 },
        { name: "Cairns", lat: -16.9186, lng: 145.7781 },
      ]},
      { code: "WA", name: "Western Australia", cities: [
        { name: "Perth", lat: -31.9505, lng: 115.8605 },
        { name: "Fremantle", lat: -32.0569, lng: 115.7439 },
      ]},
    ],
  },
  {
    code: "DE", name: "Germany", dialCode: "+49", flag: "🇩🇪",
    states: [
      { code: "BE", name: "Berlin", cities: [
        { name: "Berlin", lat: 52.5200, lng: 13.4050 },
        { name: "Mitte", lat: 52.5166, lng: 13.3833 },
      ]},
      { code: "BY", name: "Bavaria", cities: [
        { name: "Munich", lat: 48.1351, lng: 11.5820 },
        { name: "Nuremberg", lat: 49.4521, lng: 11.0767 },
        { name: "Augsburg", lat: 48.3705, lng: 10.8978 },
      ]},
      { code: "HH", name: "Hamburg", cities: [
        { name: "Hamburg", lat: 53.5753, lng: 10.0153 },
        { name: "Harburg", lat: 53.4567, lng: 9.9862 },
      ]},
      { code: "NW", name: "North Rhine-Westphalia", cities: [
        { name: "Cologne", lat: 50.9333, lng: 6.9500 },
        { name: "Dusseldorf", lat: 51.2217, lng: 6.7762 },
        { name: "Dortmund", lat: 51.5136, lng: 7.4653 },
      ]},
    ],
  },
  {
    code: "FR", name: "France", dialCode: "+33", flag: "🇫🇷",
    states: [
      { code: "IDF", name: "Île-de-France", cities: [
        { name: "Paris", lat: 48.8566, lng: 2.3522 },
        { name: "Versailles", lat: 48.8014, lng: 2.1301 },
      ]},
      { code: "PAC", name: "Provence-Alpes-Côte d'Azur", cities: [
        { name: "Marseille", lat: 43.2965, lng: 5.3698 },
        { name: "Nice", lat: 43.7102, lng: 7.2620 },
        { name: "Cannes", lat: 43.5528, lng: 7.0174 },
      ]},
      { code: "ARA", name: "Auvergne-Rhône-Alpes", cities: [
        { name: "Lyon", lat: 45.7640, lng: 4.8357 },
        { name: "Grenoble", lat: 45.1885, lng: 5.7245 },
      ]},
    ],
  },
  {
    code: "BR", name: "Brazil", dialCode: "+55", flag: "🇧🇷",
    states: [
      { code: "SP", name: "São Paulo", cities: [
        { name: "São Paulo", lat: -23.5505, lng: -46.6333 },
        { name: "Campinas", lat: -22.9099, lng: -47.0626 },
        { name: "Santos", lat: -23.9618, lng: -46.3322 },
      ]},
      { code: "RJ", name: "Rio de Janeiro", cities: [
        { name: "Rio de Janeiro", lat: -22.9068, lng: -43.1729 },
        { name: "Niteroi", lat: -22.8833, lng: -43.1036 },
      ]},
      { code: "MG", name: "Minas Gerais", cities: [
        { name: "Belo Horizonte", lat: -19.9167, lng: -43.9345 },
        { name: "Uberlândia", lat: -18.9113, lng: -48.2622 },
      ]},
    ],
  },
  {
    code: "MX", name: "Mexico", dialCode: "+52", flag: "🇲🇽",
    states: [
      { code: "CMX", name: "Mexico City", cities: [
        { name: "Mexico City", lat: 19.4326, lng: -99.1332 },
        { name: "Coyoacán", lat: 19.3524, lng: -99.1617 },
      ]},
      { code: "JAL", name: "Jalisco", cities: [
        { name: "Guadalajara", lat: 20.6597, lng: -103.3496 },
        { name: "Puerto Vallarta", lat: 20.6534, lng: -105.2253 },
      ]},
      { code: "NLE", name: "Nuevo León", cities: [
        { name: "Monterrey", lat: 25.6866, lng: -100.3161 },
        { name: "San Pedro Garza García", lat: 25.6578, lng: -100.4027 },
      ]},
    ],
  },
  {
    code: "JM", name: "Jamaica", dialCode: "+1876", flag: "🇯🇲",
    states: [
      { code: "KSA", name: "Kingston & St. Andrew", cities: [
        { name: "Kingston", lat: 17.9970, lng: -76.7936 },
        { name: "New Kingston", lat: 18.0108, lng: -76.7898 },
      ]},
      { code: "STJ", name: "St. James", cities: [
        { name: "Montego Bay", lat: 18.4762, lng: -77.8939 },
        { name: "Falmouth", lat: 18.4953, lng: -77.6571 },
      ]},
    ],
  },
  {
    code: "TT", name: "Trinidad and Tobago", dialCode: "+1868", flag: "🇹🇹",
    states: [
      { code: "POS", name: "Port of Spain", cities: [
        { name: "Port of Spain", lat: 10.6549, lng: -61.5019 },
        { name: "Westmoorings", lat: 10.6510, lng: -61.5551 },
      ]},
      { code: "SFO", name: "San Fernando", cities: [
        { name: "San Fernando", lat: 10.2796, lng: -61.4674 },
      ]},
    ],
  },
  {
    code: "NL", name: "Netherlands", dialCode: "+31", flag: "🇳🇱",
    states: [
      { code: "NH", name: "North Holland", cities: [
        { name: "Amsterdam", lat: 52.3676, lng: 4.9041 },
        { name: "Haarlem", lat: 52.3874, lng: 4.6462 },
      ]},
      { code: "ZH", name: "South Holland", cities: [
        { name: "Rotterdam", lat: 51.9244, lng: 4.4777 },
        { name: "The Hague", lat: 52.0705, lng: 4.3007 },
      ]},
      { code: "UT", name: "Utrecht", cities: [
        { name: "Utrecht", lat: 52.0907, lng: 5.1214 },
      ]},
    ],
  },
];

export function getCountry(code: string): LocationCountry | undefined {
  return COUNTRIES.find((c) => c.code === code);
}

export function getState(countryCode: string, stateCode: string): LocationState | undefined {
  return getCountry(countryCode)?.states.find((s) => s.code === stateCode);
}

export function getCityCoords(
  countryCode: string,
  stateCode: string,
  cityName: string
): { lat: number; lng: number } | null {
  const state = getState(countryCode, stateCode);
  const city = state?.cities.find(
    (c) => c.name.toLowerCase() === cityName.toLowerCase()
  );
  return city ? { lat: city.lat, lng: city.lng } : null;
}
