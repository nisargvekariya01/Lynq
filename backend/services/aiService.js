import { GoogleGenerativeAI } from '@google/generative-ai';
import env from '../config/env.js';

let genAI = null;
if (env.geminiApiKey) {
  genAI = new GoogleGenerativeAI(env.geminiApiKey);
}

/**
 * Basic HTML parser to extract context if true API fails or to assist Gemini.
 */
const extractContext = async (targetUrl) => {
  try {
    let title = '';

    // Special bypass for YouTube to avoid Cloud/Datacenter IP blocks
    if (targetUrl.includes('youtube.com') || targetUrl.includes('youtu.be')) {
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`);
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        title = data.title;
      }
    }

    // Fallback to standard scraping for other sites (or if oEmbed fails)
    if (!title) {
      const res = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36'
        }
      });
      const html = await res.text();
      
      const ogMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
      title = ogMatch ? ogMatch[1].trim() : '';

      if (!title) {
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        title = titleMatch ? titleMatch[1].trim() : targetUrl;
      }
    }
    
    // Clean up title (remove " - YouTube" etc)
    title = title.replace(/ - YouTube$/i, '').trim();

    // Very naive tag extraction based on words in title
    const tags = title.split(/\s+/).filter(w => w.length > 4).slice(0, 3).map(w => w.replace(/[^a-zA-Z0-9]/g, '').toLowerCase());
    
    // Generate a simple alias
    const customAlias = title.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').substring(0, 15).toLowerCase();

    return { title, tags, customAlias, rawHtml: true };
  } catch (error) {
    return { title: 'My Awesome Link', tags: ['link', 'cool'], customAlias: 'my-link-' + Math.floor(Math.random() * 1000) };
  }
};

export const generateSuggestions = async (targetUrl) => {
  // Always fetch the real title from the internet first (crucial for YouTube video links)
  const context = await extractContext(targetUrl);

  if (!genAI) {
    return context; // Fallback to raw scraper if no API key
  }

  try {
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `Analyze this URL and its actual webpage title.
    URL: ${targetUrl}
    Actual Webpage/Video Title: "${context.title}"
    
    Generate JSON with the following keys:
    - title: A short, catchy title based on the video/webpage title (max 50 chars).
    - customAlias: A short, URL-friendly slug based on the topic (lowercase, dashes only, max 15 chars).
    - tags: An array of 3 relevant short keywords.
    Only return valid JSON matching this schema, no markdown.`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // Parse the JSON string
    return JSON.parse(responseText);
  } catch (error) {
    console.error('Gemini API Error, falling back to local extractor:', error.message);
    return context;
  }
};
