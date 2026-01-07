const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname, {
  isCSSEnabled: true,
});

config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve('react-native-css-transformer'),
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

config.resolver = {
  ...config.resolver,
  sourceExts: [...config.resolver.sourceExts, 'css'],
  extraNodeModules: {
    'react-native/Libraries/Utilities/codegenNativeCommands': null,
  },
};

module.exports = config;