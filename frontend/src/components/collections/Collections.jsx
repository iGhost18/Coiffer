import "./collections.css";
import { useNavigate } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";

export default function Collections({
    collection = [],
    featured = [],
    toggleFeatured,
    fileInputRef,
    handleUpload, 
    showBackButton = true,
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

        <button
          className="UploadBtn"
          onClick={handleUploadClick}
        >
          + Upload
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleUpload}
        />
      </div>

      {collection.length === 0 ? (
        <div
          className="EmptyCollection"
          onClick={handleUploadClick}
        >
          <div className="EmptyIcon">📷</div>
          <p>Click to upload your hairstyle photos</p>
          <span>Only you can see this collection</span>
        </div>
      ) : (
        <div className="CollectionGrid">
          {collection.map((url, i) => (
            <div
              key={i}
              className={`CollectionItem ${
                featured.includes(url) ? "featured" : ""
              }`}
              onClick={() => toggleFeatured(url)}
            >
              <img
                src={url}
                alt=""
                className="CollectionImg"
              />

              <div className="CollectionOverlay">
                <span>
                  {featured.includes(url)
                    ? "★ Featured"
                    : "☆ Feature"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}