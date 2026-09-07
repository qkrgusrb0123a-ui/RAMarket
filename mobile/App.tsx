import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { authApi, type AuthSession } from './src/auth';
import { clearSession, loadSession, saveSession } from './src/auth-storage';

type Mode = 'sign-in' | 'sign-up';

const ramGreen = '#0E766E';

export default function App() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadSession().then(setSession).catch(() => undefined).finally(() => setIsRestoring(false));
  }, []);

  function selectMode(nextMode: Mode) {
    setMode(nextMode);
    setPassword('');
    setPasswordConfirmation('');
    setError('');
  }

  async function submit() {
    const normalizedId = loginId.trim().toLowerCase();
    if (!/^[a-z0-9][a-z0-9_-]{3,19}$/.test(normalizedId)) {
      setError('아이디는 영문 소문자, 숫자, 밑줄(_), 하이픈(-)으로 된 4~20자여야 합니다.');
      return;
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상으로 입력해 주세요.');
      return;
    }
    if (mode === 'sign-up' && password !== passwordConfirmation) {
      setError('비밀번호 확인이 일치하지 않습니다.');
      return;
    }

    setError('');
    setIsSubmitting(true);
    try {
      const result = mode === 'sign-up'
        ? await authApi.signUp(normalizedId, password)
        : await authApi.signIn(normalizedId, password);
      await saveSession(result);
      setSession(result);
      setPassword('');
      setPasswordConfirmation('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function signOut() {
    await clearSession();
    setSession(null);
    setLoginId('');
    setPassword('');
    setPasswordConfirmation('');
  }

  if (isRestoring) {
    return <SafeAreaView style={styles.safe}><StatusBar style="dark" /><View style={styles.loader}><ActivityIndicator color={ramGreen} size="large" /><Text style={styles.loaderText}>계정을 확인하고 있어요</Text></View></SafeAreaView>;
  }

  if (session) {
    return <SafeAreaView style={styles.safe}><StatusBar style="dark" /><View style={styles.successWrap}>
      <RamarketBrand />
      <View style={styles.successIcon}><Text style={styles.successCheck}>✓</Text></View>
      <Text style={styles.successTitle}>로그인되었습니다</Text>
      <Text style={styles.successBody}><Text style={styles.userName}>{session.user.loginId}</Text>님, RAMarket에 오신 것을 환영합니다.</Text>
      <View style={styles.sessionNotice}><Text style={styles.sessionNoticeText}>로그인 정보는 이 기기의 보안 저장소에 보관됩니다.</Text></View>
      <Pressable accessibilityRole="button" onPress={signOut} style={({ pressed }) => [styles.secondaryButton, pressed && styles.secondaryButtonPressed]}><Text style={styles.secondaryButtonText}>로그아웃</Text></Pressable>
    </View></SafeAreaView>;
  }

  const isSignUp = mode === 'sign-up';
  return <SafeAreaView style={styles.safe}><StatusBar style="dark" /><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboard}>
    <View style={styles.content}>
      <RamarketBrand />
      {isSignUp ? <View style={styles.signUpHeading}><Text style={styles.signUpTitle}>회원가입</Text><Text style={styles.signUpDescription}>아이디와 비밀번호를 입력해 계정을 만드세요.</Text></View> : null}
      <View style={[styles.form, isSignUp && styles.compactForm]}>
        <Text style={styles.label}>아이디</Text>
        <TextInput value={loginId} onChangeText={setLoginId} autoCapitalize="none" autoCorrect={false} autoComplete="username" placeholder="아이디를 입력하세요" placeholderTextColor="#89948F" maxLength={20} style={styles.input} accessibilityLabel="아이디" />
        <Text style={styles.label}>비밀번호</Text>
        <View style={styles.passwordRow}>
          <TextInput value={password} onChangeText={setPassword} autoCapitalize="none" autoCorrect={false} autoComplete={isSignUp ? 'new-password' : 'current-password'} secureTextEntry={!showPassword} placeholder="비밀번호를 입력하세요" placeholderTextColor="#89948F" maxLength={72} style={styles.passwordInput} accessibilityLabel="비밀번호" />
          <Pressable onPress={() => setShowPassword((value) => !value)} accessibilityRole="button" accessibilityLabel={showPassword ? '비밀번호 숨기기' : '비밀번호 보이기'} hitSlop={8} style={({ pressed }) => [styles.showButton, pressed && styles.showButtonPressed]}><Text style={styles.showButtonText}>{showPassword ? '숨김' : '보기'}</Text></Pressable>
        </View>
        {isSignUp ? <><Text style={styles.label}>비밀번호 확인</Text><TextInput value={passwordConfirmation} onChangeText={setPasswordConfirmation} autoCapitalize="none" autoCorrect={false} autoComplete="new-password" secureTextEntry placeholder="비밀번호를 한 번 더 입력하세요" placeholderTextColor="#89948F" maxLength={72} style={styles.input} accessibilityLabel="비밀번호 확인" /></> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <Pressable disabled={isSubmitting} onPress={submit} accessibilityRole="button" style={({ pressed }) => [styles.primaryButton, (pressed || isSubmitting) && styles.primaryButtonPressed, isSubmitting && styles.disabledButton]}>
          {isSubmitting ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{isSignUp ? '회원가입' : '로그인'}</Text>}
        </Pressable>
        <Pressable disabled={isSubmitting} onPress={() => selectMode(isSignUp ? 'sign-in' : 'sign-up')} accessibilityRole="button" style={({ pressed }) => [styles.signUpButton, pressed && styles.signUpButtonPressed, isSubmitting && styles.disabledButton]}>
          <Text style={styles.signUpButtonText}>{isSignUp ? '로그인으로 돌아가기' : '회원가입'}</Text>
        </Pressable>
      </View>
      <Text style={styles.securityNote}>비밀번호는 안전한 단방향 해시로 저장됩니다.</Text>
    </View>
  </KeyboardAvoidingView></SafeAreaView>;
}

function RamarketBrand() {
  return <View style={styles.brandRow} accessibilityLabel="RAMarket">
    <View style={styles.ramMark}>
      <View style={styles.ramNotchLeft} /><View style={styles.ramNotchRight} />
      <View style={styles.ramChips}><View style={styles.ramChip} /><View style={styles.ramChip} /><View style={styles.ramChip} /><View style={styles.ramChip} /></View>
      <View style={styles.ramPins}>{Array.from({ length: 7 }, (_, index) => <View key={index} style={styles.ramPin} />)}</View>
    </View>
    <Text style={styles.brand}>RAMarket</Text>
  </View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  keyboard: { flex: 1 },
  content: { flex: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 28 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loaderText: { color: '#68736F', fontSize: 16, fontWeight: '600' },
  brandRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 12 },
  ramMark: { width: 72, height: 42, justifyContent: 'center', paddingHorizontal: 9, borderRadius: 5, backgroundColor: ramGreen, overflow: 'hidden' },
  ramNotchLeft: { position: 'absolute', left: -5, top: 15, width: 10, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },
  ramNotchRight: { position: 'absolute', right: -5, top: 15, width: 10, height: 12, borderRadius: 6, backgroundColor: '#FFFFFF' },
  ramChips: { flexDirection: 'row', gap: 4 },
  ramChip: { flex: 1, height: 16, borderRadius: 2, backgroundColor: '#FFFFFF' },
  ramPins: { position: 'absolute', bottom: 0, left: 10, right: 10, height: 7, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  ramPin: { width: 5, height: 6, backgroundColor: '#D8BF64' },
  brand: { color: ramGreen, fontSize: 31, fontWeight: '800', letterSpacing: -1.3 },
  signUpHeading: { alignItems: 'center', marginTop: 34 },
  signUpTitle: { color: '#16201F', fontSize: 28, fontWeight: '800' },
  signUpDescription: { marginTop: 8, color: '#68736F', fontSize: 15 },
  form: { marginTop: 74 },
  compactForm: { marginTop: 34 },
  label: { marginBottom: 9, color: '#087166', fontSize: 18, fontWeight: '800' },
  input: { height: 72, marginBottom: 24, paddingHorizontal: 20, borderWidth: 2, borderColor: '#D7DDDA', borderRadius: 18, backgroundColor: '#FFFFFF', color: '#16201F', fontSize: 19 },
  passwordRow: { height: 72, flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingLeft: 20, paddingRight: 8, borderWidth: 2, borderColor: '#D7DDDA', borderRadius: 18, backgroundColor: '#FFFFFF' },
  passwordInput: { flex: 1, height: '100%', color: '#16201F', fontSize: 19 },
  showButton: { minWidth: 56, alignItems: 'center', paddingHorizontal: 12, paddingVertical: 13, borderRadius: 12 },
  showButtonPressed: { backgroundColor: '#EAF4F1', transform: [{ scale: 0.94 }] },
  showButtonText: { color: ramGreen, fontSize: 15, fontWeight: '800' },
  error: { marginBottom: 18, paddingHorizontal: 15, paddingVertical: 13, borderRadius: 14, backgroundColor: '#FFF0F0', color: '#B9382F', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  primaryButton: { height: 64, alignItems: 'center', justifyContent: 'center', marginTop: 4, borderRadius: 18, backgroundColor: ramGreen, shadowColor: '#075950', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.22, shadowRadius: 7, elevation: 4 },
  primaryButtonPressed: { backgroundColor: '#075950', transform: [{ scale: 0.975 }], shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, elevation: 2 },
  disabledButton: { opacity: 0.68 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 22, fontWeight: '800' },
  signUpButton: { height: 64, alignItems: 'center', justifyContent: 'center', marginTop: 20, borderWidth: 2, borderColor: ramGreen, borderRadius: 18, backgroundColor: '#FFFFFF' },
  signUpButtonPressed: { backgroundColor: '#EAF4F1', transform: [{ scale: 0.975 }] },
  signUpButtonText: { color: ramGreen, fontSize: 21, fontWeight: '800' },
  securityNote: { marginTop: 26, color: '#89948F', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  successWrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 30 },
  successIcon: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 55, borderRadius: 20, backgroundColor: '#DDF3ED' },
  successCheck: { color: ramGreen, fontSize: 30, fontWeight: '800' },
  successTitle: { marginTop: 16, color: '#16201F', fontSize: 28, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center' },
  successBody: { marginTop: 12, color: '#68736F', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  userName: { color: '#16201F', fontWeight: '800' },
  sessionNotice: { marginTop: 28, padding: 16, borderRadius: 14, backgroundColor: '#EAF4F1' },
  sessionNoticeText: { color: '#46635C', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  secondaryButton: { height: 56, alignItems: 'center', justifyContent: 'center', marginTop: 22, borderWidth: 1, borderColor: '#D0DAD6', borderRadius: 14, backgroundColor: '#FFFFFF' },
  secondaryButtonPressed: { backgroundColor: '#EAF4F1', transform: [{ scale: 0.98 }] },
  secondaryButtonText: { color: '#40514C', fontSize: 16, fontWeight: '800' }
});
