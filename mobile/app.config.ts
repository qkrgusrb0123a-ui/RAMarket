import { execFileSync } from 'node:child_process';

function currentGitCommit() {
  try {
    return execFileSync('git', ['rev-parse', '--short=7', 'HEAD'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

export default {
  expo: {
    name: 'RAMarket',
    slug: 'ramarket-mobile',
    version: '1.0.0',
    platforms: ['ios', 'android'],
    orientation: 'portrait',
    icon: './assets/app-icon-ram.png',
    userInterfaceStyle: 'light',
    extra: { gitCommit: currentGitCommit() },
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
      ['expo-notifications', { color: '#0E766E', defaultChannel: 'chat' }],
      ['expo-image-picker', { photosPermission: '판매 상품 사진을 선택하기 위해 사진 보관함에 접근합니다.', microphonePermission: false }]
    ]
  }
};
