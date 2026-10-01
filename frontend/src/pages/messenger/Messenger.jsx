import "./messenger.css";
import { useContext, useEffect, useState, useRef } from "react";
import api from "../../api";
import socket from "../../socket";
import { useLocation, useNavigate } from "react-router-dom";
import { MdImage, MdClose } from "react-icons/md";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";

import { AuthContext } from "../../components/context/AuthContext";
import { StaffAuthContext } from "../../components/context/StaffAuthContext";

import Conversation from "../../components/conversations/Conversation";
import Messages from "../../components/messages/messages";

export default function Messenger() {
  const [conversation, setConversation] = useState([]);
  const [currentChat, setCurrentChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessages, setNewMessages] = useState("");
  const [arrivalMessages, setArrivalMessages] = useState(null);
  const [chatPartner, setChatPartner] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [pendingMedia, setPendingMedia] = useState(null); // { file, previewUrl, type }
  const [sendingMedia, setSendingMedia] = useState(false);
  const { user } = useContext(AuthContext);
  const { staff } = useContext(StaffAuthContext);
  const currentUser = user || staff;
  const isStaff = !!staff;
  const mediaInputRef = useRef();
  const scrollRef = useRef();
  const textareaRef = useRef();
  const location = useLocation();
  const navigate = useNavigate();
  const conversationId = location.state?.conversationId;

  useEffect(() => {
    if (!currentUser?._id) return;
    socket.emit("addUser", currentUser._id);
  }, [currentUser]);

  // The server now emits the persisted message (with its real _id) after
  // saving to the DB, instead of the client relaying an unpersisted payload.
  useEffect(() => {
    const handleMessage = (data) => {
      if (data.type === "booking") {
        setArrivalMessages(data);
      } else {
        setArrivalMessages(data); // already the full saved message doc, incl. _id
      }
    };

    const handleMessageUpdate = (update) => {
      setMessages((prev) =>
        prev.map((m) => (m._id === update.messageId ? { ...m, status: update.status } : m))
      );
    };

    socket.on("getMessage", handleMessage);
    socket.on("getMessageUpdate", handleMessageUpdate);

    return () => {
      socket.off("getMessage", handleMessage);
      socket.off("getMessageUpdate", handleMessageUpdate);
    };
  }, []);

  useEffect(() => {
    if (!arrivalMessages) return;

    const belongsToCurrentChat = arrivalMessages.conversationId
      ? arrivalMessages.conversationId === currentChat?._id
      : currentChat?.members.includes(arrivalMessages.sender);

    if (belongsToCurrentChat) {
      setMessages((prev) => [...prev, arrivalMessages]);

      // The chat is already open, so this new message has effectively
      // been "seen" the moment it arrives — mark it read on the backend
      // immediately, rather than only when the conversation is first
      // opened. Without this, a message that arrives while you're already
      // chatting never gets its `read` flag flipped, and the unread
      // badge silently reappears next time counts are refetched.
      if (currentChat?._id) {
        api.put(`/api/message/conversation/${currentChat._id}/read`).catch(console.error);
      }
    } else if (arrivalMessages.conversationId) {
      setConversation((prev) =>
        prev.map((c) =>
          c._id === arrivalMessages.conversationId
            ? { ...c, unreadCount: (c.unreadCount || 0) + 1 }
            : c
        )
      );
    }
  }, [arrivalMessages, currentChat]);

  useEffect(() => {
    if (!currentUser?._id) return;

    const handleUsers = (users) => {
      setOnlineUsers(users.map((u) => String(u.userId)));
    };

    socket.on("getUsers", handleUsers);


    const requestOnlineUsers = () => {
      socket.emit("requestOnlineUsers");
    };

    socket.on("connect", requestOnlineUsers);

    if (socket.connected) {
      requestOnlineUsers();
    }

    return () => {
      socket.off("getUsers", handleUsers);
      socket.off("connect", requestOnlineUsers);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!conversationId || conversation.length === 0) return;

    const selectedConversation = conversation.find((c) => c._id === conversationId);

    if (selectedConversation) {
      setCurrentChat(selectedConversation);
    }
  }, [conversation, conversationId]);

  // Fetch the other participant in the open chat
  useEffect(() => {
    if (!currentChat || !currentUser?._id) {
      setChatPartner(null);
      return;
    }

    const friendId = currentChat.members.find((m) => m !== currentUser._id);
    if (!friendId) return;

    let cancelled = false;

    const getPartner = async () => {
      try {
        const res = await api.get(`/api/conversation/member?id=${friendId}`);
        if (!cancelled) setChatPartner(res.data);
      } catch (err) {
        if (err.response?.status === 404) {
          if (!cancelled) setChatPartner({ username: "Deleted account", profilePicture: null });
        } else {
          if (!cancelled) console.error(err);
        }
      }
    };

    getPartner();
    return () => { cancelled = true; };
  }, [currentChat, currentUser?._id]);

  // Get Conversations
  useEffect(() => {
    if (!currentUser?._id) return;
    let cancelled = false;

    const getConversation = async () => {
      try {
        const res = await api.get(`/api/conversation/${currentUser._id}`);
        if (!cancelled) setConversation(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        if (!cancelled) console.error("Error fetching conversations:", err);
      }
    };

    getConversation();
    return () => { cancelled = true; };
  }, [currentUser]);

  // Get Messages + mark conversation as read
  useEffect(() => {
    if (!currentChat?._id) return;

    let cancelled = false;

    const getMessages = async () => {
      try {
        const res = await api.get(`/api/message/${currentChat._id}`);

        if (!cancelled) {
          setMessages(Array.isArray(res.data) ? res.data : []);
        }

        // Mark all messages in this conversation as read
        await api.put(
          `/api/message/conversation/${currentChat._id}/read`
        );

        // Tell Topbar to refresh its unread message count
        window.dispatchEvent(new Event("messagesRead"));

        // Also update the conversation's unread count locally
        setConversation((prev) =>
          prev.map((c) =>
            c._id === currentChat._id
              ? { ...c, unreadCount: 0 }
              : c
          )
        );

      } catch (err) {
        if (!cancelled) {
          console.error("Error fetching messages:", err);
        }
      }
    };

    getMessages();

    return () => {
      cancelled = true;
    };
  }, [currentChat]);



  // auto-grow the textarea as the user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 140)}px`;
    }
  }, [newMessages]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Send Message — persist first; the server emits to the receiver after saving.
  // Send Message — persist first; the server emits to the receiver after saving.
  const handleSubmit = async (e) => {
    e.preventDefault();

    if ((!newMessages.trim() && !pendingMedia) || !currentChat || !currentUser) return;

    setSendingMedia(true);

    try {
      let media = null;

      if (pendingMedia) {
        const formData = new FormData();
        formData.append("file", pendingMedia.file);
        const uploadRes = await api.post("/api/upload", formData);
        media = { url: uploadRes.data.url, type: pendingMedia.type };
      }

      const message = {
        sender: currentUser._id,
        text: newMessages,
        conversationId: currentChat._id,
        media,
      };

      const res = await api.post("/api/message", message);
      setMessages((prev) => [...prev, res.data]);
      setNewMessages("");
      cancelPendingMedia();
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Couldn't send your message. Try again.");
    } finally {
      setSendingMedia(false);
    }
  };

  const handlePickMedia = () => mediaInputRef.current?.click();

  const handleMediaSelected = (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;

    const isVideo = f.type.startsWith("video/");
    setPendingMedia({
      file: f,
      previewUrl: URL.createObjectURL(f),
      type: isVideo ? "video" : "image",
    });
  };

  const cancelPendingMedia = () => {
    if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
    setPendingMedia(null);
  };

  useEffect(() => {
    return () => {
      if (pendingMedia?.previewUrl) URL.revokeObjectURL(pendingMedia.previewUrl);
    };
  }, [pendingMedia]);

  const handleBookingUpdate = (messageId, newStatus) => {
    setMessages((prev) =>
      prev.map((m) => (m._id === messageId ? { ...m, status: newStatus } : m))
    );
  };

  useEffect(() => {
    scrollRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);



  return (
    <div className="messenger">
      <div className={`chatMenu ${currentChat ? "hidden" : ""}`}>
        <div className="chatMenuWrapper">
          <div className="btnback">
            <button className="messengerBackBtn" onClick={() => navigate(-1)}>
              <ChevronLeftIcon />
            </button>
            <h4>Messages</h4>
          </div>

          <hr />

          <div className="chatMenuTop">
            {conversation.map((c) => (
              <div key={c._id} onClick={() => setCurrentChat(c)}>
                <Conversation
                  conversation={c}
                  currentUser={currentUser}
                  onlineUsers={onlineUsers}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`chatBox ${!currentChat ? "hidden" : ""}`}>
        <div className="chatBoxWrapper">
          {currentChat ? (
            <>
              <div className="chatBoxTopBar">
                <button
                  className="messengerBackBtn chatBackBtn"
                  onClick={() => setCurrentChat(null)}
                  aria-label="Back to conversations"
                >
                  <ChevronLeftIcon />
                </button>
                <span className="chatBoxPartnerName">
                  {chatPartner?.username}
                </span>
              </div>
              
              <div className="chatBoxTop">
                {messages.map((m) => (
                  <div key={m._id} ref={scrollRef}>
                    <Messages
                      messages={m}
                      own={!!currentUser?._id && m.sender === currentUser._id}
                      isStaff={isStaff}
                      onBookingUpdate={handleBookingUpdate}
                      senderPicture={
                        currentUser?._id && m.sender === currentUser._id
                          ? currentUser?.profilePicture
                          : chatPartner?.profilePicture
                      }
                    />
                  </div>
                ))}
              </div>

              <div className="chatBoxBottom">
                {pendingMedia && (
                  <div className="chatMediaPreview">
                    {pendingMedia.type === "video" ? (
                      <video src={pendingMedia.previewUrl} className="chatMediaPreviewThumb" muted />
                    ) : (
                      <img src={pendingMedia.previewUrl} alt="" className="chatMediaPreviewThumb" />
                    )}
                    <button
                      type="button"
                      className="chatMediaPreviewRemove"
                      onClick={cancelPendingMedia}
                      aria-label="Remove attachment"
                    >
                      <MdClose />
                    </button>
                  </div>
                )}

                <div className="messageInputWrapper">
                  <input
                    ref={mediaInputRef}
                    type="file"
                    style={{ display: "none" }}
                    accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
                    onChange={handleMediaSelected}
                  />

                  <button
                    type="button"
                    className="chatAttachButton"
                    onClick={handlePickMedia}
                    disabled={sendingMedia}
                    aria-label="Attach photo or video"
                  >
                    <MdImage />
                  </button>

                  <textarea
                    ref={textareaRef}
                    className="chatMessageInput"
                    placeholder="Write something..."
                    value={newMessages}
                    onChange={(e) => setNewMessages(e.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={1}
                  />

                  <button
                    className="chatSubmitButton"
                    onClick={handleSubmit}
                    disabled={sendingMedia || (!newMessages.trim() && !pendingMedia)}
                    aria-label="Send message"
                  >
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                      <path
                        d="M4 12L20 4L13 20L11 13L4 12Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <span className="noConversationText">Open a conversation to start a chat.</span>
          )}
        </div>
      </div>
    </div>
  );
}