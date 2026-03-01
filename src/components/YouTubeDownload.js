import { useState, useEffect } from 'react';
import './YouTubeDownload.css';

export default function YouTubeDownload() {
  const [url, setUrl] = useState('');
  const [maxVideos, setMaxVideos] = useState(10);
  const [jobId, setJobId] = useState(null);
  const [status, setStatus] = useState(null); // 'idle', 'running', 'done', 'error'
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let interval;
    if (status === 'running' && jobId) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/youtube/job/${jobId}`);
          const data = await res.json();
          if (res.ok) {
            setStatus(data.status);
            setProgress(data.progress);
            setMessage(data.message);
            if (data.status === 'done' || data.status === 'error') {
              clearInterval(interval);
            }
          }
        } catch (err) {
          console.error('Poll error', err);
        }
      }, 800);
    }
    return () => clearInterval(interval);
  }, [status, jobId]);

  const handleStart = async () => {
    setError('');
    setStatus('running');
    setProgress(0);
    setMessage('Starting...');
    
    try {
      const res = await fetch('/api/youtube/channel-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelUrl: url, maxVideos: parseInt(maxVideos) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start');
      setJobId(data.jobId);
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/youtube/job/${jobId}/download`);
      if (!res.ok) throw new Error('Download failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `channel_data_${jobId}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      setError('Download failed');
    }
  };

  return (
    <div className="yt-download">
      <div className="yt-card">
        <h2>YouTube Channel Downloader</h2>
        <p className="yt-subtitle">Fetch metadata & transcripts</p>
        
        <div className="yt-form">
          <label>
            Channel URL
            <input 
              type="text" 
              placeholder="https://www.youtube.com/@channel" 
              value={url} 
              onChange={e => setUrl(e.target.value)}
              disabled={status === 'running'}
            />
          </label>
          
          <label>
            Max Videos (1-100)
            <input 
              type="number" 
              min="1" 
              max="100" 
              value={maxVideos} 
              onChange={e => setMaxVideos(e.target.value)}
              disabled={status === 'running'}
            />
          </label>

          {error && <div className="yt-error">{error}</div>}

          {status === 'running' && (
            <div className="yt-progress-area">
              <div className="yt-progress-bar">
                <div className="yt-progress-fill" style={{ width: `${progress * 100}%` }}></div>
              </div>
              <p className="yt-status-text">{message}</p>
            </div>
          )}

          {status === 'done' && (
            <div className="yt-success">
              <p>✅ {message}</p>
              <button type="button" className="yt-btn download" onClick={handleDownload}>
                Download JSON
              </button>
              <button type="button" className="yt-btn text" onClick={() => setStatus('idle')}>
                Start Over
              </button>
            </div>
          )}

          {status !== 'running' && status !== 'done' && (
            <button 
              type="button"
              className="yt-btn primary" 
              onClick={handleStart}
              disabled={!url}
            >
              Download Channel Data
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
