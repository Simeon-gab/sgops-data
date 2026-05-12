export interface PlaybookData {
  niche_id: string;
  niche_label: string;
  pain_points: string;
  content_angles: string[];
  hook: string;
  objection_responses: Record<string, string>;
  pricing_tiers: {
    starter: { description: string; price_range: string };
    growth:  { description: string; price_range: string };
    premium: { description: string; price_range: string };
  };
}

const PLAYBOOKS: PlaybookData[] = [
  {
    niche_id: "restaurant",
    niche_label: "Restaurants & Bars",
    pain_points:
      "Empty tables during off-peak hours, low social media engagement, competing with delivery apps for direct orders, inability to convey atmosphere and experience online",
    content_angles: [
      "Menu showcase videos featuring hero dishes and seasonal specials",
      "Chef spotlight and behind-the-scenes kitchen content",
      "Ambiance reels capturing the dining experience",
      "Customer testimonial montages",
      "Seasonal promotional content tied to holidays and events",
    ],
    hook: "Your food looks incredible in person. Online, you are invisible. We fix that.",
    objection_responses: {
      "We rely on word of mouth":
        "Word of mouth is powerful but slow. Video is word of mouth at scale. One great reel reaches thousands who would never have heard about you otherwise.",
      "We already post on Instagram":
        "Phone photos are authentic, but they do not stop the scroll. Professional content gets 3 to 5x more engagement. We add a level that makes everything else work harder.",
      "We do not have the budget":
        "Most restaurants start with a single shoot day. The ROI from one viral reel can cover the cost many times over.",
    },
    pricing_tiers: {
      starter: { description: "1 shoot day, 8 deliverables (4 reels, 4 stills)", price_range: "$1,500-$2,000" },
      growth:  { description: "2 shoot days/month, 20 deliverables, captions included", price_range: "$3,000-$4,000/mo" },
      premium: { description: "Weekly content, 40+ deliverables, full social management", price_range: "$5,000-$7,500/mo" },
    },
  },
  {
    niche_id: "hotel",
    niche_label: "Hotels & Hospitality",
    pain_points:
      "Low direct bookings versus OTAs, inability to show the property experience online, high dependency on review platforms, competing with Airbnb and boutique properties",
    content_angles: [
      "Property tour and room walkthrough videos",
      "Amenity showcases (pool, spa, rooftop, restaurant)",
      "Local area and experience guides",
      "Event and wedding venue highlight reels",
      "Guest story and testimonial videos",
    ],
    hook: "Every traveler Googles before they book. If they cannot see your property, they book somewhere else.",
    objection_responses: {
      "We get our bookings through OTAs":
        "OTAs take 15 to 25% commission on every booking. Direct bookings cost nothing. Video on your own site and Google Business converts browsers into direct bookers.",
      "We have professional photos already":
        "Photos show what a room looks like. Video shows how it feels. That emotion is what converts lookers into bookers.",
    },
    pricing_tiers: {
      starter: { description: "Property tour video + 10 room/amenity stills", price_range: "$2,500-$3,500" },
      growth:  { description: "Monthly content: 2 reels, 15 stills, seasonal promos", price_range: "$3,500-$5,000/mo" },
      premium: { description: "Full content partnership: weekly reels, paid ad creatives, event coverage", price_range: "$6,000-$10,000/mo" },
    },
  },
  {
    niche_id: "salon",
    niche_label: "Hair & Beauty Salons",
    pain_points:
      "Difficulty standing out in a saturated market, reliance on referrals, high chair vacancy rates, inconsistent Instagram presence without professional content",
    content_angles: [
      "Transformation videos (before and after with natural lighting)",
      "Stylist spotlight and meet-the-team content",
      "Product and technique education reels",
      "Booking flow and salon experience walkthroughs",
      "Client testimonial and reveal videos",
    ],
    hook: "Every salon in town is on Instagram. Only a few look like they belong there.",
    objection_responses: {
      "Our clients find us through referrals":
        "Referrals get people in the door once. Great content makes them follow you, tag you, and refer you 10x more. It amplifies word of mouth instead of replacing it.",
      "I post on my phone already":
        "Phone content is great for authenticity. Professional content is what builds the brand that makes people choose you over the salon down the street.",
    },
    pricing_tiers: {
      starter: { description: "4 transformation reels, 8 stylist/product stills", price_range: "$800-$1,200" },
      growth:  { description: "8 reels/month, 20 stills, full caption and hashtag strategy", price_range: "$1,500-$2,500/mo" },
      premium: { description: "Weekly content, paid ad creatives, Reels and TikTok optimized", price_range: "$3,000-$4,500/mo" },
    },
  },
  {
    niche_id: "gym",
    niche_label: "Gyms & Fitness Studios",
    pain_points:
      "High member churn, difficulty justifying premium pricing versus big-box gyms, low class fill rates, struggle to communicate community and culture online",
    content_angles: [
      "Class and training session highlight reels",
      "Member transformation stories",
      "Coach and trainer spotlights",
      "Facility tour and equipment showcase",
      "Challenge and community event coverage",
    ],
    hook: "People do not join a gym for equipment. They join for community. Video is how you show it.",
    objection_responses: {
      "We get most new members from walk-ins":
        "Walk-ins happen when someone already knows you exist. Video makes people seek you out before they even walk past.",
      "People care about price, not content":
        "Budget gyms win on price. You win on culture and results. Video is what communicates that difference.",
    },
    pricing_tiers: {
      starter: { description: "Facility tour + 4 class highlight reels, 8 stills", price_range: "$1,200-$1,800" },
      growth:  { description: "8 reels/month, member spotlights, class promos", price_range: "$2,000-$3,500/mo" },
      premium: { description: "Weekly content, paid social ads, challenge campaign coverage", price_range: "$4,000-$6,000/mo" },
    },
  },
  {
    niche_id: "dental",
    niche_label: "Dental Clinics",
    pain_points:
      "High patient acquisition cost, patients choosing on price or location alone, inability to communicate quality and care online, strong competition from corporate dental chains",
    content_angles: [
      "Before and after smile transformation videos",
      "Patient experience and comfort walkthrough",
      "Staff introduction and expertise spotlights",
      "Procedure explainer videos (implants, whitening, Invisalign)",
      "Office tour and technology showcase",
    ],
    hook: "Patients choose a dentist based on trust. Video builds trust before they ever call.",
    objection_responses: {
      "We get patients through referrals and insurance directories":
        "Directories send them a list of 20 dentists. Video is why they pick you instead of the next name on the list.",
      "Healthcare marketing has compliance constraints":
        "We work within those constraints. No fabricated claims, no before/afters without consent. We build trust content that complies completely.",
    },
    pricing_tiers: {
      starter: { description: "Office tour video, 2 staff spotlights, 8 trust-building stills", price_range: "$1,500-$2,000" },
      growth:  { description: "4 reels/month, procedure explainers, patient story videos (with consent)", price_range: "$2,500-$4,000/mo" },
      premium: { description: "Full content strategy, paid Google and Meta ads, monthly reporting", price_range: "$5,000-$8,000/mo" },
    },
  },
  {
    niche_id: "real_estate",
    niche_label: "Real Estate Agencies",
    pain_points:
      "Listings that sit too long, agents who look identical to competitors, inability to build personal brand online, low engagement on property social posts",
    content_angles: [
      "Property walkthrough and cinematic listing videos",
      "Agent introduction and expertise reels",
      "Neighbourhood and lifestyle showcase content",
      "Market update and educational content",
      "Client success and testimonial stories",
    ],
    hook: "Listings with video get 403% more inquiries. Most agents still use iPhone photos.",
    objection_responses: {
      "We already use virtual tours":
        "Virtual tours are for buyers who are already interested. Video is for getting them interested in the first place.",
      "We have a videographer on call":
        "Ad-hoc shooting is not a content strategy. Consistent, high-quality content is what builds an agent's brand over time.",
    },
    pricing_tiers: {
      starter: { description: "Per-listing: cinematic walkthrough + 15 stills", price_range: "$500-$800/listing" },
      growth:  { description: "Monthly agent brand content: 4 reels, 12 stills, neighbourhood features", price_range: "$2,000-$3,500/mo" },
      premium: { description: "Full agency content: all listings, agent reels, paid ad creatives, market updates", price_range: "$5,000-$10,000/mo" },
    },
  },
  {
    niche_id: "law_firm",
    niche_label: "Law Firms",
    pain_points:
      "Difficulty differentiating from other firms, inability to convey expertise and personality online, high cost-per-lead from paid ads, reliance on referrals that are hard to scale",
    content_angles: [
      "Attorney introduction and expertise videos",
      "Client success story case studies (anonymized or consented)",
      "Legal explainer and FAQ reels",
      "Office and team culture walkthrough",
      "Community involvement and thought leadership content",
    ],
    hook: "Clients hire the attorney they trust. Trust is built before they ever call.",
    objection_responses: {
      "Legal marketing has restrictions":
        "We work within your state bar guidelines completely. Educational content and brand-building content have wide latitude.",
      "Our clients come from referrals":
        "Referrals send them to your website first. What they find there determines if they call.",
    },
    pricing_tiers: {
      starter: { description: "Firm overview video, 3 attorney spotlights, 10 stills", price_range: "$2,000-$3,000" },
      growth:  { description: "4 explainer reels/month, attorney brand content, thought leadership videos", price_range: "$3,500-$5,500/mo" },
      premium: { description: "Full content strategy, paid search ad creatives, monthly case study videos", price_range: "$6,000-$12,000/mo" },
    },
  },
  {
    niche_id: "auto_dealer",
    niche_label: "Car Dealerships",
    pain_points:
      "Low trust with consumers, high competition from large group dealers, inability to differentiate on experience versus price, customers doing all research online before visiting",
    content_angles: [
      "Vehicle walkthrough and feature highlight videos",
      "Staff and sales team introduction reels",
      "Customer delivery day stories",
      "Service department trust and transparency content",
      "New arrival and inventory spotlight videos",
    ],
    hook: "80% of car buyers research online before stepping foot in a dealership. What they find about you matters.",
    objection_responses: {
      "We already do video ads":
        "Ad videos drive traffic. Brand videos build the trust that makes people choose your lot over the one across the street.",
      "Our inventory changes too fast":
        "We focus on evergreen brand content, not per-vehicle videos. One great piece about your team and experience outlasts any single car.",
    },
    pricing_tiers: {
      starter: { description: "Dealership brand video, 4 team spotlights, 15 inventory stills", price_range: "$2,000-$3,500" },
      growth:  { description: "Monthly: 6 vehicle walkthroughs, team content, customer story videos", price_range: "$3,500-$6,000/mo" },
      premium: { description: "Weekly inventory videos, full brand content calendar, paid ad creative package", price_range: "$7,000-$12,000/mo" },
    },
  },
  {
    niche_id: "wedding_venue",
    niche_label: "Wedding Venues",
    pain_points:
      "Long sales cycles with few decision moments, inability to convey the emotion and experience online, competition from newer venues with better social presence",
    content_angles: [
      "Full venue cinematic highlight reels",
      "Real wedding day coverage and emotional moments",
      "Ceremony and reception space styled shoots",
      "Venue team and coordinator introduction videos",
      "Seasonal and lighting showcase content",
    ],
    hook: "Couples book their venue within the first 10 minutes of a site visit. The first visit now happens online.",
    objection_responses: {
      "Our couples find us through wedding directories":
        "Directories list 50 venues. Your content is what makes couples click on yours first.",
      "We already have a videographer for our weddings":
        "Wedding coverage is for the couple. Brand content is for the next 100 couples who visit your website and social pages.",
    },
    pricing_tiers: {
      starter: { description: "Venue cinematic tour + styled shoot: 1 reel, 25 stills", price_range: "$2,500-$4,000" },
      growth:  { description: "Monthly: 2 wedding highlights (consented), venue seasonal content", price_range: "$3,000-$5,000/mo" },
      premium: { description: "Full content strategy, styled shoots, paid ad creatives, directory visuals", price_range: "$6,000-$10,000/mo" },
    },
  },
  {
    niche_id: "event_planner",
    niche_label: "Event Planners",
    pain_points:
      "Difficulty showing portfolio online, clients unable to visualize what they are buying, high competition from DIY platforms, long sales cycle requiring significant trust",
    content_angles: [
      "Event highlight reels showing full transformation",
      "Behind-the-scenes planning and setup process videos",
      "Client testimonial and reveal moment captures",
      "Styled shoot and concept visualization content",
      "Vendor collaboration and process videos",
    ],
    hook: "Your work disappears after one night. Content keeps it selling for you forever.",
    objection_responses: {
      "Our clients come from referrals and word of mouth":
        "Referrals confirm you are good. Content is what makes people reach out in the first place.",
      "We do not have a consistent look":
        "That is the point. We create a consistent visual identity from your best work.",
    },
    pricing_tiers: {
      starter: { description: "2 event highlight reels, 20 event stills, planner introduction video", price_range: "$1,500-$2,500" },
      growth:  { description: "Monthly: 2 event highlights, behind-the-scenes content, client stories", price_range: "$2,500-$4,000/mo" },
      premium: { description: "Full portfolio content strategy, styled shoots, paid social creatives", price_range: "$4,500-$7,000/mo" },
    },
  },
  {
    niche_id: "contractor",
    niche_label: "Contractors & Construction",
    pain_points:
      "High distrust from consumers, reliance on word of mouth, difficult to show quality of work online, competition from low-cost bidders who look the same online",
    content_angles: [
      "Project transformation videos (before, during, and after)",
      "Craftsman spotlight and team introduction content",
      "Process and quality walkthrough videos",
      "Client testimonial and project handover videos",
      "Material, technique, and education reels",
    ],
    hook: "Homeowners spend $50,000 on a renovation. They hire the contractor they trust most. Video builds that trust.",
    objection_responses: {
      "We get all our work from referrals":
        "Referrals dry up. Content works 24/7 to bring in new leads even when your existing clients are not actively referring.",
      "Our work speaks for itself":
        "It speaks to people who see it. Video shows it to people who have not seen it yet.",
    },
    pricing_tiers: {
      starter: { description: "3 project transformation videos, 15 project stills", price_range: "$1,500-$2,500" },
      growth:  { description: "Monthly: 4 project videos, team content, testimonial videos", price_range: "$2,500-$4,000/mo" },
      premium: { description: "Full brand content, Google Business optimization, paid lead gen content", price_range: "$4,500-$7,500/mo" },
    },
  },
  {
    niche_id: "retail",
    niche_label: "Retail Stores",
    pain_points:
      "Competing with e-commerce and online giants, low foot traffic, difficulty conveying in-store experience online, seasonal dependency",
    content_angles: [
      "Product showcase and unboxing reels",
      "Store tour and new arrival walkthroughs",
      "Owner and staff introduction content",
      "Customer experience and community event coverage",
      "Behind-the-scenes buying and curation process videos",
    ],
    hook: "Why shop local? Because you cannot experience the vibe of a great store through a website. Video closes that gap.",
    objection_responses: {
      "We cannot compete with Amazon on price":
        "Nobody shops with you for the price. They shop with you for the experience and the people. Video communicates exactly that.",
      "Our customers already know us":
        "Loyal customers keep you alive. New customers grow you. Content is how you reach people who have not discovered you yet.",
    },
    pricing_tiers: {
      starter: { description: "Store tour video, 4 product reels, 12 product stills", price_range: "$1,000-$1,800" },
      growth:  { description: "Monthly: 8 product reels, store content, seasonal campaign", price_range: "$2,000-$3,500/mo" },
      premium: { description: "Full e-commerce and social content, paid ad creatives, influencer collaboration coverage", price_range: "$4,000-$7,000/mo" },
    },
  },
  {
    niche_id: "medical",
    niche_label: "Medical Clinics",
    pain_points:
      "High patient acquisition cost, patients choosing on insurance and convenience alone, inability to differentiate on care quality online, low trust in new patient journey",
    content_angles: [
      "Clinic tour and patient welcome experience videos",
      "Physician and staff introduction reels",
      "Patient education and FAQ video content",
      "Community health initiative and event coverage",
      "Technology and service capability showcases",
    ],
    hook: "Patients choose where they get care based on who they trust. You earn that trust before they ever walk in.",
    objection_responses: {
      "We have full appointment books already":
        "Capacity constraints change. Content you build today keeps working when you open new capacity or a new location.",
      "Healthcare marketing is restricted":
        "Educational content and brand trust content are wide open. We stay well within HIPAA and advertising guidelines.",
    },
    pricing_tiers: {
      starter: { description: "Clinic tour, 3 physician introductions, 10 patient education stills", price_range: "$2,000-$3,000" },
      growth:  { description: "Monthly: 4 educational reels, staff spotlights, health awareness content", price_range: "$3,000-$5,000/mo" },
      premium: { description: "Full brand strategy, paid ad creatives, multi-location content coordination", price_range: "$5,500-$10,000/mo" },
    },
  },
  {
    niche_id: "nightclub",
    niche_label: "Nightclubs & Bars",
    pain_points:
      "High competition for the same weekend crowd, inability to convey atmosphere and energy online, reliance on DJ and event lineups that competitors match quickly",
    content_angles: [
      "Atmosphere and crowd energy reels",
      "DJ and performer spotlight content",
      "VIP experience and bottle service showcases",
      "Behind-the-scenes setup and pre-opening content",
      "Event recap and highlight videos",
    ],
    hook: "People choose where they go out based on where they think they will have the best time. Video shows them.",
    objection_responses: {
      "Our crowd handles the content on their own phones":
        "User-generated content is noise. Professional content is what cuts through and sets the standard for your brand.",
      "We advertise on social media already":
        "Ad spend with weak creative is wasted money. Great content makes every dollar you spend go further.",
    },
    pricing_tiers: {
      starter: { description: "2 event highlight reels, 15 atmosphere stills", price_range: "$800-$1,500" },
      growth:  { description: "Weekly event coverage: 1 reel per event, full edit within 48 hours", price_range: "$2,500-$4,000/mo" },
      premium: { description: "Ongoing content partner: weekly reels, DJ spotlights, paid ad creative package", price_range: "$5,000-$8,000/mo" },
    },
  },
  {
    niche_id: "photography",
    niche_label: "Photography Studios",
    pain_points:
      "Saturated market, price pressure from hobbyist photographers, difficulty conveying the client experience online, low repeat booking rates",
    content_angles: [
      "Behind-the-scenes session process videos",
      "Client reveal and reaction moment captures",
      "Photographer and studio introduction content",
      "Portfolio showcase reels by session type",
      "Studio setup and environment tours",
    ],
    hook: "You sell a feeling, not photos. Video communicates that feeling better than any gallery.",
    objection_responses: {
      "We are a photography studio, not a video studio":
        "This is not about video for your clients. It is about video to market your photography business. Every top photographer uses it.",
      "Our Instagram already shows our work":
        "Your portfolio shows what you shoot. Video shows who you are and why clients should choose you.",
    },
    pricing_tiers: {
      starter: { description: "Studio tour video, 2 behind-the-scenes reels, 10 portfolio stills", price_range: "$800-$1,500" },
      growth:  { description: "Monthly: 4 behind-the-scenes reels, client story videos, styled shoot content", price_range: "$1,500-$2,500/mo" },
      premium: { description: "Full brand content, paid ad creatives, educator/educator-content reels", price_range: "$3,000-$5,000/mo" },
    },
  },
];

const PLAYBOOK_MAP = new Map<string, PlaybookData>(
  PLAYBOOKS.map((p) => [p.niche_id, p])
);

export function getPlaybook(nicheId: string): PlaybookData | null {
  return PLAYBOOK_MAP.get(nicheId) ?? null;
}
