import React from "react";
import { Link } from "react-router-dom";

const NotFound = () => {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-[#0a0a0a] via-black to-[#141414] flex flex-col justify-center items-center text-white relative overflow-hidden">

      {/* background glow balls */}
      <div className="absolute w-72 h-72 bg-purple-600/30 blur-3xl rounded-full top-10 left-10 animate-pulse"></div>
      <div className="absolute w-72 h-72 bg-blue-600/30 blur-3xl rounded-full bottom-10 right-10 animate-pulse"></div>

      <div className="text-center z-10">
        <img src="/404.png" className="w-80 mx-auto drop-shadow-[0_0_20px_rgba(255,255,255,0.15)]" alt="404" />

        <h1 className="text-4xl font-bold mt-6 tracking-wider">
          Oops! Page Not Found
        </h1>

        <p className="text-gray-400 mt-2 text-lg">
          The page you're looking for doesn't exist.
        </p>

        <Link
          to="/"
          replace
          className="mt-6 inline-block bg-gradient-to-r from-blue-500 to-purple-500 px-6 py-2 rounded-md font-medium shadow-lg hover:scale-105 transition-all duration-200"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
