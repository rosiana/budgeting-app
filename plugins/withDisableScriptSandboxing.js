/**
 * Config plugin: disable Xcode's "User Script Sandboxing".
 *
 * Xcode 15+ defaults ENABLE_USER_SCRIPT_SANDBOXING to YES, which blocks the
 * React Native / Expo build-phase scripts from writing files like `ip.txt`
 * into the app bundle, failing the build with a "Sandbox: deny
 * file-write-create" error. Turning it off on every build configuration
 * restores the expected behavior. Re-applied automatically on each prebuild.
 */
const { withXcodeProject } = require('@expo/config-plugins');

module.exports = function withDisableScriptSandboxing(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const configurations = project.pbxXCBuildConfigurationSection();
    for (const key in configurations) {
      const entry = configurations[key];
      if (entry && entry.buildSettings) {
        entry.buildSettings.ENABLE_USER_SCRIPT_SANDBOXING = 'NO';
      }
    }
    return cfg;
  });
};
