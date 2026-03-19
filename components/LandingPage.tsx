import React from 'react';

interface LandingPageProps {
  onLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLogin }) => {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-gray-950 text-white">
      <div className="text-center space-y-8 p-8 max-w-md">
        <h1 className="text-5xl font-bold tracking-tight">Sandras Studio</h1>
        <p className="text-xl text-gray-400">Logga in för att börja skapa</p>
        <button 
          onClick={onLogin}
          className="bg-white text-black font-bold py-4 px-8 rounded-full hover:bg-gray-200 transition-all"
        >
          Logga in med Google
        </button>
      </div>
    </div>
  );
};
