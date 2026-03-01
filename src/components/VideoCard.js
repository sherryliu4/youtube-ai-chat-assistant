import React from 'react';

export default function VideoCard({ video }) {
  if (!video) return null;

  return (
    <div className="video-card">
      <div className="video-card-content">
        <h3 className="video-card-title">{video.title}</h3>
        <div className="video-card-meta">
          <span>📅 {new Date(video.release_date).toLocaleDateString()}</span>
          <span>👁️ {parseInt(video.view_count).toLocaleString()} views</span>
        </div>
        <div className="video-card-actions">
          <a 
            href={video.video_url} 
            target="_blank" 
            rel="noopener noreferrer" 
            className="video-card-btn primary"
          >
            ▶ Open Video
          </a>
        </div>
      </div>
    </div>
  );
}
