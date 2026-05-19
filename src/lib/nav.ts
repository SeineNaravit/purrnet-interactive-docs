export interface NavItem {
  title: string;
  titleKey: string;
  href: string;
  badge?: string;
}

export interface NavSection {
  title: string;
  titleKey: string;
  icon: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: "Getting Started",
    titleKey: "sidebar.sections.gettingStarted",
    icon: "🚀",
    items: [
      { title: "Introduction",  titleKey: "sidebar.pages.introduction",  href: "/docs/introduction" },
      { title: "Installation",  titleKey: "sidebar.pages.installation",  href: "/docs/installation" },
      { title: "Minimal Setup", titleKey: "sidebar.pages.minimalSetup",  href: "/docs/minimal-setup" },
    ],
  },
  {
    title: "Core Concepts",
    titleKey: "sidebar.sections.coreConcepts",
    icon: "🧠",
    items: [
      { title: "NetworkIdentity",       titleKey: "sidebar.pages.networkIdentity",  href: "/docs/network-identity" },
      { title: "NetworkBehaviour",      titleKey: "sidebar.pages.networkBehaviour", href: "/docs/network-behaviour" },
      { title: "Ownership",             titleKey: "sidebar.pages.ownership",        href: "/docs/ownership" },
      { title: "Spawning & Despawning", titleKey: "sidebar.pages.spawning",         href: "/docs/spawning" },
      { title: "Network Rules",         titleKey: "sidebar.pages.networkRules",     href: "/docs/network-rules" },
    ],
  },
  {
    title: "Remote Procedure Calls",
    titleKey: "sidebar.sections.remoteProcedureCalls",
    icon: "📡",
    items: [
      { title: "ServerRpc",            titleKey: "sidebar.pages.serverRpc",    href: "/docs/server-rpc" },
      { title: "ObserversRpc",         titleKey: "sidebar.pages.observersRpc", href: "/docs/observers-rpc" },
      { title: "TargetRpc",            titleKey: "sidebar.pages.targetRpc",    href: "/docs/target-rpc" },
      { title: "Awaitable RPC",        titleKey: "sidebar.pages.awaitableRpc", href: "/docs/awaitable-rpc", badge: "Advanced" },
      { title: "Static & Generic RPC", titleKey: "sidebar.pages.staticRpc",    href: "/docs/static-rpc",    badge: "Advanced" },
    ],
  },
  {
    title: "Sync Types",
    titleKey: "sidebar.sections.syncTypes",
    icon: "🔄",
    items: [
      { title: "SyncVar",        titleKey: "sidebar.pages.syncVar",        href: "/docs/syncvar" },
      { title: "SyncList",       titleKey: "sidebar.pages.syncList",       href: "/docs/synclist" },
      { title: "SyncDictionary", titleKey: "sidebar.pages.syncDictionary", href: "/docs/sync-dictionary" },
      { title: "SyncEvent",      titleKey: "sidebar.pages.syncEvent",      href: "/docs/sync-event" },
      { title: "SyncTimer",      titleKey: "sidebar.pages.syncTimer",      href: "/docs/sync-timer" },
      { title: "SyncInput",      titleKey: "sidebar.pages.syncInput",      href: "/docs/sync-input" },
    ],
  },
  {
    title: "Plug & Play",
    titleKey: "sidebar.sections.plugAndPlay",
    icon: "🔌",
    items: [
      { title: "Network Transform",  titleKey: "sidebar.pages.networkTransform",  href: "/docs/network-transform" },
      { title: "Network Animator",   titleKey: "sidebar.pages.networkAnimator",   href: "/docs/network-animator" },
      { title: "Network Rigidbody",  titleKey: "sidebar.pages.networkRigidbody",  href: "/docs/network-rigidbody" },
    ],
  },
  {
    title: "Code Features",
    titleKey: "sidebar.sections.codeFeatures",
    icon: "🎮",
    items: [
      { title: "Local Character to Online",    titleKey: "sidebar.pages.localCharacterToOnline", href: "/docs/local-character-to-online", badge: "Example" },
      { title: "Monster Status System",       titleKey: "sidebar.pages.monsterStatus",         href: "/docs/monster-status",          badge: "Example" },
      { title: "Inventory System",            titleKey: "sidebar.pages.inventorySystem",        href: "/docs/inventory-system",         badge: "Example" },
      { title: "Top Down Controller",         titleKey: "sidebar.pages.topDownController",       href: "/docs/top-down-controller",       badge: "Example" },
      { title: "3rd Person Controller",       titleKey: "sidebar.pages.thirdPersonController",   href: "/docs/third-person-controller",   badge: "Example" },
      { title: "Gameplay State Controller",   titleKey: "sidebar.pages.gameplayStateController", href: "/docs/gameplay-state-controller", badge: "Example" },
      { title: "Steam Connection Workflow",   titleKey: "sidebar.pages.steamConnectionWorkflow",  href: "/docs/steam-connection-workflow",  badge: "Example" },
    ],
  },
  {
    title: "Integration",
    titleKey: "sidebar.sections.integration",
    icon: "🔗",
    items: [
      { title: "Animancer", titleKey: "sidebar.pages.animancerIntegration", href: "/docs/animancer-integration", badge: "Integration" },
    ],
  },
  {
    title: "Advanced",
    titleKey: "sidebar.sections.advanced",
    icon: "⚡",
    items: [
      { title: "Broadcasts",             titleKey: "sidebar.pages.broadcasts",            href: "/docs/broadcasts" },
      { title: "Network Modules",        titleKey: "sidebar.pages.networkModules",         href: "/docs/network-modules" },
      { title: "PlayerIdentity",         titleKey: "sidebar.pages.playerIdentity",         href: "/docs/player-identity" },
      { title: "Authentication",         titleKey: "sidebar.pages.authentication",         href: "/docs/authentication" },
      { title: "BitPacker Serialization",titleKey: "sidebar.pages.bitpacker",              href: "/docs/bitpacker" },
      { title: "Transports",             titleKey: "sidebar.pages.transports",             href: "/docs/transports" },
      { title: "Client-Side Prediction", titleKey: "sidebar.pages.clientSidePrediction",   href: "/docs/client-side-prediction", badge: "PurrDiction" },
    ],
  },
];

export function getAllNavItems(): NavItem[] {
  return navSections.flatMap((s) => s.items);
}

export function getAdjacentPages(currentHref: string): { prev?: NavItem; next?: NavItem } {
  const all = getAllNavItems();
  const idx = all.findIndex((i) => i.href === currentHref);
  return {
    prev: idx > 0 ? all[idx - 1] : undefined,
    next: idx < all.length - 1 ? all[idx + 1] : undefined,
  };
}
