

import { Platform } from 'react-native';

let PagerViewComponent: any;

try {
  if (Platform.OS === 'web') {
    PagerViewComponent = require('./PagerView.web').default;
  } else {
    PagerViewComponent = require('react-native-pager-view').default;
  }
} catch (e) {
  if (Platform.OS === 'web') {
    PagerViewComponent = require('./PagerView.web').default;
  } else {
    throw e;
  }
}

export default PagerViewComponent;
