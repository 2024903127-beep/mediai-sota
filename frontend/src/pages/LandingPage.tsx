import { Link } from 'react-router-dom'
import { 
  Heart, Shield, Zap, Search, ArrowRight, CheckCircle, 
  Activity, Smartphone, Lock, Clipboard 
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center shadow-brand-sm">
                <Heart className="text-white" size={20} fill="currentColor" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                MediAI
              </span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors">Features</a>
              <a href="#how-it-works" className="text-sm font-medium text-slate-600 hover:text-brand-600 transition-colors">How it works</a>
              <Link to="/login" className="text-sm font-semibold text-slate-900 hover:text-brand-600 transition-colors">Log in</Link>
              <Link to="/register" className="btn-primary py-2 px-5 text-sm shadow-brand-sm">Get Started</Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-full -z-10">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand-100/50 rounded-full blur-3xl opacity-60" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-100/50 rounded-full blur-3xl opacity-60" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 border border-brand-100 mb-6 animate-fade-in">
            <Zap size={14} className="text-brand-600" />
            <span className="text-xs font-bold text-brand-700 uppercase tracking-wider">Next-Gen Health Intelligence</span>
          </div>
          
          <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 mb-8 tracking-tight animate-slide-up">
            Understand Your <br />
            <span className="text-brand-600">Medicines</span> with AI
          </h1>
          
          <p className="max-w-2xl mx-auto text-xl text-slate-500 mb-10 animate-slide-up [animation-delay:100ms]">
            Professional-grade prescription scanning, smart risk alerts, 
            and clear clinical explanations. All powered by state-of-the-art 
            offline medical intelligence.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up [animation-delay:200ms]">
            <Link to="/register" className="btn-primary text-lg py-4 px-8 shadow-brand-lg group">
              Get Started for Free
              <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
            </Link>
            <Link to="/login" className="btn-secondary text-lg py-4 px-8 border-slate-200">
              Try Interactive Demo
            </Link>
          </div>

          <div className="mt-16 flex items-center justify-center gap-8 grayscale opacity-50">
             <div className="font-bold text-xl tracking-tighter">RxNorm</div>
             <div className="font-bold text-xl tracking-tighter">OpenFDA</div>
             <div className="font-bold text-xl tracking-tighter">ICD-11</div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-slate-900 mb-4">Precision Intelligence</h2>
            <p className="text-slate-500">Built for accuracy. Designed for patients.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Search />}
              title="Prescription Scanning"
              desc="Our OCR ensemble extracts drug names, dosages, and frequencies from even handwritten notes with high precision."
            />
            <FeatureCard 
              icon={<Zap />}
              title="Instant Explanations"
              desc="Get clear, simple-to-understand breakdowns of what your medicines do and why they were prescribed."
            />
            <FeatureCard 
              icon={<Shield />}
              title="Risk Detection"
              desc="Automatic checking for drug-drug interactions and patient-specific allergy risks before you take a dose."
            />
          </div>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col lg:flex-row items-center gap-16">
            <div className="flex-1">
              <h2 className="text-4xl font-bold text-slate-900 mb-8">How it Works</h2>
              <div className="space-y-8">
                <Step 
                  num="01"
                  title="Upload or Capture"
                  desc="Snap a photo of your prescription or medicine label using our secure live-camera interface."
                />
                <Step 
                   num="02"
                   title="AI Processing"
                   desc="Our local medical brain analyzes the image, cleans the noise, and cross-references thousands of drugs."
                />
                <Step 
                   num="03"
                   title="Get Smart Insights"
                   desc="Receive a structured report with confidence scores, dosage summaries, and safety warnings."
                />
              </div>
            </div>
            <div className="flex-1 relative">
              <div className="aspect-square bg-brand-600/5 rounded-3xl border border-brand-100 flex items-center justify-center p-12">
                <div className="w-full h-full bg-white rounded-2xl shadow-premium border border-slate-100 p-6 animate-pulse">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-brand-50" />
                    <div className="h-4 w-32 bg-slate-100 rounded" />
                  </div>
                  <div className="space-y-3">
                    <div className="h-3 w-full bg-slate-50 rounded" />
                    <div className="h-3 w-5/6 bg-slate-50 rounded" />
                    <div className="h-3 w-4/6 bg-slate-50 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="py-24 bg-brand-900 text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-400/20 rounded-full blur-[120px]" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="max-w-3xl">
            <h2 className="text-4xl font-bold mb-6">Privacy First. Health Always.</h2>
            <p className="text-brand-100 text-lg mb-10">
              MediAI is built with privacy at its core. Most of our AI processing happens directly 
              on your device or within our secure, local medical brain. Your health data is your own.
            </p>
            <div className="grid grid-cols-2 gap-6">
              <div className="flex items-center gap-3">
                <Lock className="text-brand-400" />
                <span className="font-medium">Secure End-to-End</span>
              </div>
              <div className="flex items-center gap-3">
                <Smartphone className="text-brand-400" />
                <span className="font-medium">Offline Intelligence</span>
              </div>
              <div className="flex items-center gap-3">
                <Activity className="text-brand-400" />
                <span className="font-medium">Risk Monitoring</span>
              </div>
              <div className="flex items-center gap-3">
                <Clipboard className="text-brand-400" />
                <span className="font-medium">Patient Centered</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-brand-600 rounded-lg flex items-center justify-center">
              <Heart className="text-white" size={14} fill="currentColor" />
            </div>
            <span className="font-bold text-slate-900">MediAI</span>
          </div>
          <p className="text-sm text-slate-400">© 2024 MediAI. Built for educational and awareness purposes. Always consult a doctor.</p>
          <div className="flex gap-6">
            <a href="#" className="text-sm text-slate-500 hover:text-brand-600">Privacy</a>
            <a href="#" className="text-sm text-slate-500 hover:text-brand-600">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, desc }: any) {
  return (
    <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-soft hover:shadow-premium transition-all hover:-translate-y-1">
      <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center text-brand-600 mb-6">
        {icon}
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-3">{title}</h3>
      <p className="text-slate-500 leading-relaxed text-sm">{desc}</p>
    </div>
  )
}

function Step({ num, title, desc }: any) {
  return (
    <div className="flex gap-6">
      <div className="text-4xl font-black text-brand-100 leading-none">{num}</div>
      <div>
        <h4 className="text-lg font-bold text-slate-900 mb-2">{title}</h4>
        <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}
