import './share.css';
import { MdPermMedia, MdLabel, MdRoom, MdEmojiEmotions, MdClose, MdMyLocation } from "react-icons/md";
import { useContext, useRef, useState, useEffect } from 'react';
import { StaffAuthContext } from '.././context/StaffAuthContext';
import api from '../../api';

const FEELINGS = [
    { label: "Happy", emoji: "😊" },
    { label: "Excited", emoji: "🤩" },
    { label: "Proud", emoji: "😌" },
    { label: "Grateful", emoji: "🙏" },
    { label: "Motivated", emoji: "💪" },
    { label: "Tired", emoji: "😴" },
    { label: "Sad", emoji: "😢" },
];

export default function Share({ onPostCreated }) {
    const { staff } = useContext(StaffAuthContext);
    const PF = process.env.REACT_APP_PUBLIC_FOLDER;
    const desc = useRef();

    const [file, setFile] = useState(null);
    const [previews, setPreviews] = useState([]);
    const [submitting, setSubmitting] = useState(false);

    // Only one of these can be open at a time — this is what fixes the overlap.
    const [activePanel, setActivePanel] = useState(null); // 'tag' | 'location' | 'feelings' | null

    const [location, setLocation] = useState("");
    const [locating, setLocating] = useState(false);

    const [feeling, setFeeling] = useState(null);
    const [tagDraft, setTagDraft] = useState("");
    const [tags, setTags] = useState([]); // now stores {id, username, memberType} objects
    const [tagResults, setTagResults] = useState([]);
    const [searching, setSearching] = useState(false);

    const togglePanel = (panel) => {
        setActivePanel(prev => (prev === panel ? null : panel));
    };

    const MAX_VIDEO_MB = 100;
    const MAX_MEDIA_ITEMS = 10;

    const handleFileChange = (e) => {
        const selected = Array.from(e.target.files);

        const accepted = [];
        for (const f of selected) {
            const isVideo = f.type.startsWith("video/");
            if (isVideo && f.size > MAX_VIDEO_MB * 1024 * 1024) {
                alert(`${f.name} is over ${MAX_VIDEO_MB}MB — pick a smaller clip.`);
                continue;
            }
            accepted.push(f);
        }

        setFile(prev => {
            const next = prev ? [...prev, ...accepted] : accepted;
            if (next.length > MAX_MEDIA_ITEMS) {
                alert(`You can attach up to ${MAX_MEDIA_ITEMS} items per post.`);
                return next.slice(0, MAX_MEDIA_ITEMS);
            }
            return next;
        });

        setPreviews(prev => [
            ...prev,
            ...accepted.map(f => ({
                url: URL.createObjectURL(f),
                type: f.type.startsWith("video/") ? "video" : "image",
            })),
        ].slice(0, MAX_MEDIA_ITEMS));

        e.target.value = "";
    };

   const removeImageAt = (index) => {
        setFile(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => {
            URL.revokeObjectURL(prev[index].url);
            return prev.filter((_, i) => i !== index);
        });
    };

    const addTag = (account) => {
        if (!tags.some(t => t.id === account.id)) {
            setTags(prev => [...prev, account]);
        }
        setTagDraft("");
        setTagResults([]);
    };

    const removeTag = (id) => setTags(prev => prev.filter(t => t.id !== id));

    const useMyLocation = () => {
        if (!navigator.geolocation) return;
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;
                setLocation(`${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
                setLocating(false);
            },
            () => setLocating(false)
        );
    };

    const resetForm = () => {
        desc.current.value = "";
        previews.forEach((p) => URL.revokeObjectURL(p.url));
        setFile(null);
        setPreviews([]);
        setTags([]);
        setTagDraft("");
        setLocation("");
        setFeeling(null);
        setActivePanel(null);
    };

    const submitHandler = async (e) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            let media = [];
            if (file && file.length > 0) {
                for (const f of file) {
                    const isVideo = f.type.startsWith("video/");
                    const formData = new FormData();
                    formData.append("file", f);
                    formData.append("resourceType", isVideo ? "video" : "image");
                    const res = await api.post("/api/upload", formData);
                    const data = res.data;
                    if (data.url) media.push({ url: data.url, type: isVideo ? "video" : "image" });
                }
            }

            const newPost = {
                staffId: staff._id,
                desc: desc.current.value,
                img: media,
                tags,
                location,
                feeling: feeling ? feeling.label : null,
            };

            const savedPost = await api.post("/api/post", newPost);
            resetForm();
            onPostCreated(savedPost.data);
        } catch (err) {
            console.error("Post submission failed:", err);
            alert("Couldn't share your post. Check that the server is running and try again.");
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        return () => previews.forEach((p) => URL.revokeObjectURL(p.url));
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const query = tagDraft.trim();
        if (!query) {
            setTagResults([]);
            return;
        }

        setSearching(true);
        const timer = setTimeout(async () => {
            try {
                const res = await api.get(`/api/auth/search?q=${encodeURIComponent(query)}`);
                setTagResults(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                console.error(err);
                setTagResults([]);
            } finally {
                setSearching(false);
            }
        }, 300); // waits 300ms after typing stops before searching

        return () => clearTimeout(timer);
    }, [tagDraft]);

    return (
        <div className='Share'>
            <div className="ShareWrapper">
                <form onSubmit={submitHandler}>
                    <div className="ShareHeader">
                        <span className="ShareHeaderTitle">New Post</span>
                        <button className="ShareHeaderButton" type="submit" disabled={submitting}>
                            {submitting ? "Sharing…" : "Share"}
                        </button>
                    </div>

                    <div className="ShareTop">
                        <img src={staff.profilePicture || `${PF}person/noAvatar.png`} alt="" className="ShareProfileImg" />
                        <input
                            placeholder={"Show the world your Craft " + staff.username + "?"}
                            className="ShareInput"
                            ref={desc}
                        />
                    </div>

                    {(tags.length > 0 || location || feeling) && (
                        <div className="ShareChips">
                            {tags.map(t => (
                                <span className="ShareChip" key={t.id}>
                                    {t.username}
                                    <MdClose className="ShareChipClose" onClick={() => removeTag(t.id)} />
                                </span>
                            ))}
                            {location && (
                                <span className="ShareChip">
                                    <MdRoom className="ShareChipIcon" /> {location}
                                    <MdClose className="ShareChipClose" onClick={() => setLocation("")} />
                                </span>
                            )}
                            {feeling && (
                                <span className="ShareChip">
                                    {feeling.emoji} feeling {feeling.label}
                                    <MdClose className="ShareChipClose" onClick={() => setFeeling(null)} />
                                </span>
                            )}
                        </div>
                    )}

                    {previews.length > 0 && (
                        <div className="SharePreviewGrid">
                            {previews.map((p, index) => (
                                <div className="SharePreviewItem" key={index}>
                                    {p.type === "video" ? (
                                        <video src={p.url} className="SharePreviewImg" muted playsInline />
                                    ) : (
                                        <img src={p.url} alt="preview" className="SharePreviewImg" />
                                    )}
                                    <button
                                        type="button"
                                        className="SharePreviewRemove"
                                        onClick={() => removeImageAt(index)}
                                        aria-label="Remove media"
                                    >
                                        <MdClose />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <hr />

                    <div className="ShareOptions">
                        <label htmlFor='file' className="shareOption">
                            <MdPermMedia className='ShareIcon' />
                            <span className="ShareOptiontext">Photo & Video</span>
                            <input
                                style={{ display: "none" }}
                                type="file"
                                id='file'
                                multiple
                                accept='.png,.jpeg,.jpg,.mp4,.webm,.mov,image/png,image/jpeg,video/mp4,video/webm,video/quicktime'
                                onChange={handleFileChange}
                            />
                        </label>

                        <div
                            className={`shareOption ${activePanel === "tag" || tags.length ? "shareOptionActive" : ""}`}
                            onClick={() => togglePanel("tag")}
                        >
                            <MdLabel className='ShareIcon' />
                            <span className="ShareOptiontext">Tag</span>
                        </div>

                        <div
                            className={`shareOption ${activePanel === "location" || location ? "shareOptionActive" : ""}`}
                            onClick={() => togglePanel("location")}
                        >
                            <MdRoom className='ShareIcon' />
                            <span className="ShareOptiontext">Location</span>
                        </div>

                        <div
                            className={`shareOption ${activePanel === "feelings" || feeling ? "shareOptionActive" : ""}`}
                            onClick={() => togglePanel("feelings")}
                        >
                            <MdEmojiEmotions className='ShareIcon' />
                            <span className="ShareOptiontext">Feelings</span>
                        </div>
                    </div>

                    {/* Single inline panel, in normal document flow — this is what stops the overlap */}
                    {activePanel && (
                        <div className="SharePanel">
                            {activePanel === "tag" && (
                                <>
                                    <div className="SharePanelTitle">Tag people</div>
                                    <div className="SharePanelRow">
                                        <input
                                            type="text"
                                            className="SharePanelInput"
                                            placeholder="Search by username"
                                            value={tagDraft}
                                            autoFocus
                                            onChange={(e) => setTagDraft(e.target.value)}
                                        />
                                    </div>

                                    {searching && <div className="ShareTagSearching">Searching…</div>}

                                    {tagResults.length > 0 && (
                                        <div className="ShareTagResults">
                                            {tagResults.map(account => (
                                                <div
                                                    key={account.id}
                                                    className="ShareTagResultItem"
                                                    onClick={() => addTag(account)}
                                                >
                                                    <img
                                                        src={account.profilePicture || `${PF}person/noAvatar.png`}
                                                        alt=""
                                                        className="ShareTagResultImg"
                                                    />
                                                    <span>{account.username}</span>
                                                    <span className="ShareTagResultType">{account.memberType}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {tags.length > 0 && (
                                        <div className="SharePanelChips">
                                           {tags.map(t => (
                                                <span className="ShareChip" key={t.id}>
                                                    {t.username}
                                                    <MdClose className="ShareChipClose" onClick={() => removeTag(t.id)} />
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </>
                            )}
                            {activePanel === "location" && (
                                <>
                                    <div className="SharePanelTitle">Add location</div>
                                    <div className="SharePanelRow">
                                        <input
                                            type="text"
                                            className="SharePanelInput"
                                            placeholder="e.g. Lagos, Nigeria"
                                            value={location}
                                            autoFocus
                                            onChange={(e) => setLocation(e.target.value)}
                                        />
                                        <button type="button" className="SharePanelGeoBtn" onClick={useMyLocation} disabled={locating}>
                                            <MdMyLocation /> {locating ? "Locating…" : "Use my location"}
                                        </button>
                                    </div>
                                </>
                            )}

                            {activePanel === "feelings" && (
                                <>
                                    <div className="SharePanelTitle">How are you feeling?</div>
                                    <div className="ShareFeelingsGrid">
                                        {FEELINGS.map(f => (
                                            <div
                                                key={f.label}
                                                className={`ShareFeelingOption ${feeling?.label === f.label ? "ShareFeelingOptionActive" : ""}`}
                                                onClick={() => { setFeeling(f); setActivePanel(null); }}
                                            >
                                                <span className="ShareFeelingEmoji">{f.emoji}</span>
                                                <span>{f.label}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </form>
            </div>
        </div>
    )
}