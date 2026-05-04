import React, { useState, useEffect, useRef, useCallback } from 'react';
import liff from '@line/liff';
import { Step, ChatMessage, HearingData } from './types';
import ChatBubble from './components/ChatBubble';
import ActionPanel from './components/ActionPanel';

const LIFF_ID = import.meta.env.VITE_LIFF_ID || "";
const GAS_URL = import.meta.env.VITE_GAS_WEB_APP_URL || "";

const App: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentStep, setCurrentStep] = useState<Step>(Step.GREETING);
  const [data, setData] = useState<HearingData>({
    preferredDate: '',
    location: '',
  });
  const [userProfile, setUserProfile] = useState<{ displayName: string; pictureUrl?: string; userId?: string } | null>(null);
  const [liffInitDone, setLiffInitDone] = useState(false);
  const [isOtherDate, setIsOtherDate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Helper to add a message
  const addMessage = useCallback((text: string, sender: 'bot' | 'user') => {
    const newMessage: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      text,
      sender,
    };
    setMessages((prev) => [...prev, newMessage]);
  }, []);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  // Initialize LIFF
  useEffect(() => {
    const initLiff = async () => {
      try {
        if (!LIFF_ID) {
          console.warn("LIFF_ID is not defined.");
          setLiffInitDone(true);
          return;
        }
        await liff.init({ liffId: LIFF_ID });
        
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          setUserProfile({
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl,
            userId: profile.userId
          });
        } else {
          liff.login();
        }
      } catch (err) {
        console.error("LIFF initialization failed", err);
      } finally {
        setLiffInitDone(true);
      }
    };
    initLiff();
  }, []);

  // Initial greeting
  useEffect(() => {
    if (!liffInitDone) return; 

    const timer = setTimeout(() => {
      addMessage(`お世話になっております！お届けに関して、ご希望をお伺いします。`, 'bot');
      setTimeout(() => {
        addMessage("まず、ご希望の日程を教えてください。", 'bot');
        setCurrentStep(Step.SELECT_DATE);
      }, 800);
    }, 500);
    return () => clearTimeout(timer);
  }, [liffInitDone, addMessage]);

  const handleDateSelect = (choice: string) => {
    addMessage(choice, 'user');
    
    if (choice === 'ほかの日にち') {
      setIsOtherDate(true);
      addMessage("ご希望の日にちを入力、またはカレンダーから選択してください。", 'bot');
    } else {
      setData((prev) => ({ ...prev, preferredDate: choice }));
      askLocation();
    }
  };

  const handleCustomDateSubmit = (dateStr: string) => {
    if (!dateStr) return;
    addMessage(`${dateStr} を希望します`, 'user');
    setData((prev) => ({ ...prev, preferredDate: dateStr }));
    setIsOtherDate(false);
    askLocation();
  };

  const askLocation = () => {
    setTimeout(() => {
      addMessage("お届け場所はどちらですか？", 'bot');
      setCurrentStep(Step.SELECT_LOCATION);
    }, 600);
  };

  const handleLocationSelect = (choice: string) => {
    addMessage(choice, 'user');
    setData((prev) => ({ ...prev, location: choice }));
    showConfirmation();
  };

  const handleCustomLocationSubmit = (locStr: string) => {
    if (!locStr) return;
    addMessage(`${locStr} でお願いします`, 'user');
    setData((prev) => ({ ...prev, location: locStr }));
    showConfirmation();
  };

  const showConfirmation = () => {
    setTimeout(() => {
      addMessage("ありがとうございます。以下の内容で送信しますか？", 'bot');
      setCurrentStep(Step.CONFIRMATION);
    }, 600);
  };

  const submitToBackend = async () => {
    if (!GAS_URL) {
      addMessage("システム設定エラー: GAS送信先が設定されていません。", 'bot');
      setIsSubmitting(false);
      return;
    }

    // 送信直前にプロフィールを再確認（「不明」対策）
    let currentUserName = userProfile?.displayName;
    let currentUserId = userProfile?.userId;

    if (!currentUserName && liff.isLoggedIn()) {
      try {
        const profile = await liff.getProfile();
        currentUserName = profile.displayName;
        currentUserId = profile.userId;
      } catch (e) {
        console.error("Profile re-fetch failed", e);
      }
    }

    const summary = `【お届けヒアリング回答】\n日程: ${data.preferredDate}\n場所: ${data.location}`;

    const payload = {
      userName: currentUserName || "不明",
      userId: currentUserId || "不明",
      message: summary,
      preferredDate: data.preferredDate,
      location: data.location,
      timestamp: new Date().toISOString()
    };

    try {
      await fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {
          'Content-Type': 'text/plain',
        },
        body: JSON.stringify(payload),
      });

      setIsSubmitting(false);
      addMessage("ありがとうございます！記録が完了しました。", 'bot');
      setCurrentStep(Step.COMPLETED);

    } catch (err) {
      console.error("Submission failed", err);
      setIsSubmitting(false);
      addMessage("送信に失敗しました。もう一度お試しください。", 'bot');
    }
  };

  const sendToLine = async () => {
    setIsSubmitting(true);
    const summary = `【お届けヒアリング回答】\n日程: ${data.preferredDate}\n場所: ${data.location}`;
    
    if (liff.isInClient()) {
      try {
        await liff.sendMessages([
          {
            type: 'text',
            text: summary,
          }
        ]);
      } catch (err) {
        console.error("sendMessages failed", err);
      }
    }
    
    await submitToBackend();
  };

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto border-x border-gray-100 bg-white">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          {userProfile?.pictureUrl ? (
            <img 
              src={userProfile.pictureUrl} 
              alt="Profile" 
              className="w-10 h-10 rounded-full object-cover border border-gray-200"
            />
          ) : (
            <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center text-white font-bold">
              L
            </div>
          )}
          <div>
            <h1 className="font-bold text-gray-800">
              {userProfile?.displayName ? `${userProfile.displayName}さんの回答` : 'ヒアリングBot'}
            </h1>
            <p className="text-xs text-green-500 font-medium flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              LINE公式アカウント連携中
            </p>
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-2 bg-[#f8fafc]"
      >
        {messages.map((m) => (
          <ChatBubble key={m.id} sender={m.sender}>
            {m.text}
          </ChatBubble>
        ))}
        {currentStep === Step.CONFIRMATION && (
          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 shadow-sm">
            <h3 className="font-bold text-gray-800 mb-2 border-b pb-1">確認内容</h3>
            <div className="space-y-1 text-sm text-gray-600">
              <p><span className="font-semibold text-gray-400">希望日程:</span> {data.preferredDate}</p>
              <p><span className="font-semibold text-gray-400">お届け場所:</span> {data.location}</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer / Inputs */}
      <ActionPanel>
        {currentStep === Step.SELECT_DATE && !isOtherDate && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => handleDateSelect('明日 午前中 (9:00〜12:00くらい)')} className="flex-1 min-w-[140px] px-4 py-3 bg-white border-2 border-green-500 text-green-600 rounded-xl font-semibold hover:bg-green-50 transition-all text-sm">
              明日 午前中
            </button>
            <button onClick={() => handleDateSelect('明日 午後 (13:00〜17:30くらい)')} className="flex-1 min-w-[140px] px-4 py-3 bg-white border-2 border-green-500 text-green-600 rounded-xl font-semibold hover:bg-green-50 transition-all text-sm">
              明日 午後
            </button>
            <button onClick={() => handleDateSelect('ほかの日にち')} className="flex-1 min-w-[140px] px-4 py-3 bg-gray-100 border-2 border-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-all text-sm">
              ほかの日にち
            </button>
          </div>
        )}

        {currentStep === Step.SELECT_DATE && isOtherDate && (
          <div className="w-full flex flex-col gap-2">
            <input 
              type="date" 
              className="w-full p-3 border-2 border-green-200 rounded-xl focus:border-green-500 outline-none"
              onChange={(e) => handleCustomDateSubmit(e.target.value)}
            />
            <button onClick={() => setIsOtherDate(false)} className="text-xs text-gray-400 underline">戻る</button>
          </div>
        )}

        {currentStep === Step.SELECT_LOCATION && (
          <div className="w-full flex flex-col gap-3">
            <div className="flex gap-2">
              <button onClick={() => handleLocationSelect('いつものところ')} className="flex-1 px-4 py-3 bg-white border-2 border-green-500 text-green-600 rounded-xl font-semibold text-sm">いつもの</button>
              <button onClick={() => handleLocationSelect('店舗受取')} className="flex-1 px-4 py-3 bg-white border-2 border-green-500 text-green-600 rounded-xl font-semibold text-sm">店舗受取</button>
            </div>
            <div className="relative">
              <input 
                id="custom-location-input"
                type="text" 
                placeholder="新しい住所を入力..."
                className="w-full pl-4 pr-16 py-3 border-2 border-gray-100 rounded-xl outline-none text-sm"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCustomLocationSubmit((e.target as HTMLInputElement).value);
                    (e.target as HTMLInputElement).value = '';
                  }
                }}
              />
              <button 
                onClick={() => {
                  const input = document.getElementById('custom-location-input') as HTMLInputElement;
                  handleCustomLocationSubmit(input.value);
                  input.value = '';
                }}
                className="absolute right-2 top-1.5 bottom-1.5 px-3 bg-green-500 text-white rounded-lg text-xs font-bold"
              >決定</button>
            </div>
          </div>
        )}

        {currentStep === Step.CONFIRMATION && (
          <div className="w-full space-y-2">
            <button onClick={sendToLine} disabled={isSubmitting} className="w-full py-4 bg-green-500 text-white rounded-2xl font-bold text-lg shadow-lg">
              {isSubmitting ? "送信中..." : "回答を送信する"}
            </button>
            <button onClick={() => window.location.reload()} className="w-full py-2 text-gray-400 text-sm">最初からやり直す</button>
          </div>
        )}

        {currentStep === Step.COMPLETED && (
          <div className="text-center py-4 w-full">
            <div className="mb-4 inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-500 rounded-full">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <p className="font-bold text-gray-800">送信が完了しました！</p>
            <p className="text-sm text-gray-500">スケジュール確認後、担当者からお返事します。</p>
            <button onClick={() => liff.closeWindow()} className="mt-4 w-full py-3 bg-green-500 text-white rounded-xl text-sm font-semibold">閉じる</button>
          </div>
        )}
      </ActionPanel>
    </div>
  );
};

export default App;
