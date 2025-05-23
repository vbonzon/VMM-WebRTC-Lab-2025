'use strict';

// ==========================================================================
// Global variables
// ==========================================================================
let peerConnection; // WebRTC PeerConnection
let dataChannel; // WebRTC DataChannel
let room; // Room name: Caller and Callee have to join the same 'room'.
let socket; // Socket.io connection to the Web server for signaling.

// ==========================================================================
// 1. Make call
// ==========================================================================

// --------------------------------------------------------------------------
// Function call, when call button is clicked.
async function call(video) {
  // Enable local video stream from camera or screen sharing

  const localStream = await enable_camera(video);

  // Create Socket.io connection for signaling and add handlers
  // Then start signaling to join a room
  socket = create_signaling_connection();
  add_signaling_handlers(socket);
  call_room(socket);

  // Create peerConneciton and add handlers
  peerConnection = create_peerconnection(localStream);
  add_peerconnection_handlers(peerConnection);
}



// --------------------------------------------------------------------------
// Enable camera
// use getUserMedia or displayMedia (share screen). 
// Then show it on localVideo.
async function enable_camera(video) {

  // *** TODO ***: define constraints: set video to true, audio to true
  const constraints = {'video': video, 'audio': true};
        
  // *** TODO ***: uncomment the following log message
  console.log('Getting user media with constraints', constraints);

  // *** TODO ***: use getUserMedia to get a local media stream from the camera.
  //               If this fails, use getDisplayMedia to get a screen sharing stream.
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  document.getElementById('localVideo').srcObject = stream;
  return stream;
}

// ==========================================================================
// 2. Signaling connection: create Socket.io connection and connect handlers
// ==========================================================================

// --------------------------------------------------------------------------
// Create a Socket.io connection with the Web server for signaling
function create_signaling_connection() {
  // *** TODO ***: create a socket by simply calling the io() function
  //               provided by the socket.io library (included in index.html).
  //  const socket = ...
  const socket = io();
  
  return socket;
}

// --------------------------------------------------------------------------
// Connect the message handlers for Socket.io signaling messages
function add_signaling_handlers(socket) {
  // Event handlers for joining a room. Just print console messages
  // --------------------------------------------------------------
  // *** TODO ***: use the 'socket.on' method to create handlers for the 
  //               messages 'created', 'joined', 'full'.
  //               For all three messages, simply write a console log.

  
  socket.on('created', (data) => {
    console.log('created: ' + data);
  });

  socket.on('joined', (data) => {
    console.log('joined: ' + data);
  });

  socket.on('full', (data) => {
    console.log('full: ' + data);
  });
  // Event handlers for call establishment signaling messages
  // --------------------------------------------------------
  // *** TODO ***: use the 'socket.on' method to create signaling message handlers:
  // new_peer --> handle_new_peer
  // invite --> handle_invite
  // ok --> handle_ok
  // ice_candidate --> handle_remote_icecandidate
  // bye --> hangUp

  socket.on('new_peer', (data) => {
    handle_new_peer(data);
  });
  socket.on('invite', (data) => {
    handle_invite(data);
  });
  socket.on('ok', (data) => {
    handle_ok(data);
  });
  socket.on('ice_candidate', (data) => {
    handle_remote_icecandidate(data);
  });
  socket.on('bye', (data) => {
    closeStreams();
  });
}

// --------------------------------------------------------------------------
// Prompt user for room name then send a "join" event to server
function call_room(socket) {
  room = prompt('Enter room name:');
  if (room != '') {
      console.log('Joining room: ' + room);
      // *** TODO ***: send a join message to the server with room as argument.
      socket.emit('join', room);

  }
}

// ==========================================================================
// 3. PeerConnection creation
// ==========================================================================

// --------------------------------------------------------------------------
// Create a new RTCPeerConnection and connect local stream
function create_peerconnection(localStream) {
  const pcConfiguration = {'iceServers': [{'urls': 'stun:stun.l.google.com:19302'}]}

  // *** TODO ***: create a new RTCPeerConnection with this configuration
  // const pc = ...
  const pc = new RTCPeerConnection(pcConfiguration); 
  // *** TODO ***: add all tracks of the local stream to the peerConnection

  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });

  console.log("new peerconnection: ", pc);
  return pc;
}

// --------------------------------------------------------------------------
// Set the event handlers on the peerConnection. 
// This function is called by the call function all on top of the file.
function add_peerconnection_handlers(peerConnection) {

  // *** TODO ***: add event handlers on the peerConnection
  // onicecandidate -> handle_local_icecandidate
  // ontrack -> handle_remote_track
  // ondatachannel -> handle_remote_datachannel
  console.log(peerConnection);
  /*peerConnection.onicecandidate = (e) => {handle_local_icecandidate(e.candidate);};
  peerConnection.ontrack = (e) => {handle_remote_track(e)};
  */
  peerConnection.onicecandidate = handle_local_icecandidate;
  peerConnection.ontrack = handle_remote_track;
  peerConnection.ondatachannel = handle_remote_datachannel;
  

}

// ==========================================================================
// 4. Signaling for peerConnection negotiation
// ==========================================================================

// --------------------------------------------------------------------------
// Handle new peer: another peer has joined the room. I am the Caller.
// Create SDP offer and send it to peer via the server.
async function handle_new_peer(room){
  console.log('Peer has joined room: ' + room + '. I am the Caller.');
  create_datachannel(peerConnection); // MUST BE CALLED BEFORE createOffer

  // *** TODO ***: use createOffer (with await) generate an SDP offer for peerConnection
  const offer = await peerConnection.createOffer();
  // *** TODO ***: use setLocalDescription (with await) to add the offer to peerConnection
  await peerConnection.setLocalDescription(offer);
  // *** TODO ***: send an 'invite' message with the offer to the peer.
  socket.emit('invite', offer); 
}

// --------------------------------------------------------------------------
// Caller has sent Invite with SDP offer. I am the Callee.
// Set remote description and send back an Ok answer.
async function handle_invite(offer) {
  console.log('Received Invite offer from Caller: ', offer);
  // *** TODO ***: use setRemoteDescription (with await) to add the offer SDP to peerConnection 
  await peerConnection.setRemoteDescription(offer);
  // *** TODO ***: use createAnswer (with await) to generate an answer SDP
  const answer = await peerConnection.createAnswer();
  // *** TODO ***: use setLocalDescription (with await) to add the answer SDP to peerConnection
  await peerConnection.setLocalDescription(answer);
  // *** TODO ***: send an 'ok' message with the answer to the peer.
  socket.emit('ok', answer); 
}

// --------------------------------------------------------------------------
// Callee has sent Ok answer. I am the Caller.
// Set remote description.
async function handle_ok(answer) {
  console.log('Received OK answer from Callee: ', answer);
  // *** TODO ***: use setRemoteDescription (with await) to add the answer SDP 
  //               the peerConnection
  await peerConnection.setRemoteDescription(answer);
}

// ==========================================================================
// 5. ICE negotiation and remote stream handling
// ==========================================================================

// --------------------------------------------------------------------------
// A local ICE candidate has been created by the peerConnection.
// Send it to the peer via the server.
async function handle_local_icecandidate(event) {
  console.log('Received local ICE candidate: ', event);
  // *** TODO ***: check if there is a new ICE candidate.
  if(event != null && event.candidate){
    // *** TODO ***: if yes, send a 'ice_candidate' message with the candidate to the peer
    socket.emit("ice_candidate", event.candidate);
  }
  
}

// --------------------------------------------------------------------------
// The peer has sent a remote ICE candidate. Add it to the PeerConnection.
async function handle_remote_icecandidate(candidate) {
  console.log('Received remote ICE candidate: ', candidate);
  // *** TODO ***: add the received remote ICE candidate to the peerConnection 
  peerConnection.addIceCandidate(candidate);

}

// ==========================================================================
// 6. Function to handle remote video stream
// ==========================================================================

// --------------------------------------------------------------------------
// A remote track event has been received on the peerConnection.
// Show the remote track video on the web page.
function handle_remote_track(event) {
  console.log('Received remote track: ', event);
  // *** TODO ***: get the first stream of the event and show it in remoteVideo
  //document.getElementById('remoteVideo').srcObject = ...
  document.getElementById('remoteVideo').srcObject = event.streams[0];
  
}

// ==========================================================================
// 7. Functions to establish and use the DataChannel
// ==========================================================================

// --------------------------------------------------------------------------
// Create a data channel: only used by the Caller.
function create_datachannel(peerConnection) {
  console.log('Creating dataChannel. I am the Caller.');

  // *** TODO ***: create a dataChannel on the peerConnection
  //dataChannel = ...
  dataChannel = peerConnection.createDataChannel("chat");

  // *** TODO ***: connect the handlers onopen and onmessage to the handlers below
  //dataChannel. ...

  dataChannel.onopen = (e) => {
    handle_datachannel_open(e);
  }

  dataChannel.onmessage = (e) => {
    handle_datachannel_message(e);
  }

}

// --------------------------------------------------------------------------
// Handle remote data channel from Caller: only used by the Callee.
function handle_remote_datachannel(event) {
  console.log('Received remote dataChannel. I am Callee.');

  // *** TODO ***: get the data channel from the event
  dataChannel = event.channel;
  // *** TODO ***: add event handlers for onopen and onmessage events to the dataChannel
  dataChannel.onopen = (e) => {
    handle_datachannel_open(e);
  }

  dataChannel.onmessage = (e) => {
    handle_datachannel_message(e);
  }

}

// --------------------------------------------------------------------------
// Handle Open event on dataChannel: show a message.
// Received by the Caller and the Callee.
function handle_datachannel_open(event) {
  dataChannel.send('*** Channel is ready ***');
}

// --------------------------------------------------------------------------
// Send message to peer when Send button is clicked
function sendMessage() {
  const message = document.getElementById('dataChannelInput').value;
  document.getElementById('dataChannelInput').value = '';
  document.getElementById('dataChannelOutput').value += '        ME: ' + message + '\n';

  // *** TODO ***: send the message through the dataChannel
  dataChannel.send(message);

}

// Handle Message from peer event on dataChannel: display the message
function handle_datachannel_message(event) {
  console.log("new message: ",event);
  document.getElementById('dataChannelOutput').value += 'PEER: ' + event.data + '\n';
}

// ==========================================================================
// 8. Functions to end call
// ==========================================================================

// --------------------------------------------------------------------------
// HangUp: Send a bye message to peer and close all connections and streams.
function hangUp() {

  closeStreams();
  // *** TODO ***: Write a console log
  console.log("call terminated");
  // *** TODO ***: send a bye message with the room name to the server
  socket.emit("bye", room);

  
}

function closeStreams(){
  console.log("closing streams");
  // Switch off the local stream by stopping all tracks of the local stream
  const localVideo = document.getElementById('localVideo');
  const remoteVideo = document.getElementById('remoteVideo');
  // *** TODO ***: remove the tracks from localVideo and remoteVideo
  if(localVideo.srcObject != null)
    localVideo.srcObject.getTracks().forEach(track => track.stop());
  if(remoteVideo.srcObject != null)
    remoteVideo.srcObject.getTracks().forEach(track => track.stop());
  
  // *** TODO ***: set localVideo and remoteVideo source objects to null
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  // *** TODO ***: close the peerConnection and set it to null
  if(peerConnection != null)
    peerConnection.close();
  peerConnection = null;
  // *** TODO ***: close the dataChannel and set it to null
  if(dataChannel != null)
    dataChannel.close();
  dataChannel = null;
  document.getElementById('dataChannelOutput').value += '*** Channel is closed ***\n';
}

// --------------------------------------------------------------------------
// Clean-up: hang up before unloading the window
window.onbeforeunload = e => hangUp();



