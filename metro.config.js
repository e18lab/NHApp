const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname, {
  isCSSEnabled: true,
});

config.transformer = {
  ...config.transformer,
  // Use a wrapper that conditionally applies CSS transformer
  babelTransformerPath: path.resolve(__dirname, 'metro-css-transformer-wrapper.js'),
  getTransformOptions: async () => ({
    transform: {
      experimentalImportSupport: false,
      inlineRequires: true,
    },
  }),
};

// Store original resolveRequest if it exists
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver = {
  ...config.resolver,
  sourceExts: [...config.resolver.sourceExts, 'css'],
  platforms: ['ios', 'android', 'native', 'web'],
  extraNodeModules: {
    'react-native/Libraries/Utilities/codegenNativeCommands': require.resolve('./InternalBytecode.js'),
  },
  resolveRequest: (context, moduleName, platform) => {
    // On web, replace react-native-worklets with our mock
    if (platform === 'web' && moduleName === 'react-native-worklets') {
      return {
        type: 'sourceFile',
        filePath: require.resolve('./worklets.web.js'),
      };
    }
    // Use default resolution for other cases
    if (defaultResolveRequest) {
      try {
        return defaultResolveRequest(context, moduleName, platform);
      } catch (e) {
        // If default resolution fails, fall through to Metro's default
      }
    }
    // Fallback to default Metro resolution
    return context.resolveRequest(context, moduleName, platform);
  },
};

module.exports = config;