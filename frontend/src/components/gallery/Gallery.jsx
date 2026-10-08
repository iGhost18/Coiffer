import "./gallery.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import CloseIcon from "@mui/icons-material/Close";

export default function Gallery({
  photos = [],
  featured = [],
  toggleFeatured,
  fileInputRef,
  handleUpload,
  handleDelete,
  showBackButton = true,
  isOwner = false,
}) {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(null);

  const handleUploadClick = () => {
    if (!fileInputRef?.current) {
      console.warn("Gallery: fileInputRef is missing.");
      return;
    }
    fileInputRef.current.click();
  };

  const closeViewer = () => setActiveIndex(null);
  const showPrev = () => setActiveIndex((i) => (i - 1 + photos.length) % photos.length);
  const showNext = () => setActiveIndex((i) => (i + 1) % photos.length);

  // Keyboard controls + lock page scroll while viewer is open
  useEffect(() => {
    if (activeIndex === null) return;

    const onKey = (e) => {
      if (e.key === "Escape") closeViewer();
      if (e.key === "ArrowLeft") showPrev();
      if (e.key === "ArrowRight") showNext();
    };

    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [activeIndex, photos.length]);

  // If a photo is deleted while viewing, keep the index valid
  useEffect(() => {
    if (activeIndex !== null && activeIndex >= photos.length) {
      setActiveIndex(photos.length ? photos.length - 1 : null);
    }
  }, [photos.length, activeIndex]);

  return (
    <div className="UserProfileCenter">
      <div className="GalleryHeader">
        <div className="btnAndText">
          {showBackButton && (
            <button className="galleryBackBtn" onClick={() => navigate(-1)}>
              <ChevronLeftIcon />
            </button>
          )}
          <h4 className="GalleryTitle">My Gallery</h4>
        </div>

        {isOwner && (
          <button className="UploadBtn" onClick={handleUploadClick}>
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

      {photos.length === 0 ? (
        <div
          className="EmptyGallery"
          onClick={isOwner ? handleUploadClick : undefined}
        >
          <div className="EmptyIcon">📷</div>
          <p>{isOwner ? "Click to upload your hairstyle photos" : "No photos yet"}</p>
          {isOwner && <span>Visible on your public profile</span>}
        </div>
      ) : (
        <div className="GalleryGrid">
          {photos.map((url, i) => {
            const isFeatured = featured.includes(url);

            return (
              <div
                key={url}
                className={`GalleryItem ${isFeatured ? "featured" : ""}`}
              >
                <img
                  src={url}
                  alt={`Photo ${i + 1}`}
                  className="GalleryImg"
                  onClick={() => setActiveIndex(i)}
                />

                {isOwner ? (
                  <div className="GalleryOverlay">
                    <span onClick={() => toggleFeatured?.(url)}>
                      {isFeatured ? "★ Featured" : "☆ Feature"}
                    </span>
                  </div>
                ) : (
                  isFeatured && (
                    <div className="GalleryOverlay GalleryOverlayStatic">
                      <span>★ Featured</span>
                    </div>
                  )
                )}

                {isOwner && handleDelete && (
                  <button
                    type="button"
                    className="GalleryDeleteBtn"
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
            );
          })}
        </div>
      )}

      {/* Enlarged view */}
      {activeIndex !== null && photos[activeIndex] && (
        <div className="Lightbox" onClick={closeViewer}>
          <button
            className="LightboxClose"
            onClick={closeViewer}
            aria-label="Close"
          >
            <CloseIcon />
          </button>

          {photos.length > 1 && (
            <button
              className="LightboxNav LightboxPrev"
              onClick={(e) => { e.stopPropagation(); showPrev(); }}
              aria-label="Previous photo"
            >
              <ChevronLeftIcon fontSize="large" />
            </button>
          )}

          <img
            src={photos[activeIndex]}
            alt={`Photo ${activeIndex + 1}`}
            className="LightboxImg"
            onClick={(e) => e.stopPropagation()}
          />

          {photos.length > 1 && (
            <button
              className="LightboxNav LightboxNext"
              onClick={(e) => { e.stopPropagation(); showNext(); }}
              aria-label="Next photo"
            >
              <ChevronLeftIcon
                fontSize="large"
                style={{ transform: "rotate(180deg)" }}
              />
            </button>
          )}

          <span className="LightboxCount">
            {activeIndex + 1} / {photos.length}
          </span>
        </div>
      )}
    </div>
  );
}