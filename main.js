let app_id = "e11e2e89089e44a69f1bb8ccccfc82e0";
let token = null;
let uid = String(Math.floor(Math.random() * 10000));

let clinnet;
let chanel;

let queryString = window.location.search;
let urlParams = new URLSearchParams(queryString);
let roomId = urlParams.get('room');

if (!roomId) {
    window.location = 'lobby.html'; // Redirect to lobby if room ID is not provided
}

let localStream;
let remoteStream;
let peerConnection;

const iceServers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ]
};

let handleUserJoined = async (memberId) => {
    console.log("A new User Joined the channel:", memberId);
    createOffer(memberId);
};

let init = async () => {
    clinnet = await AgoraRTM.createInstance(app_id);
    await clinnet.login({ uid, token });
    chanel = clinnet.createChannel(roomId);
    chanel.on('MemberJoined', handleUserJoined);
    clinnet.on('MessageFromPeer', handleMessageFromPeer);
    await chanel.join();
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });

    document.getElementById('user-1').srcObject = localStream;

    // Initialize remoteStream
    remoteStream = new MediaStream();
    document.getElementById('user-2').srcObject = remoteStream;
};

let handleMessageFromPeer = async (message, memberId) => {
    message = JSON.parse(message.text);

    if (message.type === 'offer') {
        await createPeerConnection(memberId);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(message.offer));
        let answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        clinnet.sendMessageToPeer({ text: JSON.stringify({ 'type': 'answer', 'answer': answer }) }, memberId);
    }

    if (message.type === 'answer') {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(message.answer));
    }

    if (message.type === 'candidate') {
        if (peerConnection) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        }
    }
};

let createPeerConnection = async (memberId) => {
    peerConnection = new RTCPeerConnection(iceServers);

    peerConnection.onicecandidate = async (e) => {
        if (e.candidate) {
            console.log("New ICE Candidate", e.candidate);
            clinnet.sendMessageToPeer({ text: JSON.stringify({ 'type': 'candidate', 'candidate': e.candidate }) }, memberId);
        }
    };

    peerConnection.ontrack = (e) => {
        e.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track, remoteStream); // Add incoming track to remoteStream
        });
    };

    // Add local stream tracks to the peer connection
    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });
};

let createOffer = async (memberId) => {
    await createPeerConnection(memberId);
    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    clinnet.sendMessageToPeer({ text: JSON.stringify({ 'type': 'offer', 'offer': offer }) }, memberId);
};

let leaveChannel = async () => {
    await chanel.leave();
    await clinnet.logout();
};

let toggleCamera = async () => {
    let videoTrack = localStream.getVideoTracks()[0];

    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        let color = videoTrack.enabled ? 'rgb(179, 102, 249, .9)' : 'rgb(255, 80, 80)';
        document.getElementById('camera-btn').style.backgroundColor = color;
    }
};

let toggleMic = async () => {
    let audioTrack = localStream.getAudioTracks()[0];

    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        let color = audioTrack.enabled ? 'rgb(179, 102, 249, .9)' : 'rgb(255, 80, 80)';
        document.getElementById('mic-btn').style.backgroundColor = color;
    }
};

window.addEventListener('beforeunload', leaveChannel);
document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('mic-btn').addEventListener('click', toggleMic);

init();
