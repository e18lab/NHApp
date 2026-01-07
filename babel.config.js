module.exports = function (api) {
  api.cache(true);
  
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Use reanimated plugin - it works on both web and native
      // On web, worklets are replaced with mock via metro.config.js
      // The plugin must be listed last
      'react-native-reanimated/plugin',
    ],
  };
};
