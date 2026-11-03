import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClerkProvider, useAuth } from '@clerk/react'
import { api, setAuthTokenGetter } from './api'

/**
 * Customer authentication (Clerk) — customers only, never admin.
 * The publishable key comes from the API at runtime (/account/config), so a build never embeds a key and an
 * environment without customer auth (e.g. production until cutover) simply renders the site without accounts.
 */
interface RuntimeConfig { environment: string | null; clerkPublishableKey: string | null; clerkInstance: 'development' | 'production' | null; briefRequiresAccount: boolean }
interface CustomerAuthState { enabled: boolean; loaded: boolean; signedIn: boolean; instance: RuntimeConfig['clerkInstance']; briefRequiresAccount: boolean }

const DISABLED: CustomerAuthState = { enabled: false, loaded: true, signedIn: false, instance: null, briefRequiresAccount: false }
const Ctx = createContext<CustomerAuthState>(DISABLED)
export const useCustomerAuth = () => useContext(Ctx)

/** Only same-site relative paths are accepted as post-auth redirects (no open redirect). */
export function safeRedirect(v: string | null | undefined, fallback = '/account') {
  return v && /^\/(?!\/)[A-Za-z0-9/_\-?=&.%#]*$/.test(v) && !v.startsWith('/admin') ? v : fallback
}

function ClerkBridge({ cfg, children }: { cfg: RuntimeConfig; children: ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useAuth()
  useEffect(() => {
    setAuthTokenGetter(isSignedIn ? () => getToken() : null)
    return () => setAuthTokenGetter(null)
  }, [isSignedIn, getToken])
  return (
    <Ctx.Provider value={{ enabled: true, loaded: isLoaded, signedIn: !!isSignedIn, instance: cfg.clerkInstance, briefRequiresAccount: cfg.briefRequiresAccount }}>
      {children}
    </Ctx.Provider>
  )
}

export function CustomerAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [cfg, setCfg] = useState<RuntimeConfig | null | undefined>(undefined)
  useEffect(() => {
    api<RuntimeConfig>('/account/config').then(setCfg).catch(() => setCfg(null))
  }, [])
  if (cfg === undefined) return <Ctx.Provider value={{ ...DISABLED, loaded: false }}>{children}</Ctx.Provider>
  if (!cfg?.clerkPublishableKey) return <Ctx.Provider value={DISABLED}>{children}</Ctx.Provider>
  return (
    <ClerkProvider
      publishableKey={cfg.clerkPublishableKey}
      routerPush={(to: string) => navigate(to)}
      routerReplace={(to: string) => navigate(to, { replace: true })}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      afterSignOutUrl="/"
      telemetry={false}
    >
      <ClerkBridge cfg={cfg}>{children}</ClerkBridge>
    </ClerkProvider>
  )
}
