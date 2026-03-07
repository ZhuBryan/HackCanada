export type ScoreBand = "great" | "medium" | "warning";
export type PropertyType = "Apartment" | "House" | "Condo";
export type FilterType = "All" | PropertyType;

export type Listing = {
  id: string;
  address: string;
  city: string;
  fullAddress: string;
  monthlyRent: number;
  priceLabel: string;
  shortPrice: string;
  beds: number;
  baths: number;
  sqft: number;
  propertyType: PropertyType;
  score: number;
  scoreStatus: string;
  scoreBand: ScoreBand;
  image: string;
  pinX: string;
  pinY: string;
  lat: number;
  lng: number;
  availableDate: string;
  leaseTerm: string;
  about: string;
  amenities: string[];
  categoryScores: {
    foodDrink: number;
    health: number;
    groceryParks: number;
    education: number;
    emergency: number;
  };
};

export const avenueNav = {
  brand: "Avenue-X",
  searchPlaceholder: "Search city, neighborhood, or address...",
  avatarLabel: "R",
};

export const landingData = {
  titlePrimary: "See Your Next Home",
  titleAccent: "in 3D.",
  subtitle:
    "We turn flat listings into spatial experiences.\nExplore neighborhood vitality before you sign.",
  searchPlaceholder: "Where are you looking to rent?",
  popular: ["Waterloo", "Toronto", "Vancouver", "Ottawa"],
  heroStats: [
    { icon: "Homes", value: "12K+", label: "Listings" },
    { icon: "Retail", value: "Real", label: "Business Data" },
    { icon: "Spatial", value: "3D", label: "Spatial View" },
  ],
};

export const listingsCatalog: Listing[] = [
  {
    id: "listing-1",
    address: "123 University Ave",
    city: "Waterloo, ON",
    fullAddress: "123 University Ave, Waterloo, ON N2L 3G1",
    monthlyRent: 2100,
    priceLabel: "$2,100/mo",
    shortPrice: "$2.1K",
    beds: 2,
    baths: 1,
    sqft: 850,
    propertyType: "Apartment",
    score: 85,
    scoreStatus: "Great neighborhood access",
    scoreBand: "great",
    image:
      "https://images.unsplash.com/photo-1771305081139-c2e0747e5f4c?auto=format&fit=crop&w=1000&q=80",
    pinX: "43%",
    pinY: "33%",
    lat: 43.4723,
    lng: -80.527,
    availableDate: "May 1, 2026",
    leaseTerm: "12 months",
    about:
      "Bright 2-bedroom apartment in the heart of uptown Waterloo, steps from Wilfrid Laurier University. Features modern finishes, in-unit laundry, and a private balcony with park views. Walking distance to restaurants, cafes, and transit.",
    amenities: [
      "In-unit laundry",
      "A/C",
      "EV Charging",
      "Dishwasher",
      "Balcony",
      "Storage",
    ],
    categoryScores: {
      foodDrink: 88,
      health: 72,
      groceryParks: 92,
      education: 70,
      emergency: 60,
    },
  },
  {
    id: "listing-2",
    address: "250 King St W, Unit 1204",
    city: "Waterloo, ON",
    fullAddress: "250 King St W, Unit 1204, Waterloo, ON",
    monthlyRent: 1850,
    priceLabel: "$1,850/mo",
    shortPrice: "$1.9K",
    beds: 2,
    baths: 1,
    sqft: 780,
    propertyType: "Condo",
    score: 85,
    scoreStatus: "Great neighborhood access",
    scoreBand: "great",
    image:
      "https://images.unsplash.com/photo-1666532937489-331f2f8f4668?auto=format&fit=crop&w=1000&q=80",
    pinX: "52%",
    pinY: "40%",
    lat: 43.4669,
    lng: -80.5222,
    availableDate: "May 15, 2026",
    leaseTerm: "12 months",
    about:
      "High-floor condo with skyline views, updated kitchen appliances, and direct transit access. Quiet building with concierge and fitness amenities.",
    amenities: ["In-unit laundry", "Gym", "Concierge", "Balcony", "Dishwasher", "A/C"],
    categoryScores: {
      foodDrink: 88,
      health: 72,
      groceryParks: 92,
      education: 70,
      emergency: 60,
    },
  },
  {
    id: "listing-3",
    address: "88 Harbour St, Unit 3402",
    city: "Toronto, ON",
    fullAddress: "88 Harbour St, Unit 3402, Toronto, ON",
    monthlyRent: 2100,
    priceLabel: "$2,100/mo",
    shortPrice: "$2.1K",
    beds: 1,
    baths: 1,
    sqft: 620,
    propertyType: "Apartment",
    score: 72,
    scoreStatus: "Moderate neighborhood access",
    scoreBand: "medium",
    image:
      "https://images.unsplash.com/photo-1702014861373-527115231f8c?auto=format&fit=crop&w=1000&q=80",
    pinX: "61%",
    pinY: "26%",
    lat: 43.642,
    lng: -79.3777,
    availableDate: "Jun 1, 2026",
    leaseTerm: "12 months",
    about:
      "Modern downtown apartment close to waterfront transit and offices. Efficient layout with integrated storage and smart-home controls.",
    amenities: ["Dishwasher", "A/C", "Bike room", "Gym", "Pet-friendly", "Storage locker"],
    categoryScores: {
      foodDrink: 65,
      health: 80,
      groceryParks: 70,
      education: 85,
      emergency: 78,
    },
  },
  {
    id: "listing-4",
    address: "45 Charles St E, Unit 801",
    city: "Toronto, ON",
    fullAddress: "45 Charles St E, Unit 801, Toronto, ON",
    monthlyRent: 1650,
    priceLabel: "$1,650/mo",
    shortPrice: "$1.6K",
    beds: 0,
    baths: 1,
    sqft: 450,
    propertyType: "Condo",
    score: 65,
    scoreStatus: "Moderate neighborhood access",
    scoreBand: "medium",
    image:
      "https://images.unsplash.com/photo-1679494422425-844a04e11f5d?auto=format&fit=crop&w=1000&q=80",
    pinX: "71%",
    pinY: "50%",
    lat: 43.6632,
    lng: -79.3833,
    availableDate: "Apr 1, 2026",
    leaseTerm: "8 months",
    about:
      "Compact studio in an amenity-rich building with flexible lease options. Best for students or downtown commuters seeking value.",
    amenities: ["Laundry room", "Gym", "Concierge", "Transit nearby", "Storage locker", "A/C"],
    categoryScores: {
      foodDrink: 67,
      health: 61,
      groceryParks: 73,
      education: 78,
      emergency: 70,
    },
  },
  {
    id: "listing-5",
    address: "10 York St, Unit 2205",
    city: "Toronto, ON",
    fullAddress: "10 York St, Unit 2205, Toronto, ON",
    monthlyRent: 2400,
    priceLabel: "$2,400/mo",
    shortPrice: "$2.4K",
    beds: 2,
    baths: 2,
    sqft: 950,
    propertyType: "Apartment",
    score: 84,
    scoreStatus: "Great neighborhood access",
    scoreBand: "great",
    image:
      "https://images.unsplash.com/photo-1760334335399-a6c983b541dd?auto=format&fit=crop&w=1000&q=80",
    pinX: "48%",
    pinY: "58%",
    lat: 43.6422,
    lng: -79.3806,
    availableDate: "May 20, 2026",
    leaseTerm: "12 months",
    about:
      "Large two-bedroom suite with floor-to-ceiling windows and premium finishes. Strong walkability score and direct rail connection nearby.",
    amenities: ["In-unit laundry", "Gym", "Rooftop deck", "Dishwasher", "Balcony", "Parking"],
    categoryScores: {
      foodDrink: 86,
      health: 74,
      groceryParks: 90,
      education: 73,
      emergency: 67,
    },
  },
  {
    id: "listing-6",
    address: "38 Elm St, Unit 1102",
    city: "Kitchener, ON",
    fullAddress: "38 Elm St, Unit 1102, Kitchener, ON",
    monthlyRent: 2250,
    priceLabel: "$2,250/mo",
    shortPrice: "$2.3K",
    beds: 2,
    baths: 1,
    sqft: 820,
    propertyType: "House",
    score: 83,
    scoreStatus: "Great neighborhood access",
    scoreBand: "great",
    image:
      "https://images.unsplash.com/photo-1631049421656-e0b38ea1705a?auto=format&fit=crop&w=1000&q=80",
    pinX: "79%",
    pinY: "34%",
    lat: 43.4516,
    lng: -80.4925,
    availableDate: "May 10, 2026",
    leaseTerm: "10 months",
    about:
      "Bright unit with family-friendly layout, updated kitchen, and convenient parking. Located in a calm neighborhood with quick highway access.",
    amenities: ["Backyard access", "Parking", "Dishwasher", "Storage", "A/C", "Laundry hookups"],
    categoryScores: {
      foodDrink: 79,
      health: 76,
      groceryParks: 85,
      education: 72,
      emergency: 74,
    },
  },
];

export const defaultSavedIds = ["listing-1", "listing-2", "listing-4"];
export const defaultCompareIds = ["listing-1", "listing-3"];
export const defaultSelectedListingId = "listing-1";

export const dioramaNearby = [
  { label: "Cafe Pyrus", distance: "120m", color: "#F97316" },
  { label: "Beertown", distance: "230m", color: "#F97316" },
  { label: "Shoppers Drug Mart", distance: "180m", color: "#EC4899" },
  { label: "UW Health Services", distance: "340m", color: "#EC4899" },
  { label: "Waterloo Town Square", distance: "90m", color: "#22C55E" },
  { label: "No Frills", distance: "410m", color: "#22C55E" },
  { label: "Wilfrid Laurier Univ", distance: "500m", color: "#3B82F6" },
  { label: "Waterloo Fire Station", distance: "480m", color: "#8B5CF6" },
];

export const dioramaLegend = [
  { label: "Food & Drink", color: "#F97316" },
  { label: "Health & Pharmacy", color: "#EC4899" },
  { label: "Grocery & Parks", color: "#22C55E" },
  { label: "Education", color: "#3B82F6" },
  { label: "Emergency Services", color: "#8B5CF6" },
];

export const mobileDashboard = {
  greeting: "Good morning, Sarah!",
  metrics: [
    { label: "steps taken", value: "2,847", badge: "+18% up", badgeColor: "#FF6B6B" },
    {
      label: "sleep time",
      value: "7.2h",
      badge: "-0.5h",
      badgeColor: "#E0E7FF",
      badgeText: "#6366F1",
    },
  ],
  habits: [
    { title: "Morning Meditation", meta: "15 min completed", state: "done" as const },
    { title: "Drink Water", meta: "8 glasses today", state: "done" as const },
    { title: "Evening Run", meta: "In progress...", state: "progress" as const },
    { title: "Read 30 Minutes", meta: "Not started yet", state: "todo" as const },
  ],
  week: [
    { day: "M", state: "done" as const },
    { day: "T", state: "done" as const },
    { day: "W", state: "done" as const },
    { day: "T", state: "progress" as const, marker: "~" },
    { day: "F", state: "warning" as const, marker: "5" },
    { day: "S", state: "todo" as const },
    { day: "S", state: "todo" as const },
  ],
  programs: [
    { title: "Morning Routine", duration: "4 weeks" },
    { title: "Mindful Living", duration: "6 weeks" },
  ],
  schedule: [
    { time: "7:00 AM", title: "Morning Yoga", meta: "30 min | Living room", color: "#22C55E" },
    {
      time: "12:30 PM",
      title: "Lunch Break Walk",
      meta: "20 min | Nearby park",
      color: "#FF6B6B",
    },
  ],
};
