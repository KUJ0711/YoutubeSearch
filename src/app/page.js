"use client";

// src/app/page.js

import { useEffect, useState } from "react";

export default function HomePage() {
  const [channelName, setChannelName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [videoIds, setVideoIds] = useState([]);
  const [randomVideoId, setRandomVideoId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e) => {
    setSearchQuery(e.target.value);
  };

  const validateApiKey = () => {
    const apiKey = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY;
    if (!apiKey) {
      console.error("API key is missing. Please set NEXT_PUBLIC_YOUTUBE_API_KEY in your .env.local file and restart the server.");
      setChannelName("API 키가 설정되지 않았습니다.");
      setIsLoading(false);
      return null;
    }
    return apiKey;
  };

  const fetchChannelData = async (apiKey) => {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${searchQuery}&type=channel&key=${apiKey}`
    );
    if (!response.ok) {
      throw new Error(`YouTube API request failed with status ${response.status}`);
    }
    return response.json();
  };

  const exponentialBackoff = async (fn, retries = 5, delay = 1000) => {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0 && error.message.includes("quotaExceeded")) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return exponentialBackoff(fn, retries - 1, delay * 2);
      } else {
        throw error;
      }
    }
  };

  const fetchChannelName = async () => {
    if (searchQuery.trim() === "") return;

    setIsLoading(true);
    try {
      const apiKey = validateApiKey();
      if (!apiKey) return;

      const data = await exponentialBackoff(() => fetchChannelData(apiKey));

      if (data.items && data.items.length > 0) {
        const channelId = data.items[0].snippet.channelId;
        setChannelName(data.items[0].snippet.title);
        fetchVideoIds(channelId);
      } else {
        setChannelName("채널을 찾을 수 없습니다.");
      }
    } catch (error) {
      if (error.message.includes("quotaExceeded")) {
        console.error("API 요청 한도가 초과되었습니다. 잠시 후 다시 시도해 주세요.");
        setChannelName("API 요청 한도가 초과되었습니다. 잠시 후 다시 시도해 주세요.");
      } else if (error.message.includes("403")) {
        console.error("API 키가 유효하지 않거나 권한이 없습니다. API 설정을 확인하세요.");
        setChannelName("API 키가 유효하지 않거나 권한이 없습니다. API 설정을 확인하세요.");
      } else {
        console.error("Failed to fetch channel info:", error);
        setChannelName("오류가 발생했습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchVideoIds = async (channelId) => {
    try {
      const apiKey = validateApiKey();
      if (!apiKey) return;

      let nextPageToken = "";
      let allVideoIds = [];
      let iterationCount = 0;
      const maxIterations = 5; // Limit the number of iterations to avoid exceeding API rate limits

      do {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelId}&part=snippet&type=video&maxResults=50&pageToken=${nextPageToken}`
        );
        if (!response.ok) {
          throw new Error(`YouTube API request failed with status ${response.status}`);
        }
        const data = await response.json();

        if (data.items) {
          const videoIds = data.items
            .map((item) => item.id && item.id.videoId)
            .filter((id) => id);
          allVideoIds = [...allVideoIds, ...videoIds];
        }

        nextPageToken = data.nextPageToken || "";
        iterationCount++;
      } while (nextPageToken && iterationCount < maxIterations);

      setVideoIds(allVideoIds);
      if (allVideoIds.length > 0) {
        const randomIndex = Math.floor(Math.random() * allVideoIds.length);
        setRandomVideoId(allVideoIds[randomIndex]);
      } else {
        console.warn("No videos found for the specified channel.");
        setRandomVideoId(null);
      }
    } catch (error) {
      if (error.message.includes("quotaExceeded")) {
        console.error("API 요청 한도가 초과되었습니다. 잠시 후 다시 시도해 주세요.");
      } else if (error.message.includes("403")) {
        console.error("API 키가 유효하지 않거나 권한이 없습니다. API 설정을 확인하세요.");
      } else {
        console.error("Failed to fetch video IDs:", error);
      }
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-r from-pink-300 via-purple-300 to-blue-300">
      <header className="w-full py-6"></header>
      <main className="flex-1 w-full flex flex-col items-center p-8" onKeyDown={(e) => { if (e.key === 'Enter' && !isLoading) fetchChannelName(); }}>
        <input
          type="text"
          name="채널검색"
          className="border border-gray-300 p-2 w-full sm:w-3/4 md:w-1/2 mb-4 text-black"
          placeholder="채널명을 입력하세요"
          value={searchQuery}
          onChange={handleInputChange}
        />
        <button
          onClick={fetchChannelName}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 mb-4"
          disabled={isLoading}
        >
          {isLoading ? "검색 중..." : "채널 검색"}
        </button>
        {randomVideoId && (
          <div className="w-full h-[200px] sm:h-[400px] md:h-[720px] max-w-[1280px] mb-4">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${randomVideoId}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        )}
        <p className="text-center text-lg text-gray-700 mb-4">
          YouTube 채널명을 검색하시면 랜덤한 동영상이 표시됩니다.
        </p>
      </main>
      <footer className="w-full py-4"></footer>
    </div>
  );
}
