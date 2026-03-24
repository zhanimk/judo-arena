import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { kz } from '@/lib/kz';
import { Button } from '@/components/ui/button';
import { Trophy, GitBranch, Timer, BarChart3, Shield, Dumbbell, GraduationCap, Scale, ArrowRight, Users, Zap, Star, Radio } from 'lucide-react';
import { demoTournaments } from '@/lib/demo-data';
import { StatusBadge } from '@/components/ui-premium';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const features = [
  { icon: <Trophy size={28} />, title: kz.home.featureTournament, desc: kz.home.featureTournamentDesc },
  { icon: <GitBranch size={28} />, title: kz.home.featureBracket, desc: kz.home.featureBracketDesc },
  { icon: <Timer size={28} />, title: kz.home.featureJudge, desc: kz.home.featureJudgeDesc },
  { icon: <BarChart3 size={28} />, title: kz.home.featureAnalytics, desc: kz.home.featureAnalyticsDesc },
];

const roles = [
  { icon: <Dumbbell size={24} />, title: kz.roles.athlete, desc: kz.home.roleAthleteDesc, color: 'text-info' },
  { icon: <GraduationCap size={24} />, title: kz.roles.coach, desc: kz.home.roleCoachDesc, color: 'text-success' },
  { icon: <Shield size={24} />, title: kz.roles.admin, desc: kz.home.roleAdminDesc, color: 'text-primary' },
  { icon: <Scale size={24} />, title: kz.roles.judge, desc: kz.home.roleJudgeDesc, color: 'text-warning' },
];

const stats = [
  { value: '240+', label: kz.home.stats.tournaments },
  { value: '12,000+', label: kz.home.stats.athletes },
  { value: '48,000+', label: kz.home.stats.matches },
  { value: '350+', label: kz.home.stats.clubs },
];

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-navy-deep/80 backdrop-blur-md border-b border-border">
        <div className="container mx-auto flex items-center justify-between h-16 px-6">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg gradient-gold flex items-center justify-center">
              <Trophy size={18} className="text-primary-foreground" />
            </div>
            <span className="font-display text-lg font-bold text-foreground">Judo-Arena</span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{kz.home.features}</a>
            <a href="#roles" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{kz.home.rolesTitle}</a>
            <a href="#live" className="text-sm text-muted-foreground hover:text-foreground transition-colors">{kz.home.liveTournament}</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login"><Button variant="ghost" size="sm">{kz.nav.login}</Button></Link>
            <Link to="/register"><Button variant="gold" size="sm">{kz.nav.register}</Button></Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-navy-deep via-background to-background" />
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="container mx-auto px-6 relative">
          <motion.div
            className="max-w-3xl mx-auto text-center"
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fadeUp} custom={0} className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6">
              <Zap size={12} /> Қазақстандағы №1 дзюдо платформасы
            </motion.div>
            <motion.h1 variants={fadeUp} custom={1} className="text-4xl md:text-6xl font-display font-bold text-foreground leading-tight mb-6">
              {kz.home.heroTitle}
            </motion.h1>
            <motion.p variants={fadeUp} custom={2} className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              {kz.home.heroSubtitle}
            </motion.p>
            <motion.div variants={fadeUp} custom={3} className="flex items-center justify-center gap-4">
              <Link to="/admin"><Button variant="gold" size="lg" className="gap-2">{kz.home.heroCta} <ArrowRight size={16} /></Button></Link>
              <a href="#features"><Button variant="navy" size="lg">{kz.home.heroSecondary}</Button></a>
            </motion.div>
          </motion.div>

          {/* Stats */}
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-16 max-w-3xl mx-auto"
            initial="hidden" animate="visible"
          >
            {stats.map((s, i) => (
              <motion.div key={i} variants={fadeUp} custom={i + 4} className="text-center p-4 card-premium">
                <p className="text-2xl font-display font-bold text-primary">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-navy-deep/30">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-display font-bold text-foreground text-center mb-4">{kz.home.features}</h2>
          <p className="text-muted-foreground text-center mb-12 max-w-md mx-auto">Турнир басқарудың барлық құралдары бір платформада</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={i}
                className="card-premium p-6 hover:border-primary/30 transition-all group"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className="w-12 h-12 rounded-lg bg-navy-surface flex items-center justify-center text-primary mb-4 group-hover:gold-glow transition-all">
                  {f.icon}
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="py-20">
        <div className="container mx-auto px-6">
          <h2 className="text-3xl font-display font-bold text-foreground text-center mb-12">{kz.home.rolesTitle}</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {roles.map((r, i) => (
              <motion.div
                key={i}
                className="card-premium p-6 text-center"
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div className={`w-14 h-14 rounded-full bg-navy-surface flex items-center justify-center mx-auto mb-4 ${r.color}`}>
                  {r.icon}
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{r.title}</h3>
                <p className="text-sm text-muted-foreground">{r.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Tournament Preview */}
      <section id="live" className="py-20 bg-navy-deep/30">
        <div className="container mx-auto px-6">
          <div className="flex items-center gap-3 justify-center mb-8">
            <Radio size={20} className="text-success animate-pulse" />
            <h2 className="text-3xl font-display font-bold text-foreground">{kz.home.liveTournament}</h2>
          </div>
          <div className="max-w-4xl mx-auto card-premium p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-display font-semibold text-lg text-foreground">{demoTournaments[0].name}</h3>
                <p className="text-sm text-muted-foreground">{demoTournaments[0].location}</p>
              </div>
              <StatusBadge status="live" />
            </div>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-navy-surface rounded-lg p-4 text-center">
                <p className="text-2xl font-display font-bold text-foreground">{demoTournaments[0].participants}</p>
                <p className="text-xs text-muted-foreground">{kz.tournament.participants}</p>
              </div>
              <div className="bg-navy-surface rounded-lg p-4 text-center">
                <p className="text-2xl font-display font-bold text-primary">{demoTournaments[0].categories.length}</p>
                <p className="text-xs text-muted-foreground">{kz.tournament.categories}</p>
              </div>
              <div className="bg-navy-surface rounded-lg p-4 text-center">
                <p className="text-2xl font-display font-bold text-success">8</p>
                <p className="text-xs text-muted-foreground">{kz.dashboard.activeMatches}</p>
              </div>
            </div>
            <div className="flex justify-center">
              <Link to="/admin/tournaments"><Button variant="gold" className="gap-2">{kz.home.previewTitle} <ArrowRight size={16} /></Button></Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-3xl font-display font-bold text-foreground mb-4">{kz.home.ctaTitle}</h2>
          <Link to="/admin"><Button variant="gold" size="lg" className="gap-2">{kz.home.ctaButton} <ArrowRight size={16} /></Button></Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded gradient-gold flex items-center justify-center">
              <Trophy size={12} className="text-primary-foreground" />
            </div>
            <span className="font-display text-sm font-bold text-foreground">Judo-Arena</span>
          </div>
          <p className="text-xs text-muted-foreground">© 2025 Judo-Arena. Барлық құқықтар қорғалған.</p>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
