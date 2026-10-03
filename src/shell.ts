// The atlas and "Gdzie boli?" are tabs of Soleil, the app at the site's root. Opened on their own
// (a bookmark, an old home-screen icon, a shared link) they'd have no tab bar and, installed on an
// iPhone, no way back, so they hand over to Soleil on their tab. ?solo keeps them on their own.

/** True when this page should render here; false when it is already on its way to Soleil. */
export function stayOrOpenInSoleil(tab: 'cialo' | 'objawy'): boolean {
  if (!import.meta.env.PROD || window.top !== window.self) return true
  if (new URLSearchParams(location.search).has('solo')) return true
  location.replace(new URL(`../#${tab}`, location.href))
  return false
}
