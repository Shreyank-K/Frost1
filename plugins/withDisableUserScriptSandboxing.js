const { withXcodeProject } = require("@expo/config-plugins");

/**
 * Disables Xcode user script sandboxing for the generated iOS project.
 *
 * EAS build 024ebedb-84d8-4bf8-bdd6-b3c0aa5e4e9e failed in the
 * "Bundle React Native code and images" phase because Xcode sandboxed
 * the React Native bundling script and denied file reads from ios/.
 */
module.exports = function withDisableUserScriptSandboxing(config) {
  return withXcodeProject(config, (config) => {
    const project = config.modResults;

    project.addBuildProperty("ENABLE_USER_SCRIPT_SANDBOXING", "NO");

    return config;
  });
};
