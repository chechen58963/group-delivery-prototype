import BaefShell from './BaefShell'
import { AppPreferencesProvider } from './AppPreferences'
import { MenuDiscoveryProvider } from './MenuDiscoveryContext'
import { DeliveryLifecycleProvider } from './DeliveryLifecycle'
import { WalkingRewardsProvider } from './WalkingRewards'

export default function App() {
  return (
    <AppPreferencesProvider>
      <MenuDiscoveryProvider>
        <DeliveryLifecycleProvider>
          <WalkingRewardsProvider>
            <BaefShell />
          </WalkingRewardsProvider>
        </DeliveryLifecycleProvider>
      </MenuDiscoveryProvider>
    </AppPreferencesProvider>
  )
}
