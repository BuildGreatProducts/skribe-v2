// Starting points configuration - shared across the app
export const STARTING_POINTS = [
  {
    id: "idea_refinement",
    title: "Idea Refinement",
    description: "Clarify your idea and value proposition",
    icon: "lightbulb",
    order: 1,
  },
  {
    id: "market_validation",
    title: "Market Validation",
    description: "Validate your market opportunity and competition",
    icon: "chart",
    order: 2,
  },
  {
    id: "customer_persona",
    title: "Customer Persona",
    description: "Define your ideal customer profiles",
    icon: "users",
    order: 3,
  },
  {
    id: "brand_strategy",
    title: "Brand Strategy",
    description: "Develop your brand identity and positioning",
    icon: "palette",
    order: 4,
  },
  {
    id: "business_model",
    title: "Business Model",
    description: "Design your revenue and business model",
    icon: "briefcase",
    order: 5,
  },
  {
    id: "new_features",
    title: "New Features",
    description: "Brainstorm and prioritize new features",
    icon: "sparkles",
    order: 6,
  },
  {
    id: "tech_stack",
    title: "Tech Stack",
    description: "Plan your technology architecture",
    icon: "code",
    order: 7,
  },
  {
    id: "create_prd",
    title: "Create PRD",
    description: "Generate a product requirements document",
    icon: "document",
    order: 8,
  },
  {
    id: "go_to_market",
    title: "Go to Market",
    description: "Plan your launch and marketing strategy",
    icon: "rocket",
    order: 9,
  },
  {
    id: "landing_page",
    title: "Landing Page",
    description: "Outline compelling copy for your landing page",
    icon: "layout",
    order: 10,
  },
  {
    id: "feedback_analysis",
    title: "Feedback Analysis",
    description: "Analyze user feedback to identify features and fixes",
    icon: "inbox",
    order: 11,
  },
] as const;

export type StartingPointId = (typeof STARTING_POINTS)[number]["id"];
export type AgentType = StartingPointId | "custom";
