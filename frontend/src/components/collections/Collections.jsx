import "./collections.css";
import { useNavigate } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";


export default function Collections({
    collection = [],
    featured = [],
    toggleFeatured,
    fileInputRef,
    handleUpload,
    handleDelete,
    showBackButton = true,
    isOwner = false,
  })
{
  const handleUploadClick = () => {
    if (!fileInputRef?.current) {
      console.warn("Collections: fileInputRef is missing.");
      return;
    }
    fileInputRef.current.click();
  };

  const navigate = useNavigate();

  return (
    <div className="UserProfileCenter">
      <div className="CollectionHeader">

        <div className="btnAndText">
          { showBackButton && (
            <button
              className="collectionBackBtn"
              onClick={() => navigate(-1)}
            >
              <ChevronLeftIcon />
            </button>
          )}

          <h4 className="CollectionTitle">My Collection</h4>
        </div>

        {isOwner && (
          <button
            className="UploadBtn"
            onClick={handleUploadClick}
          >
            + Upload
          </button>
        )}

        {isOwner && (
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={handleUpload}
          />
        )}
      </div>

      {collection.length === 0 ? (
        <div
          className="EmptyCollection"
          onClick={isOwner ? handleUploadClick : undefined}
        >
          <div className="EmptyIcon">📷</div>
          <p>{isOwner ? "Click to upload your hairstyle photos" : "No photos yet"}</p>
          {isOwner && <span>Visible on your public profile</span>}
        </div>
      ) : (
        <div className="CollectionGrid">
          {collection.map((url, i) => (
            <div
              key={i}
              className={`CollectionItem ${
                featured.includes(url) ? "featured" : ""
              }`}
            >
              <img
                src={url}
                alt=""
                className="CollectionImg"
                onClick={() => toggleFeatured(url)}
              />
              <div className="CollectionOverlay">
                <span onClick={() => toggleFeatured(url)}>
                  {featured.includes(url) ? "★ Featured" : "☆ Feature"}
                </span>
              </div>
              {isOwner && handleDelete && (
                <button
                  type="button"
                  className="CollectionDeleteBtn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(url);
                  }}
                  aria-label="Delete photo"
                >
                  <DeleteOutlineIcon fontSize="small" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}