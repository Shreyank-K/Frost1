import { Platform } from 'react-native';
import { IOS_REWARDED_THRIFT_AD_UNIT_ID } from './adConfig';

let adsModule = null;
let initialized = false;

function loadAdsModule() {
  if (Platform.OS !== 'ios') {
    return { ok: false, error: 'Rewarded ads are only enabled for the iOS app.' };
  }

  if (adsModule) {
    return { ok: true, module: adsModule };
  }

  try {
    // This native module is unavailable in Expo Go, so keep loading lazy and recoverable.
    adsModule = require('react-native-google-mobile-ads');
    return { ok: true, module: adsModule };
  } catch (error) {
    return {
      ok: false,
      error: 'Rewarded ads require an iOS development, TestFlight, or App Store build.',
      detail: error?.message || String(error),
    };
  }
}

async function initializeMobileAds(module) {
  if (initialized) return;

  const mobileAds = module.default;
  if (typeof mobileAds !== 'function') {
    throw new Error('Google Mobile Ads SDK was not available.');
  }

  await mobileAds().initialize();
  initialized = true;
}

function rewardAdUnitId(module) {
  if (__DEV__ && module.TestIds?.REWARDED) {
    return module.TestIds.REWARDED;
  }
  return IOS_REWARDED_THRIFT_AD_UNIT_ID;
}

export async function showRewardedThriftAd() {
  const loadedModule = loadAdsModule();
  if (!loadedModule.ok) return loadedModule;

  const module = loadedModule.module;
  const { AdEventType, RewardedAd, RewardedAdEventType } = module;

  if (!AdEventType || !RewardedAd || !RewardedAdEventType) {
    return { ok: false, error: 'Rewarded ad APIs were not available in this build.' };
  }

  try {
    await initializeMobileAds(module);
  } catch (error) {
    return { ok: false, error: error?.message || 'Could not initialize Google Mobile Ads.' };
  }

  const rewarded = RewardedAd.createForAdRequest(rewardAdUnitId(module), {
    requestNonPersonalizedAdsOnly: true,
    keywords: ['shopping', 'resale', 'deals', 'thrift'],
  });

  return new Promise((resolve) => {
    let settled = false;
    let earnedReward = null;
    const unsubscribers = [];

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      unsubscribers.forEach((unsubscribe) => {
        try {
          unsubscribe();
        } catch {}
      });
      resolve(result);
    };

    const timeout = setTimeout(() => {
      finish({ ok: false, error: 'The rewarded ad took too long to finish loading.' });
    }, 90000);

    try {
      unsubscribers.push(
        rewarded.addAdEventListener(RewardedAdEventType.LOADED, () => {
          try {
            Promise.resolve(rewarded.show()).catch((error) => {
              finish({ ok: false, error: error?.message || 'Could not show the rewarded ad.' });
            });
          } catch (error) {
            finish({ ok: false, error: error?.message || 'Could not show the rewarded ad.' });
          }
        })
      );

      unsubscribers.push(
        rewarded.addAdEventListener(RewardedAdEventType.EARNED_REWARD, (reward) => {
          earnedReward = reward || { amount: 3, type: 'scans' };
        })
      );

      unsubscribers.push(
        rewarded.addAdEventListener(AdEventType.CLOSED, () => {
          if (earnedReward) {
            finish({ ok: true, reward: earnedReward });
          } else {
            finish({ ok: false, error: 'Ad closed before the reward was earned.' });
          }
        })
      );

      unsubscribers.push(
        rewarded.addAdEventListener(AdEventType.ERROR, (error) => {
          finish({ ok: false, error: error?.message || 'Could not load a rewarded ad right now.' });
        })
      );

      rewarded.load();
    } catch (error) {
      finish({ ok: false, error: error?.message || 'Could not start the rewarded ad.' });
    }
  });
}

