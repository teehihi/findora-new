import { NativeModules, Platform } from 'react-native';

const { PipAndroid } = NativeModules;

export const enterPipMode = async (aspectWidth = 16, aspectHeight = 9): Promise<boolean> => {
  if (Platform.OS !== 'android' || !PipAndroid) return false;
  try {
    return await PipAndroid.enterPip(aspectWidth, aspectHeight);
  } catch (e) {
    console.log('Error entering PiP mode:', e);
    return false;
  }
};

export const setAutoPip = async (enabled: boolean): Promise<boolean> => {
  if (Platform.OS !== 'android' || !PipAndroid) return false;
  try {
    return await PipAndroid.setAutoPip(enabled);
  } catch (e) {
    console.log('Error setting auto PiP mode:', e);
    return false;
  }
};

export const isPipSupported = async (): Promise<boolean> => {
  if (Platform.OS !== 'android' || !PipAndroid) return false;
  try {
    return await PipAndroid.isPipSupported();
  } catch (e) {
    return false;
  }
};
