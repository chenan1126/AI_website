import { Link } from 'react-router-dom'
import { useEffect } from 'react'

function HomePage() {
  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
        }
      });
    }, {
      threshold: 0.1
    });
    const elements = document.querySelectorAll('.animate-on-scroll');
    elements.forEach(el => observer.observe(el));
    
    return () => {
      elements.forEach(el => observer.unobserve(el));
    };
  }, []);

  return (
    <>
      <section className="relative h-screen flex items-center justify-center text-center overflow-hidden">
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 z-0 w-full h-full object-cover"
          >
            <source src="/bg.mp4" type="video/mp4" />
            您的瀏覽器不支援影片標籤。
        </video>
        <div className="absolute inset-0 bg-black/50"></div>
        <div className="relative z-10 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto">
          <h1 className="font-serif text-5xl sm:text-7xl lg:text-8xl font-bold text-white tracking-tight animate-fade-in-up" style={{animationDelay: '0.8s'}}>
            智慧規劃，探索世界
          </h1>
          <p className="mt-8 text-xl lg:text-2xl text-gray-200 max-w-2xl mx-auto animate-fade-in-up" style={{animationDelay: '1s'}}>
            讓 AI 為您打造專屬旅程。探索未知，發現驚喜，體驗前所未有的旅行。
          </p>
          <div className="mt-12 animate-fade-in-up" style={{animationDelay: '1.2s'}}>
            <Link className="inline-block bg-primary text-white font-semibold text-xl px-10 py-5 rounded-full hover:bg-opacity-90 transition-all duration-300 transform hover:scale-110 shadow-lg hover:shadow-2xl" to="/plan">
              開始規劃
            </Link>
          </div>
        </div>
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20">
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-white/80 rounded-full animate-bounce"></div>
          </div>
        </div>
      </section>
      <section className="py-20 sm:py-32 bg-background-light dark:bg-background-dark">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16 animate-on-scroll">
            <h2 className="font-serif text-4xl sm:text-5xl font-bold text-text-light dark:text-text-dark">功能亮點</h2>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">我們如何讓您的旅行更輕鬆</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 transform hover:-translate-y-2 animate-on-scroll">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary mx-auto mb-6">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                  <path d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-text-light dark:text-text-dark">個人化行程</h3>
              <p className="text-gray-600 dark:text-gray-400">根據您的興趣和預算，AI 為您量身打造獨一無二的旅遊路線。</p>
            </div>
            <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 transform hover:-translate-y-2 animate-on-scroll" style={{transitionDelay: '0.2s'}}>
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary mx-auto mb-6">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-text-light dark:text-text-dark">智慧推薦</h3>
              <p className="text-gray-600 dark:text-gray-400">發掘隱藏版景點和在地美食，讓您的旅程充滿驚喜。</p>
            </div>
            <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-xl shadow-lg hover:shadow-2xl transition-shadow duration-300 transform hover:-translate-y-2 animate-on-scroll" style={{transitionDelay: '0.4s'}}>
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary/10 text-primary mx-auto mb-6">
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                </svg>
              </div>
              <h3 className="text-2xl font-semibold mb-3 text-text-light dark:text-text-dark">實時調整</h3>
              <p className="text-gray-600 dark:text-gray-400">隨時隨地調整行程，應對突發狀況，讓旅行更靈活。</p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

export default HomePage
