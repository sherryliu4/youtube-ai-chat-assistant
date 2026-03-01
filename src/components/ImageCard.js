import React, { useState } from 'react';

export default function ImageCard({ imageUrl, prompt }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!imageUrl) return null;

  const handleDownload = (e) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `generated-image-${Date.now()}.png`; // Browser handles extension mapping for data URLs usually
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="image-card" onClick={() => setIsOpen(true)}>
        <div className="image-card-frame">
          <img src={imageUrl} alt={prompt} />
        </div>
        <div className="image-card-footer">
          <p className="image-card-prompt">{prompt}</p>
          <button className="image-card-btn" onClick={handleDownload}>
            ⬇ Download Image
          </button>
        </div>
      </div>

      {isOpen && (
        <div className="image-lightbox" onClick={() => setIsOpen(false)}>
          <div className="image-lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={imageUrl} alt={prompt} />
            <button className="image-lightbox-close" onClick={() => setIsOpen(false)}>×</button>
            <button className="image-lightbox-download" onClick={handleDownload}>
              ⬇ Download
            </button>
          </div>
        </div>
      )}
    </>
  );
}
