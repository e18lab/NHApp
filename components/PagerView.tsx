// Expo will automatically use PagerView.web.tsx on web platform
// For native platforms, we use the actual react-native-pager-view
import { Platform } from 'react-native';

let PagerViewComponent: any;

try {
  if (Platform.OS === 'web') {
    PagerViewComponent = require('./PagerView.web').default;
  } else {
    PagerViewComponent = require('react-native-pager-view').default;
  }
} catch (e) {
  // Fallback for web if direct import fails
  if (Platform.OS === 'web') {
    PagerViewComponent = require('./PagerView.web').default;
  } else {
    throw e;
  }
}

export default PagerViewComponent;
