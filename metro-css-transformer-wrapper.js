const path = require('path');

let cssTransformer;
let metroTransformer;

try {
  cssTransformer = require('react-native-css-transformer');
} catch (e) {
  // CSS transformer not available, will use fallback
}

try {
  metroTransformer = require('metro-react-native-babel-transformer');
} catch (e) {
  try {
    // Fallback to Expo's default transformer
    metroTransformer = require('@expo/metro-config/babel-transformer');
  } catch (e2) {
    // If all else fails, we'll handle it in the transform function
  }
}

module.exports.transform = function (src, filename, options) {
  // Safety check: ensure filename exists and is a string
  if (!filename || typeof filename !== 'string') {
    // If no valid filename, use default transformer
    if (metroTransformer && typeof metroTransformer.transform === 'function') {
      return metroTransformer.transform(src, filename, options);
    }
    // Ultimate fallback
    return {
      ast: null,
      code: src || '',
      map: null,
    };
  }

  // Check if this is a CSS file
  const isCssFile = filename.endsWith('.css') || filename.endsWith('.module.css');
  
  if (isCssFile) {
    // Skip CSS transformation for files in node_modules on web platform
    // These should be handled by Expo's webpack bundler
    if (options && options.platform === 'web' && filename.includes('node_modules')) {
      // Return empty module for web node_modules CSS
      // Expo's webpack will handle these files
      return {
        ast: null,
        code: 'module.exports = {};',
        map: null,
      };
    }
    // Use CSS transformer for project CSS files or native platforms
    if (cssTransformer && typeof cssTransformer.transform === 'function') {
      try {
        return cssTransformer.transform(src, filename, options);
      } catch (e) {
        // If CSS transformer fails, return empty module
        return {
          ast: null,
          code: 'module.exports = {};',
          map: null,
        };
      }
    }
    // Fallback if CSS transformer is not available
    return {
      ast: null,
      code: 'module.exports = {};',
      map: null,
    };
  }
  
  // For non-CSS files, use the default Metro transformer
  if (metroTransformer && typeof metroTransformer.transform === 'function') {
    try {
      const result = metroTransformer.transform(src, filename, options);
      // Ensure result has proper structure
      if (result && typeof result === 'object') {
        return {
          ast: result.ast || null,
          code: result.code || src || '',
          map: result.map || null,
        };
      }
      return result;
    } catch (e) {
      // If transformation fails, return source code as-is
      console.warn(`Transformer error for ${filename}:`, e.message);
      return {
        ast: null,
        code: src || '',
        map: null,
      };
    }
  }
  
  // Ultimate fallback
  return {
    ast: null,
    code: src || '',
    map: null,
  };
};
