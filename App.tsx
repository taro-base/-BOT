
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
  const [userProfile, setUserProfile] = useState<{ displayName: string; pictureUrl?: string } | null>(null);
  const [liffInitDone, setLiffInitDone] = useState(false);
  const [isOtherDate, setIsOtherDate] = useState(false);
  const [isOtherLocation, setIsOtherLocation] = useState(false);
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
          console.warn("LIFF_ID is not defined. Running in demo mode.");
          setLiffInitDone(true);
          return;
        }
        await liff.init({ liffId: LIFF_ID });
        
        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          setUserProfile({
            displayName: profile.displayName,
            pictureUrl: profile.pictureUrl
          });
        } else if (liff.isInClient()) {
          // If in LINE app but not logged in, try to login
          liff.login();
        }
        // If in external browser and not logged in, we stay as guest to allow preview
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

    const displayName = userProfile?.displayName || "使い手";

    const timer = setTimeout(() => {
      addMessage(`${displayName}さん、こんにちは！お届けに関するヒアリングを開始します。`, 'bot');
      setTimeout(() => {
        addMessage("まず、ご希望の日程を教えてください。", 'bot');
        setCurrentStep(Step.SELECT_DATE);
      }, 800);
    }, 500);
    return () => clearTimeout(timer);
  }, [liffInitDone, userProfile, addMessage]);

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
    
    if (choice === 'ほかの場所') {
      setIsOtherLocation(true);
      addMessage("地図で場所を選択するか、住所を入力してください。", 'bot');
    } else {
      setData((prev) => ({ ...prev, location: choice }));
      showConfirmation(choice);
    }
  };

  const handleCustomLocationSubmit = (locStr: string) => {
    if (!locStr) return;
    addMessage(`${locStr} でお願いします`, 'user');
    setData((prev) => ({ ...prev, location: '新規場所', locationDetails: locStr }));
    setIsOtherLocation(false);
    showConfirmation(locStr);
  };

  const showConfirmation = (locationLabel: string) => {
    setTimeout(() => {
      addMessage("ありがとうございます。以下の内容で送信しますか？", 'bot');
      setCurrentStep(Step.CONFIRMATION);
    }, 600);
  };

  const submitToBackend = async () => {
    if (!GAS_URL) {
      addMessage("システムエラー: 送信先が設定されていません。", 'bot');
      return;
    }

    setIsSubmitting(true);
    addMessage("スプレッドシートに保存しています...", 'bot');

    const payload = {
      userName: userProfile?.displayName || "Unknown User",
      message: `日程: ${data.preferredDate}, 場所: ${data.location}${data.locationDetails ? ` (${data.locationDetails})` : ''}`,
      raw: data
    };

    try {
      // GAS usually handles JSON via POST
      await fetch(GAS_URL, {
        method: 'POST',
        mode: 'no-cors', // standard for GAS web apps unless CORS is specifically set up
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      // Since mode is 'no-cors', we can't reliably read the response status, 
      // but if it didn't throw, we assume success for this simple case.
      setTimeout(() => {
        setIsSubmitting(false);
        addMessage("送信が完了しました。ありがとうございます！", 'bot');
        setCurrentStep(Step.COMPLETED);
      }, 1500);

    } catch (err) {
      console.error("Submission failed", err);
      setIsSubmitting(false);
      addMessage("送信に失敗しました。時間をおいて再度お試しください。", 'bot');
    }
  };

  const sendToLine = () => {
    const summary = `【お届けヒアリング回答】\n日程: ${data.preferredDate}\n場所: ${data.location}${data.locationDetails ? ` (${data.locationDetails})` : ''}`;
    
    // We can also send a message via LIFF talk API if the user is in LINE
    if (liff.isInClient() && liff.getOS() !== 'web') {
      liff.sendMessages([
        {
          type: 'text',
          text: summary,
        }
      ]).then(() => {
        submitToBackend();
      }).catch((err) => {
        console.error("sendMessages failed", err);
        // Fallback to just backend if message sending fails
        submitToBackend();
      });
    } else {
      submitToBackend();
    }
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
              LIFF連携中
            </p>
          </div>
        </div>
        <button 
          onClick={() => window.location.reload()}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
        </button>
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
          <div className="bg-white border border-gray-100 rounded-xl p-4 mb-4 shadow-sm animate-in fade-in zoom-in duration-300">
            <h3 className="font-bold text-gray-800 mb-2 border-b pb-1">確認内容</h3>
            <div className="space-y-1 text-sm text-gray-600">
              <p><span className="font-semibold text-gray-400">希望日程:</span> {data.preferredDate}</p>
              <p><span className="font-semibold text-gray-400">お届け場所:</span> {data.location} {data.locationDetails && `(${data.locationDetails})`}</p>
            </div>
          </div>
        )}
      </main>

      {/* Footer / Inputs */}
      <ActionPanel>
        {currentStep === Step.SELECT_DATE && !isOtherDate && (
          <>
            <button onClick={() => handleDateSelect('明日 午前中 (9:00〜12:00くらい)')} className="flex-1 min-w-[140px] px-4 py-3 bg-white border-2 border-green-500 text-green-600 rounded-xl font-semibold hover:bg-green-50 transition-all text-sm">
              明日 午前中
            </button>
            <button onClick={() => handleDateSelect('明日 午後 (13:00〜17:30くらい)')} className="flex-1 min-w-[140px] px-4 py-3 bg-white border-2 border-green-500 text-green-600 rounded-xl font-semibold hover:bg-green-50 transition-all text-sm">
              明日 午後
            </button>
            <button onClick={() => handleDateSelect('ほかの日にち')} className="flex-1 min-w-[140px] px-4 py-3 bg-gray-100 border-2 border-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-all text-sm">
              ほかの日にち
            </button>
          </>
        )}

        {currentStep === Step.SELECT_DATE && isOtherDate && (
          <div className="w-full flex flex-col gap-2">
            <input 
              type="date" 
              className="w-full p-3 border-2 border-green-200 rounded-xl focus:border-green-500 outline-none transition-all"
              onChange={(e) => handleCustomDateSubmit(e.target.value)}
            />
            <button 
              onClick={() => setIsOtherDate(false)}
              className="text-xs text-gray-400 font-medium hover:text-gray-600 underline"
            >
              戻る
            </button>
          </div>
        )}

        {currentStep === Step.SELECT_LOCATION && !isOtherLocation && (
          <>
            <button onClick={() => handleLocationSelect('いつものところ')} className="flex-1 min-w-[140px] px-4 py-3 bg-white border-2 border-green-500 text-green-600 rounded-xl font-semibold hover:bg-green-50 transition-all text-sm">
              いつものところ
            </button>
            <button onClick={() => handleLocationSelect('ほかの場所')} className="flex-1 min-w-[140px] px-4 py-3 bg-gray-100 border-2 border-gray-100 text-gray-600 rounded-xl font-semibold hover:bg-gray-200 transition-all text-sm">
              ほかの場所
            </button>
          </>
        )}

        {currentStep === Step.SELECT_LOCATION && isOtherLocation && (
          <div className="w-full space-y-3">
             <div className="bg-gray-100 rounded-xl h-40 overflow-hidden relative border-2 border-dashed border-gray-300 group hover:border-green-400 transition-colors">
                <iframe 
                  title="Mock Map"
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d103746.50570659637!2d139.70405!3d35.6895!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x60188b8576281c27%3A0x446dccdc883461e7!2z5p2x5Lqs6YO95paw5a6_5Yy6!5e0!3m2!1sja!2sjp!4v1715000000000!5m2!1sja!2sjp" 
                  className="w-full h-full border-0"
                  loading="lazy"
                ></iframe>
                <div className="absolute inset-0 bg-black/5 pointer-events-none group-hover:bg-transparent transition-all"></div>
                <div className="absolute bottom-2 right-2 bg-white px-2 py-1 rounded shadow text-[10px] text-gray-500 font-medium">
                  Google Map プレビュー
                </div>
             </div>
             <div className="flex gap-2">
                <input 
                  id="loc-input"
                  type="text" 
                  placeholder="住所または建物名を入力" 
                  className="flex-1 p-3 border-2 border-green-100 rounded-xl focus:border-green-500 outline-none transition-all text-sm"
                />
                <button 
                  onClick={() => {
                    const val = (document.getElementById('loc-input') as HTMLInputElement).value;
                    handleCustomLocationSubmit(val || '指定された場所');
                  }}
                  className="px-6 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 transition-all"
                >
                  決定
                </button>
             </div>
             <button 
              onClick={() => setIsOtherLocation(false)}
              className="text-xs text-gray-400 font-medium hover:text-gray-600 underline block text-center w-full"
            >
              戻る
            </button>
          </div>
        )}

        {currentStep === Step.CONFIRMATION && (
          <>
            <button 
              onClick={sendToLine}
              disabled={isSubmitting}
              className={`w-full py-4 bg-green-500 text-white rounded-2xl font-bold text-lg shadow-lg shadow-green-200 hover:bg-green-600 transform active:scale-95 transition-all flex items-center justify-center gap-2 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  送信中...
                </span>
              ) : (
                <>
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M24 10.304c0-4.587-4.79-8.304-10.678-8.304-5.888 0-10.678 3.717-10.678 8.304 0 4.11 3.807 7.545 8.95 8.197.349.075.823.23.944.529.108.266.071.684.035.953-.127.915-.558 3.667-.62 4.09-.071.477.33.186 1.155-.547.763-.678 4.12-3.807 5.621-5.632 1.487.03 2.802-.455 3.832-1.258 1.139-.884 1.444-2.333 1.444-6.332z"/>
                  </svg>
                  回答を送信する
                </>
              )}
            </button>
            <button 
              onClick={() => {
                setMessages([]);
                setCurrentStep(Step.GREETING);
                setData({ preferredDate: '', location: '' });
                window.location.reload();
              }}
              className="w-full py-3 bg-white border-2 border-gray-100 text-gray-400 rounded-2xl font-bold hover:bg-gray-50 transition-all text-sm"
            >
              最初からやり直す
            </button>
          </>
        )}

        {currentStep === Step.COMPLETED && (
          <div className="text-center py-4 w-full">
            <div className="mb-4 inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-500 rounded-full">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <p className="font-bold text-gray-800">送信が完了しました！</p>
            <p className="text-sm text-gray-500">スプレッドシートに正常に記録されました。</p>
            <button 
              onClick={() => liff.closeWindow()}
              className="mt-4 w-full py-3 bg-green-500 text-white rounded-xl text-sm font-semibold hover:bg-green-600 transition-colors"
            >
              閉じる
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="mt-2 text-xs text-gray-400 underline"
            >
              新しく回答する
            </button>
          </div>
        )}
      </ActionPanel>
    </div>
  );
};

export default App;
