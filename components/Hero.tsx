import Link from 'next/link';
import { ArrowRight, Code2, Zap, Shield } from 'lucide-react';

export default function Hero() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-900 to-blue-950/20" />
      
      {/* Grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#18181b_1px,transparent_1px),linear-gradient(to_bottom,#18181b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_110%)]" />

      <div className="relative max-w-5xl mx-auto text-center space-y-8">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-semibold">
          <Zap size={16} />
          Institutional-Grade Risk Intelligence
        </div>

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white">
          RiskModels API
        </h1>
        
        <p className="text-xl sm:text-2xl md:text-3xl text-zinc-400 font-medium">
          Precise Factor-Based Equity Risk & Hedging
        </p>

        {/* Subheadline */}
        <p className="max-w-3xl mx-auto text-lg text-zinc-400 leading-relaxed">
          Daily factor decompositions, hedge ratios, and risk attribution for ~3,000 US equities. 
          AI-agent ready with machine-readable manifests. Historical data back to 2006.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link
            href="/quickstart"
            className="group px-8 py-4 bg-primary hover:bg-primary/90 text-white text-lg font-semibold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30"
          >
            Get Started
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/api-reference"
            className="px-8 py-4 bg-zinc-800/50 hover:bg-zinc-800 text-white text-lg font-semibold rounded-lg border border-zinc-700 transition-all"
          >
            View API Spec
          </Link>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-16 max-w-4xl mx-auto">
          <div className="p-6 rounded-lg bg-zinc-900/50 border border-zinc-800 backdrop-blur-sm">
            <Code2 className="text-primary mb-3" size={28} />
            <h3 className="text-lg font-semibold text-white mb-2">Developer-First</h3>
            <p className="text-sm text-zinc-400">
              Clean REST API with TypeScript, Python, and cURL examples. OpenAPI 3.0 spec included.
            </p>
          </div>
          
          <div className="p-6 rounded-lg bg-zinc-900/50 border border-zinc-800 backdrop-blur-sm">
            <Zap className="text-primary mb-3" size={28} />
            <h3 className="text-lg font-semibold text-white mb-2">AI-Agent Ready</h3>
            <p className="text-sm text-zinc-400">
              OAuth2 client credentials, per-request billing, and machine-readable manifests.
            </p>
          </div>
          
          <div className="p-6 rounded-lg bg-zinc-900/50 border border-zinc-800 backdrop-blur-sm">
            <Shield className="text-primary mb-3" size={28} />
            <h3 className="text-lg font-semibold text-white mb-2">Institutional Grade</h3>
            <p className="text-sm text-zinc-400">
              Powered by ERM3 regression system with daily updates and 15+ years of history.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
