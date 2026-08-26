const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const originalResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web') {
    if (moduleName === '@callstack/liquid-glass' || moduleName.startsWith('@callstack/liquid-glass')) {
      return {
        filePath: path.resolve(__dirname, 'src/utils/webStubs/liquidGlass.tsx'),
        type: 'sourceFile',
      };
    }
    if (moduleName === 'react-native-maps' || moduleName.startsWith('react-native-maps')) {
      return {
        filePath: path.resolve(__dirname, 'src/utils/webStubs/reactNativeMaps.tsx'),
        type: 'sourceFile',
      };
    }
  }

  if (originalResolveRequest) {
    return originalResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
