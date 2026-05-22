import React, { useEffect, useRef, useState, useContext } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useNavigate, useParams } from 'react-router-dom';
import { FiMicOff, FiVideo, FiPhone, FiShare2, FiClipboard, FiTrash2 } from 'react-icons/fi';
import { AuthContext, DarkModeContext } from '../App';

const API_URL = 'https://circlechat-backend.onrender.com';
const OPENAI_API_KEY = process.env.REACT_APP_OPENAI_API_KEY;

const openAIRequest = async (prompt) => {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured. Set REACT_APP_OPENAI_API_KEY in your .env file.');
  }

  const response = await axios.post(
    'https://api.openai.com/v1/chat/completions',
    {
      model: 'gpt-3.5-turbo',
      messages: prompt,
      temperature: 0.6,
      max_tokens: 300,
      n: 1,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
    }
  );

  return response.data?.choices?.[0]?.message?.content?.trim() ?? '';
};

const buildAssistantPrompt = (type, conversation) => {
  const base = [
    {
      role: 'system',
      content: 'You are a meeting assistant for CircleChat that creates concise notes, action items, and decisions from conversation history.',
    },
    {
      role: 'user',
      content: `Here is the meeting conversation history:\n\n${conversation}`,
    },
  ];

  if (type === 'notes') {
    base.push({
      role: 'user',
      content: 'Summarize this meeting in 3-4 concise bullet points with the main decisions and next steps.',
    });
  } else if (type === 'actions') {
    base.push({
      role: 'user',
      content: 'Extract the top action items from this meeting and list them as bullet points with owners if possible.',
    });
  } else if (type === 'decisions') {
    base.push({
      role: 'user',
      content: 'List the main decisions made in this meeting as short bullet points.',
    });
  }

  return base;
};

const MeetingRoom = () => {
  const { circleId } = useParams();
  const navigate = useNavigate();
  const { token, user } = useContext(AuthContext);
  const { darkMode } = useContext(DarkModeContext);
  const localVideoRef = useRef(null);
  const screenVideoRef = useRef(null);
  const canvasRef = useRef(null);
  const currentStrokeRef = useRef([]);
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [socket, setSocket] = useState(null);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [isSharing, setIsSharing] = useState(false);
  const [whiteboardMode, setWhiteboardMode] = useState('assistant');
  const [canvasColor, setCanvasColor] = useState('#2563eb');
  const [lineWidth, setLineWidth] = useState(4);
  const [meetingMessages, setMeetingMessages] = useState([]);
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [meetingNotes, setMeetingNotes] = useState('');
  const [actionItems, setActionItems] = useState('');
  const [decisions, setDecisions] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    const startLocalMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(stream);
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Unable to access camera/microphone', error);
      }
    };

    const fetchMessages = async () => {
      try {
        const res = await axios.get(`${API_URL}/api/messages/${circleId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setMeetingMessages(res.data || []);
      } catch (error) {
        console.error('Failed to load meeting messages', error);
      }
    };

    startLocalMedia();
    fetchMessages();

    return () => {
      localStream?.getTracks().forEach((track) => track.stop());
      screenStream?.getTracks().forEach((track) => track.stop());
    };
  }, [circleId, token]);

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  const toggleCamera = () => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setCameraEnabled(videoTrack.enabled);
  };

  const toggleMic = () => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setMicEnabled(audioTrack.enabled);
  };

  const startScreenShare = async () => {
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(screen);
      setIsSharing(true);
      screen.getVideoTracks()[0].addEventListener('ended', () => {
        setIsSharing(false);
        setScreenStream(null);
      });
    } catch (error) {
      console.error('Screen share failed', error);
    }
  };

  const stopScreenShare = () => {
    screenStream?.getTracks().forEach((track) => track.stop());
    setScreenStream(null);
    setIsSharing(false);
  };

  useEffect(() => {
    if (!token) return;

    const newSocket = io(API_URL, { auth: { token }, transports: ['websocket'] });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      newSocket.emit('join-circle', circleId);
    });

    newSocket.on('whiteboard-draw', ({ stroke }) => {
      drawRemoteStroke(stroke);
    });

    newSocket.on('whiteboard-clear', () => {
      clearCanvas(false);
    });

    return () => {
      newSocket.disconnect();
    };
  }, [circleId, token]);

  const getCanvasContext = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    return ctx;
  };

  const drawRemoteStroke = (stroke) => {
    const ctx = getCanvasContext();
    if (!ctx || !stroke?.points?.length) return;

    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.beginPath();
    stroke.points.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
  };

  const clearCanvas = (emit = true) => {
    const canvas = canvasRef.current;
    const ctx = getCanvasContext();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (emit && socket) {
      socket.emit('whiteboard-clear', { circleId });
    }
  };

  const getPointerPosition = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = event.touches ? event.touches[0].clientX : event.clientX;
    const clientY = event.touches ? event.touches[0].clientY : event.clientY;
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const startWhiteboardStroke = (event) => {
    if (whiteboardMode !== 'whiteboard') return;
    event.preventDefault();
    const point = getPointerPosition(event);
    const ctx = getCanvasContext();
    if (!ctx) return;
    ctx.strokeStyle = canvasColor;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    currentStrokeRef.current = [point];
    window.addEventListener('mouseup', endWhiteboardStroke);
    window.addEventListener('touchend', endWhiteboardStroke);
  };

  const drawWhiteboardStroke = (event) => {
    if (whiteboardMode !== 'whiteboard' || !currentStrokeRef.current.length) return;
    event.preventDefault();
    const point = getPointerPosition(event);
    const ctx = getCanvasContext();
    if (!ctx) return;
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    currentStrokeRef.current.push(point);
  };

  const endWhiteboardStroke = () => {
    if (!currentStrokeRef.current.length) return;
    if (socket) {
      socket.emit('whiteboard-draw', {
        circleId,
        stroke: {
          points: currentStrokeRef.current,
          color: canvasColor,
          width: lineWidth,
        },
      });
    }
    currentStrokeRef.current = [];
    window.removeEventListener('mouseup', endWhiteboardStroke);
    window.removeEventListener('touchend', endWhiteboardStroke);
  };

  const leaveMeeting = () => {
    navigate(-1);
  };

  const handleAssistant = async (type) => {
    if (!meetingMessages.length) {
      setErrorMessage('No meeting chat history available for the assistant.');
      return;
    }

    setAssistantLoading(true);
    setErrorMessage(null);

    try {
      const conversation = meetingMessages
        .slice(-40)
        .map((msg) => `${msg.username || 'Member'}: ${msg.content}`)
        .join('\n');

      const prompt = buildAssistantPrompt(type, conversation);
      const result = await openAIRequest(prompt);

      if (type === 'notes') setMeetingNotes(result);
      if (type === 'actions') setActionItems(result);
      if (type === 'decisions') setDecisions(result);
    } catch (error) {
      setErrorMessage(error.message || 'Meeting assistant failed.');
    } finally {
      setAssistantLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setErrorMessage('Copied to clipboard!');
    } catch (error) {
      setErrorMessage('Clipboard copy failed.');
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: darkMode ? '#101426' : '#f4f6fb', color: darkMode ? 'white' : 'black', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0 }}>Circle Meet</h2>
          <p style={{ margin: '6px 0 0', color: darkMode ? '#aab3c7' : '#4b5563' }}>
            Meeting room for circle {circleId} · {user?.username || 'Guest'}
          </p>
        </div>
        <button onClick={leaveMeeting} style={{ border: 'none', background: '#ef4444', color: 'white', borderRadius: '14px', padding: '10px 16px', cursor: 'pointer' }}>
          <FiPhone style={{ verticalAlign: 'middle', marginRight: '8px' }} /> Leave
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '16px' }}>
        <div style={{ background: darkMode ? '#16213e' : 'white', borderRadius: '24px', padding: '16px', minHeight: '520px', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '20px', background: '#000' }}>
              <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <div style={{ position: 'absolute', bottom: '12px', left: '12px', padding: '8px 12px', background: 'rgba(0,0,0,0.6)', color: 'white', borderRadius: '14px' }}>
                Local preview
              </div>
            </div>

            <div style={{ position: 'relative', overflow: 'hidden', borderRadius: '20px', background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%' }}>
              {screenStream ? (
                <video ref={screenVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ textAlign: 'center', color: '#d1d5db' }}>
                  <p style={{ margin: 0, fontWeight: 600 }}>Screen Share</p>
                  <p style={{ margin: '8px 0 0' }}>Start sharing to preview your screen here.</p>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button onClick={toggleCamera} style={{ flex: 1, minWidth: '150px', border: 'none', borderRadius: '16px', padding: '14px 18px', background: cameraEnabled ? '#111827' : '#d1d5db', color: cameraEnabled ? 'white' : 'black', cursor: 'pointer' }}>
              <FiVideo style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {cameraEnabled ? 'Camera On' : 'Camera Off'}
            </button>
            <button onClick={toggleMic} style={{ flex: 1, minWidth: '150px', border: 'none', borderRadius: '16px', padding: '14px 18px', background: micEnabled ? '#111827' : '#d1d5db', color: micEnabled ? 'white' : 'black', cursor: 'pointer' }}>
              <FiMicOff style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {micEnabled ? 'Mic On' : 'Mic Off'}
            </button>
            <button onClick={isSharing ? stopScreenShare : startScreenShare} style={{ flex: 1, minWidth: '150px', border: 'none', borderRadius: '16px', padding: '14px 18px', background: '#2563eb', color: 'white', cursor: 'pointer' }}>
              <FiShare2 style={{ verticalAlign: 'middle', marginRight: '8px' }} /> {isSharing ? 'Stop Sharing' : 'Share Screen'}
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ background: darkMode ? '#16213e' : 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
            <h3 style={{ margin: 0, marginBottom: '12px' }}>Meeting Assistant</h3>
            <p style={{ margin: 0, color: darkMode ? '#d1d5db' : '#4b5563' }}>Use AI to capture notes, action items, and key decisions from the latest circle conversation.</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '18px' }}>
              <button onClick={() => handleAssistant('notes')} style={{ flex: 1, minWidth: '130px', border: 'none', borderRadius: '16px', padding: '12px 16px', background: '#4f46e5', color: 'white', cursor: 'pointer' }}>
                Generate Notes
              </button>
              <button onClick={() => handleAssistant('actions')} style={{ flex: 1, minWidth: '130px', border: 'none', borderRadius: '16px', padding: '12px 16px', background: '#0ea5e9', color: 'white', cursor: 'pointer' }}>
                Action Items
              </button>
              <button onClick={() => handleAssistant('decisions')} style={{ flex: 1, minWidth: '130px', border: 'none', borderRadius: '16px', padding: '12px 16px', background: '#16a34a', color: 'white', cursor: 'pointer' }}>
                Key Decisions
              </button>
            </div>
            {assistantLoading && <p style={{ marginTop: '12px', color: '#60a5fa' }}>AI assistant is analyzing the meeting…</p>}
            {errorMessage && <p style={{ marginTop: '12px', color: '#f87171' }}>{errorMessage}</p>}
          </div>

          <div style={{ background: darkMode ? '#16213e' : 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0 }}>Recent meeting history</h4>
              <button onClick={() => copyToClipboard(meetingMessages.map((msg) => `${msg.username || 'Member'}: ${msg.content}`).join('\n'))} style={{ border: 'none', background: '#e5e7eb', borderRadius: '12px', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiClipboard /> Copy
              </button>
            </div>
            <div style={{ maxHeight: '240px', overflow: 'auto', color: darkMode ? '#d1d5db' : '#374151' }}>
              {meetingMessages.slice(-8).map((msg) => (
                <div key={msg.id || `${msg.username}-${msg.content}-${Math.random()}`} style={{ marginBottom: '12px', padding: '12px', background: darkMode ? '#0f172a' : '#f8fafc', borderRadius: '16px' }}>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>{msg.username || 'Member'}</div>
                  <div style={{ marginTop: '4px' }}>{msg.content}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: darkMode ? '#16213e' : 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0 }}>Whiteboard</h4>
              <button onClick={clearCanvas} style={{ border: 'none', background: '#e5e7eb', borderRadius: '12px', padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiTrash2 /> Clear
              </button>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {['#2563eb', '#ef4444', '#f59e0b', '#10b981', '#6d28d9'].map((color) => (
                <button
                  key={color}
                  onClick={() => setCanvasColor(color)}
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: canvasColor === color ? '3px solid #111827' : '2px solid transparent',
                    background: color,
                    cursor: 'pointer',
                  }}
                />
              ))}
              <select value={lineWidth} onChange={(e) => setLineWidth(Number(e.target.value))} style={{ borderRadius: '14px', padding: '10px', border: '1px solid #d1d5db', background: darkMode ? '#0f172a' : 'white', color: darkMode ? 'white' : 'black' }}>
                {[2, 4, 6, 8, 10, 14].map((size) => (
                  <option key={size} value={size}>{size}px</option>
                ))}
              </select>
            </div>
            <canvas
              ref={canvasRef}
              width={720}
              height={360}
              onMouseDown={startWhiteboardStroke}
              onMouseMove={drawWhiteboardStroke}
              onTouchStart={startWhiteboardStroke}
              onTouchMove={drawWhiteboardStroke}
              style={{ width: '100%', height: '360px', borderRadius: '20px', background: darkMode ? '#0f172a' : '#f8fafc', touchAction: 'none', cursor: 'crosshair' }}
            />
          </div>

          <div style={{ display: 'grid', gap: '16px' }}>
            {meetingNotes && (
              <div style={{ background: darkMode ? '#16213e' : 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ margin: 0 }}>Meeting Notes</h4>
                  <button onClick={() => copyToClipboard(meetingNotes)} style={{ border: 'none', background: '#e5e7eb', borderRadius: '12px', padding: '8px 12px', cursor: 'pointer' }}>
                    Copy
                  </button>
                </div>
                <p style={{ whiteSpace: 'pre-wrap', marginTop: '12px', color: darkMode ? '#d1d5db' : '#374151' }}>{meetingNotes}</p>
              </div>
            )}
            {actionItems && (
              <div style={{ background: darkMode ? '#16213e' : 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ margin: 0 }}>Action Items</h4>
                  <button onClick={() => copyToClipboard(actionItems)} style={{ border: 'none', background: '#e5e7eb', borderRadius: '12px', padding: '8px 12px', cursor: 'pointer' }}>
                    Copy
                  </button>
                </div>
                <p style={{ whiteSpace: 'pre-wrap', marginTop: '12px', color: darkMode ? '#d1d5db' : '#374151' }}>{actionItems}</p>
              </div>
            )}
            {decisions && (
              <div style={{ background: darkMode ? '#16213e' : 'white', borderRadius: '24px', padding: '20px', boxShadow: '0 20px 60px rgba(15,23,42,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ margin: 0 }}>Key Decisions</h4>
                  <button onClick={() => copyToClipboard(decisions)} style={{ border: 'none', background: '#e5e7eb', borderRadius: '12px', padding: '8px 12px', cursor: 'pointer' }}>
                    Copy
                  </button>
                </div>
                <p style={{ whiteSpace: 'pre-wrap', marginTop: '12px', color: darkMode ? '#d1d5db' : '#374151' }}>{decisions}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingRoom;
