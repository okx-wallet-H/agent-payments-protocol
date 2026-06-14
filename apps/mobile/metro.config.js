const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
const conditionNames = config.resolver.unstable_conditionNames ?? [];

config.resolver.unstable_conditionNames = [
  "browser",
  "react-native",
  ...conditionNames
].filter((conditionName, index, allConditionNames) => allConditionNames.indexOf(conditionName) === index);

module.exports = config;
