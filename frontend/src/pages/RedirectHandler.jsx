import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

/**
 * RedirectHandler
 * Catch-all route that instantly forwards the browser from the frontend 
 * (e.g. lynq.nisargvekariya.me/abc) to the backend API (api.lynq.../abc).
 * This ensures the links look pretty, but the backend still handles analytics and the final 302 redirect.
 */
export default function RedirectHandler() {
  const { shortCode } = useParams();

  useEffect(() => {
    if (shortCode) {
      // Use the API URL but strip off the trailing '/api' if present
      const apiUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/api$/, '');
      const baseUrl = apiUrl === '' ? window.location.origin : apiUrl;
      
      // Perform a hard client-side redirect to the backend
      window.location.replace(`${baseUrl}/${shortCode}`);
    }
  }, [shortCode]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column' }}>
      <div className="spinner" style={{ width: '40px', height: '40px', marginBottom: '20px' }}></div>
      <p style={{ color: 'var(--text-secondary)' }}>Redirecting...</p>
    </div>
  );
}
