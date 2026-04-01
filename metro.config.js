const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname, {
  isCSSEnabled: true,
});

config.transformer = {
  ...config.transformer,
  babelTransformerPath: path.resolve(__dirname, 'metro-css-transformer-wrapper.js'),
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};


const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver = {
  ...config.resolver,
  sourceExts: [...config.resolver.sourceExts, 'css'],
  platforms: ['ios', 'android', 'native', 'web'],
  extraNodeModules: {
    'react-native/Libraries/Utilities/codegenNativeCommands': require.resolve('./InternalBytecode.js'),
  },
  resolveRequest: (context, moduleName, platform) => {
    if (platform === 'web' && moduleName === 'react-native-worklets') {
      return {
        type: 'sourceFile',
        filePath: require.resolve('./worklets.web.js'),
      };
    }
    if (defaultResolveRequest) {
      try {
        return defaultResolveRequest(context, moduleName, platform);
      } catch (e) {
      }
    }
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;