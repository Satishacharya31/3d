/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState } from 'react';
import { auth, signInWithGoogle, signOut } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { MyraOS } from './components/MyraOS';
import { UserCircle } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  if (loading) {
    return (
      <>
        <div className="mesh-bg"></div>
        <div className="flex flex-col items-center justify-center h-screen w-screen relative">
          <div className="glass rounded-3xl p-8 flex flex-col items-center shadow-2xl">
            <div className="w-12 h-12 rounded-full border-t-2 border-r-2 border-pink-500 animate-spin ai-glow mb-6"></div>
            <p className="text-xs font-bold uppercase tracking-widest text-pink-300">INITIALIZING MYRA OS...</p>
          </div>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <div className="mesh-bg"></div>
        <div className="flex items-center justify-center h-screen w-screen relative selection:bg-pink-500/30">
          <div className="p-10 max-w-sm w-full glass rounded-3xl shadow-2xl flex flex-col items-center">
            <div className="w-16 h-16 rounded-full glass flex items-center justify-center mb-6 ai-glow shadow-inner">
              <UserCircle className="w-8 h-8 text-pink-300" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">MYRA <span className="text-pink-400 opacity-80 font-normal">Core</span></h1>
            <p className="text-white/50 text-sm text-center mb-8 h-12 flex items-center">
              Sign in to authenticate secure connection.
            </p>
            <button
              onClick={signInWithGoogle}
              className="w-full py-4 bg-gradient-to-r from-pink-600 to-purple-600 text-white font-bold rounded-xl hover:opacity-90 transition-opacity active:scale-95"
            >
              AUTHENTICATE
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="mesh-bg"></div>
      <div className="h-screen w-screen overflow-hidden text-white font-sans relative flex p-6">
        <MyraOS user={user} onSignOut={signOut} />
      </div>
    </>
  );
}
