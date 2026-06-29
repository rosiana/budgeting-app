/**
 * Strips the `aps-environment` entitlement that expo-notifications adds to the
 * iOS entitlements file. We only use local notifications — APNs entitlement
 * requires a paid Apple Developer account to sign, which would block builds on
 * the free-tier Apple ID used here.
 */
const { withEntitlementsPlist } = require('@expo/config-plugins');

module.exports = function withNoPushEntitlement(config) {
  return withEntitlementsPlist(config, (cfg) => {
    if (cfg.modResults && 'aps-environment' in cfg.modResults) {
      delete cfg.modResults['aps-environment'];
    }
    return cfg;
  });
};
