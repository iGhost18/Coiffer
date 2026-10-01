import "./postgrid.css";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutlined";

export default function PostGrid({ posts, onSelect }) {
    const PF = process.env.REACT_APP_PUBLIC_FOLDER;

    // post.img items can be a plain URL string (older posts) or a
    // {url, type} object (posts created after video support was added) —
    // normalize both to the same shape before rendering.
    const normalizeMediaItem = (item) => {
        if (!item) return null;
        if (typeof item === "string") return { url: item, type: "image" };
        return item;
    };

    const getImage = (url) => {
        if (!url) return "/assets/person/noAvatar.png";
        return url.startsWith("http") ? url : PF + url;
    };

    return (
        <div className="PostGrid">
            {posts.map((post, index) => {
                const firstItem = normalizeMediaItem(post.img?.[0]);

                return (
                    <div
                        key={post._id}
                        className="PostGridItem"
                        onClick={() => onSelect(index)}
                    >
                        {firstItem ? (
                            <>
                                {firstItem.type === "video" ? (
                                    <video
                                        src={getImage(firstItem.url)}
                                        className="PostGridImg"
                                        muted
                                        playsInline
                                        preload="metadata"
                                    />
                                ) : (
                                    <img
                                        src={getImage(firstItem.url)}
                                        alt=""
                                        className="PostGridImg"
                                    />
                                )}
                                {firstItem.type === "video" && (
                                    <PlayCircleOutlineIcon className="PostGridPlayIcon" />
                                )}
                            </>
                        ) : (
                            <div className="PostGridNoImage">
                                {post.desc?.slice(0, 60)}
                            </div>
                        )}

                        {post.img?.length > 1 && (
                            <span className="PostGridCount">
                                {post.img.length}
                            </span>
                        )}
                    </div>
                );
            })}
        </div>
    );
}