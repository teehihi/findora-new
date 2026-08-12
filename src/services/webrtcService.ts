import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

// WebRTC Peer Connection instance reference
let peerConnection: any = null;
let localStream: any = null;
let remoteStream: any = null;

const rtcConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

// Initialize WebRTC Voice Stream
export async function startWebRTCCall(chatId: string, isCaller: boolean) {
  try {
    // In React Native / Expo, safe load RTCPeerConnection & mediaDevices if available
    let RTCPeerConnectionClass: any = null;
    let mediaDevicesObj: any = null;

    try {
      const webrtc = require('react-native-webrtc');
      RTCPeerConnectionClass = webrtc.RTCPeerConnection;
      mediaDevicesObj = webrtc.mediaDevices;
    } catch (e) {
      console.log('WebRTC native module notice: using Web / Fallback RTC engine');
    }

    if (!RTCPeerConnectionClass && typeof window !== 'undefined' && (window as any).RTCPeerConnection) {
      RTCPeerConnectionClass = (window as any).RTCPeerConnection;
      mediaDevicesObj = navigator.mediaDevices;
    }

    if (!RTCPeerConnectionClass) {
      console.log('WebRTC P2P audio initialized in signaling mode.');
      return;
    }

    peerConnection = new RTCPeerConnectionClass(rtcConfiguration);

    // Get microphone audio stream
    if (mediaDevicesObj && mediaDevicesObj.getUserMedia) {
      localStream = await mediaDevicesObj.getUserMedia({ audio: true, video: false });
      if (localStream && localStream.getTracks) {
        localStream.getTracks().forEach((track: any) => {
          peerConnection.addTrack(track, localStream);
        });
      }
    }

    // Handle incoming remote audio stream
    peerConnection.ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        remoteStream = event.streams[0];
        console.log('Remote voice audio stream connected!');
      }
    };

    const chatDocRef = doc(db, 'chats', chatId);

    if (isCaller) {
      // Caller creates SDP Offer
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      await updateDoc(chatDocRef, {
        'callState.sdpOffer': { sdp: offer.sdp, type: offer.type }
      });

      // Listen for SDP Answer from receiver
      const unsub = onSnapshot(chatDocRef, async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const answer = data.callState?.sdpAnswer;
          if (answer && peerConnection && !peerConnection.currentRemoteDescription) {
            await peerConnection.setRemoteDescription(new (window as any).RTCSessionDescription(answer));
            unsub();
          }
        }
      });
    } else {
      // Receiver responds with SDP Answer
      const unsub = onSnapshot(chatDocRef, async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const offer = data.callState?.sdpOffer;
          if (offer && peerConnection && !peerConnection.currentRemoteDescription) {
            await peerConnection.setRemoteDescription(new (window as any).RTCSessionDescription(offer));

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            await updateDoc(chatDocRef, {
              'callState.sdpAnswer': { sdp: answer.sdp, type: answer.type }
            });
            unsub();
          }
        }
      });
    }
  } catch (e) {
    console.log('WebRTC P2P audio error:', e);
  }
}

export function stopWebRTCCall() {
  try {
    if (localStream && localStream.getTracks) {
      localStream.getTracks().forEach((track: any) => track.stop());
      localStream = null;
    }
    if (remoteStream && remoteStream.getTracks) {
      remoteStream.getTracks().forEach((track: any) => track.stop());
      remoteStream = null;
    }
    if (peerConnection) {
      peerConnection.close();
      peerConnection = null;
    }
  } catch (e) {
    console.log('Error stopping WebRTC call:', e);
  }
}
