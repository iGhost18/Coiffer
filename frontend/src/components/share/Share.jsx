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

    const handleFileChange = (e) => {
        const selected = Array.from(e.target.files);
        setFile(prev => (prev ? [...prev, ...selected] : selected));
        setPreviews(prev => [...prev, ...selected.map(f => URL.createObjectURL(f))]);
        e.target.value = ""; // lets you reopen the picker and add more without it being "empty"
    };

   const removeImageAt = (index) => {
        setFile(prev => prev.filter((_, i) => i !== index));
        setPreviews(prev => {
        URL.revokeObjectURL(prev[index]);
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
        previews.forEach((url) => URL.revokeObjectURL(url));
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
            let imgUrls = [];
            if (file && file.length > 0) {
                for (const f of file) {
                    const formData = new FormData();
                    formData.append("file", f);

                    const res = await fetch("/api/upload", {
                        method: "POST",
                        body: formData,
                    });

                    if (!res.ok) {
                        throw new Error(`Upload failed with status ${res.status}`);
                    }

                    const data = await res.json();
                    if (data.url) imgUrls.push(data.url);
                }
            }

            const newPost = {
                staffId: staff._id,
                desc: desc.current.value,
                img: imgUrls,
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
        return () => previews.forEach((url) => URL.revokeObjectURL(url));
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
                            {previews.map((src, index) => (
                                <div className="SharePreviewItem" key={index}>
                                    <img src={src} alt="preview" className="SharePreviewImg" />
                                    <button
                                        type="button"
                                        className="SharePreviewRemove"
                                        onClick={() => removeImageAt(index)}
                                        aria-label="Remove image"
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
                            <input style={{ display: "none" }} type="file" id='file' multiple accept='.png,.jpeg,.jpg' onChange={handleFileChange} />
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