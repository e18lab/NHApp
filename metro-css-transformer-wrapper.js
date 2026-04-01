const path = require('path');

let cssTransformer;
let metroTransformer;

try {
  cssTransformer = require('react-native-css-transformer');
} catch (e) {
}

try {
  metroTransformer = require('metro-react-native-babel-transformer');
} catch (e) {
  try {
    metroTransformer = require('@expo/metro-config/babel-transformer');
  } catch (e2) {
  }
}

module.exports.transform = function (src, filename, options) {
  if (!filename || typeof filename !== 'string') {
    if (metroTransformer && typeof metroTransformer.transform === 'function') {
      return metroTransformer.transform(src, filename, options);
    }
    return {
      ast: null,
      code: src || '',
      map: null,
    };
  }

  const isCssFile = filename.endsWith('.css') || filename.endsWith('.module.css');
  if (isCssFile) {
    if (options && options.platform === 'web' && filename.includes('node_modules')) {
      return {
        ast: null,
        code: 'module.exports = {};',
        map: null,
      };
    }
    if (cssTransformer && typeof cssTransformer.transform === 'function') {
      try {
        return cssTransformer.transform(src, filename, options);
      } catch (e) {
        return {
          ast: null,
          code: 'module.exports = {};',
          map: null,
        };
      }
    }
    return {
      ast: null,
      code: 'module.exports = {};',
      map: null,
    };
  }
  if (metroTransformer && typeof metroTransformer.transform === 'function') {
    try {
      const result = metroTransformer.transform(src, filename, options);
      if (result && typeof result === 'object') {
        return {
          ast: result.ast || null,
          code: result.code || src || '',
          map: result.map || null,
        };
      }
      return result;
    } catch (e) {
      console.warn(`Transformer error for ${filename}:`, e.message);
      return {
        ast: null,
        code: src || '',
        map: null,
      };
    }
  }
  return {
    ast: null,
    code: src || '',
    map: null,
  };
};
