export default {
  expo: {
    name: 'RAMarket',
    slug: 'ramarket-mobile',
    version: '1.0.0',
    platforms: ['ios', 'android'],
    orientation: 'portrait',
    icon: './assets/app-icon-ram.png',
    userInterfaceStyle: 'light',
    ios: { supportsTablet: true, bundleIdentifier: 'com.ramarket.mobile' },
    android: {
      package: 'com.ramarket.mobile',
      softwareKeyboardLayoutMode: 'resize',
      adaptiveIcon: {
        backgroundColor: '#DDF4EE',
        foregroundImage: './assets/app-icon-ram.png'
      },
      predictiveBackGestureEnabled: false
    },
    plugins: [
      'expo-secure-store',
      ['expo-image-picker', { photosPermission: '판매 상품 사진을 선택하기 위해 사진 보관함에 접근합니다.', microphonePermission: false }]
    ]
  }
};
