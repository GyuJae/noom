const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");
const chats = document.getElementById("chats");
const myStreamDocument = document.getElementById("myStream");
const statusDocument = document.getElementById("status");

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;
let myDataChannel;

const getCamera = async () => {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      camerasSelect.appendChild(option);
    });
  } catch (error) {
    alert(error);
  }
};

const getMedia = async (deviceId) => {
  const initialConstrains = {
    audio: true,
    video: { facingMode: "user" },
  };
  const cameraConstraints = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      deviceId ? cameraConstraints : initialConstrains
    );
    myFace.srcObject = myStream;
    await getCamera();
  } catch (error) {
    alert(error);
  }
};

const handleMuteClick = () => {
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    muteBtn.innerText = "Unmuted";
    muted = true;
  } else {
    muteBtn.innerText = "Mute";
    muted = false;
  }
};

const handleCameraClick = () => {
  myStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    cameraBtn.innerText = "Turn Camera off";
    cameraOff = false;
  } else {
    cameraBtn.innerText = "Turn Camera On";
    cameraOff = true;
  }
};

const handleCameraChange = async () => {
  await getMedia(camerasSelect.value);
  if (myPeerConnection) {
    const videoTrack = myStream.getVideoTracks()[0];
    const videoSender = myPeerConnection
      .getSenders()
      .find((sender) => sender.track.kind === "video");
    videoSender.replaceTrack(videoTrack);
  }
};

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

const initCall = async () => {
  welcome.hidden = true;
  call.hidden = false;
  myStreamDocument.style.display = "flex";
  chats.style.display = "flex";
  await getMedia();
  makeConnection();
};

welcomeForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  await initCall();
  socket.emit("join_room", input.value);
  roomName = input.value;
  input.value = "";
});

const appendChat = (data, who) => {
  const ul = chats.querySelector("ul");
  const li = document.createElement("li");
  const div = document.createElement("div");
  li.className = who ? "me" : "notMe";
  div.className = who ? "me" : "notMe";
  div.innerText = data;
  li.appendChild(div);
  ul.appendChild(li);
};

socket.on("welcome", async () => {
  statusDocument.innerText = "someone coming";
  myDataChannel = myPeerConnection.createDataChannel("chat");
  myDataChannel.addEventListener("message", (event) => {
    appendChat(event.data, false);
  });
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  socket.emit("offer", offer, roomName);
});

socket.on("offer", async (offer) => {
  myPeerConnection.addEventListener("datachannel", (event) => {
    myDataChannel = event.channel;
    myDataChannel.addEventListener("message", (event) => {
      appendChat(event.data, false);
    });
  });
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  socket.emit("answer", answer, roomName);
});

socket.on("answer", (answer) => {
  myPeerConnection.setRemoteDescription(answer);
});

socket.on("ice", (ice) => {
  myPeerConnection.addIceCandidate(ice);
});

socket.on("bye", () => {
  statusDocument.innerText = "someone out";
  const peerFace = document.getElementById("peerFace");
  call.removeChild(peerFace);
});

// RTC Code

const makeConnection = () => {
  myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: [
          "stun:stun.l.google.com:19302",
          "stun:stun1.l.google.com:19302",
          "stun:stun2.l.google.com:19302",
          "stun:stun3.l.google.com:19302",
          "stun:stun4.l.google.com:19302",
        ],
      },
    ],
  });
  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("addstream", handleAddStream);
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
};

const handleIce = (data) => {
  socket.emit("ice", data.candidate, roomName);
};

const handleAddStream = (data) => {
  const peerFace = document.createElement("video");

  peerFace.autoplay = true;
  peerFace.playsInline = true;
  peerFace.width = 300;
  peerFace.height = 300;
  peerFace.srcObject = data.stream;
  //peerFace.id = data.stream.id;
  peerFace.id = "peerFace";
  call.appendChild(peerFace);
};

const chatForm = chats.querySelector("form");

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const chatInput = document.querySelector("textarea");
  myDataChannel.send(chatInput.value);
  appendChat(chatInput.value, true);
  chatInput.value = "";
});
