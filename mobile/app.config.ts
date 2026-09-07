export default {
  expo: {
    name: 'RAMarket',
    slug: 'ramarket-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    ios: { supportsTablet: true, bundleIdentifier: 'com.ramarket.mobile' },
    android: {
      package: 'com.ramarket.mobile',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png'
      },
      predictiveBackGestureEnabled: false
    },
    plugins: [
      'expo-secure-store',
      ['expo-image-picker', { photosPermission: '판매 상품 사진을 선택하기 위해 사진 보관함에 접근합니다.', microphonePermission: false }]
    ]
  }
};
