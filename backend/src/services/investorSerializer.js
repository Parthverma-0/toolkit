// Everything an investor profile or startup shows to somebody else goes through here, so the
// privacy rules live in one place:
//  - investor documents (private) and contact details are never part of a public profile;
//    contact details appear only after a connection is accepted
//  - founders choose whether investors see funding / revenue details (Startup.investorVisibility)

const photoOf = (profile, user) => profile?.photo || user?.avatar;

const showFunding = (startup) => startup.investorVisibility?.showFundingAsk !== false;
const showRevenue = (startup) => startup.investorVisibility?.showRevenue === true;

// ---------- Investor profiles ----------

// The investor's own view: everything except the stored file locations of their documents
const serializeOwnProfile = (profile, user) => {
  const obj = profile.toObject();
  return {
    ...obj,
    documents: (obj.documents || []).map(({ url, ...doc }) => doc),
    fullName: user.name,
    phone: user.phone || '',
    email: user.email,
    contactEmail: obj.contactEmail || user.email,
    photo: photoOf(profile, user),
    accountStatus: user.status,
  };
};

// Short form used in lists, connections and notifications
const serializeInvestorSummary = (profile, user) => ({
  id: profile._id,
  name: user.name,
  photo: photoOf(profile, user),
  designation: profile.designation,
  organisationName: profile.organisationName,
  investorType: profile.investorType,
  category: profile.category,
  verified: profile.verification?.status === 'verified',
});

// What founders see. `connected` = an accepted connection exists between the two.
const serializePublicProfile = (profile, user, { connected = false } = {}) => {
  const base = {
    ...serializeInvestorSummary(profile, user),
    visibility: profile.visibility,
    isFeatured: profile.isFeatured,
    sectors: profile.sectors,
  };
  // Limited profile: only the headline details, unless the two are already connected
  if (profile.visibility === 'limited' && !connected) return { ...base, limited: true };

  const full = {
    ...base,
    limited: false,
    bio: profile.bio,
    stages: profile.stages,
    locations: profile.locations,
    location: profile.location,
    country: profile.country,
    portfolio: (profile.portfolio || []).map((p) => ({
      id: p._id, name: p.name, website: p.website, sector: p.sector, year: p.year,
    })),
    expertise: profile.expertise,
    yearsOfExperience: profile.yearsOfExperience,
    previousInvestments: profile.previousInvestments,
    mentorshipAvailable: profile.mentorshipAvailable,
    strategicSupport: profile.strategicSupport,
    networkingSupport: profile.networkingSupport,
    linkedin: profile.linkedin,
    organisationWebsite: profile.organisationWebsite,
    organisationLinkedin: profile.organisationLinkedin,
    organisationLogo: profile.organisationLogo,
    yearEstablished: profile.yearEstablished,
    ...(profile.showTicketSize && { ticketSizes: profile.ticketSizes, customTicket: profile.customTicket }),
  };
  if (connected) full.contact = { email: profile.contactEmail || user.email, phone: user.phone };
  return full;
};

// ---------- Startups (as investors see them) ----------

const primaryFounderOf = (founders = []) => founders.find((f) => f.isPrimary) || founders[0];

const serializeStartupSummary = (startup, founder) => ({
  id: startup._id,
  name: startup.name,
  logo: startup.logo,
  sector: startup.sector,
  stage: startup.stage,
  city: startup.address?.city,
  founderName: founder?.fullName,
});

// Card + detail. `detail: true` adds the long text and the team; `connected` unlocks contact details.
const serializeStartupForInvestor = (startup, {
  founders = [], incubator, shortlisted = false, connection, match, detail = false, connected = false,
} = {}) => {
  const founder = primaryFounderOf(founders);
  const card = {
    ...serializeStartupSummary(startup, founder),
    tagline: startup.tagline,
    description: (startup.problemStatement || startup.solution || startup.tagline || '').slice(0, 280),
    businessModel: startup.businessModel,
    address: startup.address,
    foundedOn: startup.foundedOn,
    incubator: incubator ? { id: incubator._id, name: incubator.name } : null,
    verified: startup.isVerified,
    // Founder-controlled
    fundingAsk: showFunding(startup) ? startup.fundingAsk : undefined,
    fundingStatus: showFunding(startup) ? startup.fundingStatus : undefined,
    revenueStatus: showRevenue(startup) ? startup.revenueStatus : undefined,
    shortlisted,
    connection: connection || null,
    match: match || null,
  };
  if (!detail) return card;

  return {
    ...card,
    problemStatement: startup.problemStatement,
    solution: startup.solution,
    website: startup.website,
    teamSize: startup.teamSize,
    socialLinks: { linkedin: startup.socialLinks?.linkedin },
    founders: founders.map((f) => ({
      id: f._id, fullName: f.fullName, designation: f.designation, linkedin: f.linkedin, isPrimary: f.isPrimary,
    })),
    ...(connected && {
      contact: { startupEmail: startup.startupEmail, founderEmail: founder?.email, founderPhone: founder?.phone },
    }),
  };
};

// ---------- Connections ----------

const serializeConnection = (conn, viewerRole, counterpart, unread = 0) => ({
  id: conn._id,
  status: conn.status,
  initiatedBy: conn.initiatedBy,
  direction: conn.initiatedBy === viewerRole ? 'sent' : 'received',
  message: conn.message,
  createdAt: conn.createdAt,
  respondedAt: conn.respondedAt,
  history: conn.history,
  lastMessageAt: conn.lastMessageAt,
  lastMessagePreview: conn.lastMessagePreview,
  // "Conversation active" = accepted and somebody has written
  conversationActive: conn.status === 'accepted' && Boolean(conn.lastMessageAt),
  unread,
  counterpart,
});

module.exports = {
  photoOf,
  primaryFounderOf,
  serializeOwnProfile,
  serializeInvestorSummary,
  serializePublicProfile,
  serializeStartupSummary,
  serializeStartupForInvestor,
  serializeConnection,
};
