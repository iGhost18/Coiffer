import "./postgrid.css";

export default function PostGrid({ posts, onSelect }) {
    const PF = process.env.REACT_APP_PUBLIC_FOLDER;

    const getImage = (img) => {
        if (!img) return "/assets/person/noAvatar.png"; // or a generic placeholder
        return img.startsWith("http") ? img : PF + img;
    };
    return (
        <div className="PostGrid">
            {posts.map((post,index) => (
                <div
                    key={post._id}
                    className="PostGridItem"
                    onClick={() => onSelect(index)}
                >
                    {post.img?.length > 0 ? (
                        <img
                            src={getImage(post.img[0])}
                            alt=""
                            className="PostGridImg"
                        />
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
            ))}
        </div>
    );
}