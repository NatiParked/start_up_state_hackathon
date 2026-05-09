// Founder's Navigator — Vue 3 app (CDN). State machine across screens.
// Keeps everything reactive; GSAP runs imperatively after mount/transition.

const { createApp, ref, computed, watch, nextTick, onMounted, reactive } = Vue;

// ---------- domain constants ----------
const STAGE_OPTIONS = [
  { id: 'pre',     title: 'Pre-revenue',   sub: 'Idea, prototype, or first build', detail: 'Validating, building, no paying customers yet.' },
  { id: 'early',   title: 'Early revenue', sub: 'First customers, hunting traction', detail: 'Have paying customers; figuring out what works.' },
  { id: 'scaling', title: 'Scaling',       sub: 'Repeatable revenue, growing team', detail: 'Predictable revenue, hiring, expanding.' },
  { id: 'est',     title: 'Established',   sub: 'Mature operations, broad needs', detail: 'Stable business looking to deepen or expand.' },
];
const INDUSTRY_OPTIONS = [
  { id: 'sw',     title: 'Software / IT',     sub: 'SaaS, AI, dev tools, infra', match: 'Software and Information Technology' },
  { id: 'health', title: 'Healthcare',        sub: 'Life sciences, medtech, care', match: 'Life Sciences and Healthcare' },
  { id: 'mfg',    title: 'Manufacturing',     sub: 'Hardware, industrial, defense', match: 'Manufacturing' },
  { id: 'ag',     title: 'Agriculture',       sub: 'Food, ag-tech, rural enterprise', match: 'Agriculture' },
  { id: 'hosp',   title: 'Hospitality / Food', sub: 'Restaurants, retail, services', match: 'Hospitality and Food Services' },
  { id: 'other',  title: 'Other',             sub: 'Something else, mixed, unsure', match: 'Other' },
];
const TOPIC_OPTIONS = [
  { id: 'fund',   title: 'Funding',           sub: 'Capital, grants, investment', match: 'Funding' },
  { id: 'talent', title: 'Talent & hiring',   sub: 'Workforce, recruiting, training', match: 'Late Stage Growth' },
  { id: 'comm',   title: 'Community',         sub: 'Network, mentors, peer founders', match: 'Entrepreneurship Communities' },
  { id: 'legal',  title: 'Legal & compliance', sub: 'Formation, IP, taxes', match: 'Taxes and Finance' },
  { id: 'mkt',    title: 'Marketing',         sub: 'Sales, brand, go-to-market', match: 'Marketing and Sales' },
];
const STAGE_TO_COMM = {
  pre:     ['Student', 'Rural', 'Multicultural', 'New American'],
  early:   ['Student', 'Multicultural', 'New American', 'Women'],
  scaling: ['Women', 'Veteran'],
  est:     ['*'],
};
const COUNTIES = [
  'Salt Lake','Utah','Davis','Weber','Cache','Washington','Summit','Tooele','Box Elder',
  'Iron','Sevier','Sanpete','Carbon','Uintah','Wasatch','San Juan','Grand','Juab','Garfield',
  'Kane','Beaver','Emery','Daggett','Duchesne','Millard','Morgan','Piute','Rich','Wayne'
];

// ---------- API service stub (swap to Supabase) ----------
// Centralized so back-end wiring is a one-file change.
const api = {
  _resources: null,
  async _load() {
    if (this._resources) return this._resources;
    const res = await fetch('src/data/resources.json');
    this._resources = await res.json();
    return this._resources;
  },
  async getResources() {
    return await this._load();
  },
  async getResourceById(id) {
    const all = await this._load();
    return all.find(r => String(r.id) === String(id));
  },
  async scoreQuiz({ stage, industry, topic, location }) {
    const all = await this._load();
    const indMatch = INDUSTRY_OPTIONS.find(o => o.id === industry)?.match;
    const topMatch = TOPIC_OPTIONS.find(o => o.id === topic)?.match;
    const commList = STAGE_TO_COMM[stage] || [];
    const isAny = commList.includes('*');
    const scored = all.map(r => {
      let score = 0;
      const reasons = [];
      if (indMatch && r.industries.includes(indMatch)) { score += 100; reasons.push(['Industry', indMatch]); }
      else if (industry === 'other' && r.industries.includes('Other')) { score += 50; reasons.push(['Industry', 'Other']); }
      if (topMatch && r.topics.includes(topMatch)) { score += 80; reasons.push(['Topic', topMatch]); }
      if (commList.length) {
        if (isAny || r.communities.length === 0) { score += 20; }
        else if (r.communities.some(c => commList.includes(c))) {
          score += 40; reasons.push(['Community', r.communities.find(c => commList.includes(c))]);
        }
      }
      if (location && r.locations.includes(location)) { score += 20; reasons.push(['County', location]); }
      if (r.communities.some(c => ['Women','Veteran','Multicultural','New American'].includes(c))) score += 5;
      return { ...r, score, reasons };
    }).filter(r => r.score > 0);
    scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
    return scored.slice(0, 24);
  },
  async submitProfile(payload) {
    // placeholder — Supabase insert goes here
    console.log('[stub] submitProfile', payload);
    await new Promise(r => setTimeout(r, 600));
    return { ok: true, id: 'stub-' + Date.now() };
  }
};

// ---------- Tweaks (persisted defaults block for host) ----------
const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "mint",
  "density": "editorial",
  "style": "editorial",
  "grid": true,
  "bgVariant": "navy"
}/*EDITMODE-END*/;

const ACCENTS = {
  mint:    { color: '#11DF81', soft: 'rgba(17,223,129,0.10)',  glow: 'rgba(17,223,129,0.45)' },
  cyan:    { color: '#5FE3FF', soft: 'rgba(95,227,255,0.10)',  glow: 'rgba(95,227,255,0.45)' },
  violet:  { color: '#A48BFF', soft: 'rgba(164,139,255,0.10)', glow: 'rgba(164,139,255,0.45)' },
  amber:   { color: '#F4A261', soft: 'rgba(244,162,97,0.10)',  glow: 'rgba(244,162,97,0.45)' },
  rose:    { color: '#FF6B8A', soft: 'rgba(255,107,138,0.10)', glow: 'rgba(255,107,138,0.45)' },
};
const BGS = {
  navy:    '#0D192D',
  abyss:   '#070D1A',
  graphite:'#15192A',
  charcoal:'#16181C',
};

// ---------- root app ----------
const App = {
  setup() {
    // navigation
    const screen = ref('landing'); // landing | quiz | results | detail | submit | about
    const goto = (s, opts={}) => {
      window.scrollTo({ top: 0, behavior: 'instant' });
      screen.value = s;
      if (opts.detailId !== undefined) detailId.value = opts.detailId;
    };

    // quiz state
    const quizStep = ref(0); // 0..3 (3 = location optional)
    const quiz = reactive({ stage: null, industry: null, topic: null, location: null });
    const quizSteps = [
      { key: 'stage',    title: 'What stage is your company?',           sub: 'This helps us personalize. There are no wrong answers.', options: STAGE_OPTIONS },
      { key: 'industry', title: 'What industry are you building in?',    sub: 'Pick the closest fit — we lean towards specificity.',    options: INDUSTRY_OPTIONS },
      { key: 'topic',    title: 'What do you need most right now?',      sub: 'One thing. We rank everything else around it.',          options: TOPIC_OPTIONS },
    ];
    const startQuiz = () => { Object.assign(quiz, { stage: null, industry: null, topic: null, location: null }); quizStep.value = 0; goto('quiz'); };
    const selectAnswer = (val) => {
      const k = quizSteps[quizStep.value].key;
      quiz[k] = val;
      // animated advance
      animateQuizAdvance(() => {
        if (quizStep.value < quizSteps.length - 1) quizStep.value++;
        else runResults();
      });
    };
    const skipStep = () => animateQuizAdvance(() => {
      if (quizStep.value < quizSteps.length - 1) quizStep.value++;
      else runResults();
    });
    const goBack = () => {
      if (quizStep.value > 0) {
        animateQuizAdvance(() => quizStep.value--, -1);
      } else {
        goto('landing');
      }
    };

    // results
    const results = ref([]);
    const loading = ref(false);
    const filterIndustry = ref(null);
    const filterTopic = ref(null);
    const filterStage = ref(null);
    const runResults = async () => {
      loading.value = true;
      goto('results');
      const r = await api.scoreQuiz({ ...quiz });
      results.value = r;
      filterIndustry.value = quiz.industry;
      filterTopic.value = quiz.topic;
      filterStage.value = quiz.stage;
      loading.value = false;
      await nextTick();
      animateResultsIn();
    };
    const visibleResults = computed(() => {
      let list = results.value;
      const ind = INDUSTRY_OPTIONS.find(o => o.id === filterIndustry.value)?.match;
      const top = TOPIC_OPTIONS.find(o => o.id === filterTopic.value)?.match;
      if (ind) list = list.filter(r => r.industries.includes(ind));
      if (top) list = list.filter(r => r.topics.includes(top));
      return list;
    });
    const maxScore = computed(() => Math.max(245, ...results.value.map(r => r.score)));

    // detail
    const detailId = ref(null);
    const detail = computed(() => results.value.find(r => String(r.id) === String(detailId.value))
                              || (detailId.value ? api._resources?.find(r => String(r.id) === String(detailId.value)) : null));
    const openDetail = (id) => { detailId.value = id; goto('detail'); };

    // submit form
    const form = reactive({
      name: '', website: '', founded: '',
      sector: '', employees: '', hiring: '', postings: '',
      description: '', linkedin: '', address: '',
      photoName: ''
    });
    const formErrors = reactive({});
    const toast = ref(null);
    const validate = () => {
      const errs = {};
      if (!form.name.trim()) errs.name = 'Required';
      if (!form.sector) errs.sector = 'Required';
      if (!form.description.trim()) errs.description = 'Required';
      else if (form.description.split(/\s+/).length > 150) errs.description = 'Keep it to 150 words';
      Object.keys(formErrors).forEach(k => delete formErrors[k]);
      Object.assign(formErrors, errs);
      return Object.keys(errs).length === 0;
    };
    const submitting = ref(false);
    const onSubmit = async () => {
      if (!validate()) return;
      submitting.value = true;
      const r = await api.submitProfile({ ...form });
      submitting.value = false;
      if (r.ok) {
        toast.value = `Thanks — your startup has been added to Utah's ecosystem.`;
        setTimeout(() => toast.value = null, 5000);
        Object.keys(form).forEach(k => form[k] = '');
        goto('landing');
      }
    };
    const onFile = (e) => {
      const f = e.target.files?.[0];
      form.photoName = f ? f.name : '';
    };

    // ---------- tweaks ----------
    const tweaks = reactive({ ...TWEAK_DEFAULTS });
    const tweaksOpen = ref(false);
    const tweaksAvailable = ref(false);
    const setTweak = (k, v) => {
      tweaks[k] = v;
      applyTweaks();
      window.parent?.postMessage({ type: '__edit_mode_set_keys', edits: { [k]: v } }, '*');
    };
    const applyTweaks = () => {
      const a = ACCENTS[tweaks.accent] || ACCENTS.mint;
      document.documentElement.style.setProperty('--accent', a.color);
      document.documentElement.style.setProperty('--accent-soft', a.soft);
      document.documentElement.style.setProperty('--accent-glow',
        `0 0 0 1px ${a.color}59, 0 8px 40px -8px ${a.glow}`);
      document.documentElement.style.setProperty('--bg', BGS[tweaks.bgVariant] || BGS.navy);
      document.body.classList.toggle('density-compact', tweaks.density === 'compact');
      document.body.classList.toggle('style-minimal', tweaks.style === 'minimal');
      document.querySelector('.paper')?.classList.toggle('no-grain', !tweaks.grid);
    };

    onMounted(() => {
      applyTweaks();
      window.addEventListener('message', (e) => {
        if (e.data?.type === '__activate_edit_mode') tweaksOpen.value = true;
        if (e.data?.type === '__deactivate_edit_mode') tweaksOpen.value = false;
      });
      tweaksAvailable.value = true;
      window.parent?.postMessage({ type: '__edit_mode_available' }, '*');
      // Defer one frame so Vue's render is committed before GSAP queries elements.
      requestAnimationFrame(() => {
        try { animateLandingIn(); } catch (e) { console.warn('anim failed (safe to ignore)', e); }
      });
    });
    const closeTweaks = () => {
      tweaksOpen.value = false;
      window.parent?.postMessage({ type: '__edit_mode_dismissed' }, '*');
    };

    // ---------- animations ----------
    function animateLandingIn() {
      // Set hidden states in JS so content is visible if GSAP/JS ever fails.
      gsap.set('[data-anim="kicker"], [data-anim="lede"], [data-anim="cta"], [data-anim="meta"]', { opacity: 0, y: 14 });
      gsap.set('[data-anim="word"]', { yPercent: 110 });
      const tl = gsap.timeline();
      tl.to('[data-anim="kicker"]', { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' })
        .to('[data-anim="word"]',   { yPercent: 0, duration: 0.85, ease: 'power3.out', stagger: 0.06 }, '-=0.2')
        .to('[data-anim="lede"]',   { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.4')
        .to('[data-anim="cta"]',    { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.08 }, '-=0.3')
        .to('[data-anim="meta"]',   { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }, '-=0.3');
    }
    function animateQuizAdvance(then, dir = 1) {
      const card = document.querySelector('[data-anim="quiz-card"]');
      if (!card) { then(); return; }
      gsap.to(card, {
        opacity: 0, y: dir > 0 ? -16 : 16, duration: 0.22, ease: 'power2.in',
        onComplete: async () => {
          then();
          await nextTick();
          gsap.fromTo('[data-anim="quiz-card"]',
            { opacity: 0, y: dir > 0 ? 24 : -24 },
            { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' });
          gsap.fromTo('[data-anim="quiz-opt"]',
            { opacity: 0, y: 14 },
            { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', stagger: 0.05, delay: 0.1 });
        }
      });
    }
    function animateResultsIn() {
      gsap.fromTo('[data-anim="result-row"]',
        { opacity: 0, y: 18 },
        { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out', stagger: 0.04 });
      gsap.fromTo('[data-anim="results-head"] > *',
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.05 });
    }

    // helpers
    const heroWords = computed(() => 'Find what Utah\u2019s ecosystem already built for you.'.split(' '));

    return {
      screen, goto,
      quizStep, quiz, quizSteps, startQuiz, selectAnswer, skipStep, goBack,
      results, loading, runResults, visibleResults, maxScore,
      filterIndustry, filterTopic, filterStage,
      INDUSTRY_OPTIONS, TOPIC_OPTIONS, STAGE_OPTIONS, COUNTIES,
      detailId, detail, openDetail,
      form, formErrors, submitting, onSubmit, onFile, toast,
      tweaks, tweaksOpen, tweaksAvailable, setTweak, closeTweaks,
      ACCENTS,
      heroWords,
    };
  },
  template: `<div class="paper min-h-screen flex flex-col" data-screen-label="Founders Navigator">
    <!-- TOP NAV -->
    <header class="topnav" data-screen-label="Top nav">
      <button @click="goto('landing')" class="brand-mark" aria-label="Founder's Navigator home">
        <span>Founder<span style="color:#11DF81">'</span>s <span style="color:#0cb76a">Navigator</span></span>
      </button>
      <nav class="flex items-center gap-7">
        <button @click="goto('landing')">Home</button>
        <button @click="startQuiz()">Find resources</button>
        <button @click="goto('submit')">Add a startup</button>
        <span class="hidden md:inline-block divider-tall" style="height:14px"></span>
        <a href="https://startup.utah.gov" target="_blank" rel="noopener" class="hidden md:inline-flex items-center logo-chip" aria-label="Startup State">
          <img src="assets/startup-state-logo.jpg" alt="Startup State" />
        </a>
      </nav>
    </header>

    <!-- LANDING -->
    <section v-if="screen === 'landing'" class="flex-1" data-screen-label="01 Landing">
      <div class="layout-edge">
        <!-- left: hero -->
        <div class="px-[var(--pad)] pt-[clamp(2.5rem,6vw,6rem)] pb-12 flex flex-col">
          <div class="idx fade-up" data-anim="kicker">— 01 / Founders</div>

          <h1 class="display mt-8">
            <template v-for="(w, i) in heroWords" :key="i">
              <span class="word-mask"><span data-anim="word" :style="w === 'built' ? 'color:#0cb76a' : ''">{{ w }}<template v-if="i < heroWords.length - 1">&nbsp;</template></span></span>
            </template>
          </h1>

          <p class="lede mt-10 fade-up" data-anim="lede">
            Three short questions. A ranked list of the funding, mentorship, talent, and
            community resources Utah has waiting for you. Built for founders at any stage.
          </p>

          <div class="flex flex-wrap items-center gap-4 mt-12">
            <button class="btn btn-primary fade-up" data-anim="cta" @click="startQuiz()">
              Begin guided quiz <span class="arrow">\u2192</span>
            </button>
            <button class="btn btn-ghost fade-up" data-anim="cta" @click="runAll()">
              Browse all resources
            </button>
            <span class="status-pill fade-up" data-anim="cta" style="margin-left:auto;"><span class="pulse"></span>v1.0 \u00b7 213 indexed</span>
          </div>

          <div class="mt-auto pt-16">
            <hr class="hr-thin" />
            <div class="grid grid-cols-3 gap-3 pt-6 fade-up" data-anim="meta">
              <div class="metric">
                <div class="lbl">Resources</div>
                <div class="num mt-1">213</div>
              </div>
              <div class="metric">
                <div class="lbl">Counties</div>
                <div class="num mt-1">29</div>
              </div>
              <div class="metric">
                <div class="lbl">Avg. time</div>
                <div class="num mt-1">~2m</div>
              </div>
            </div>
          </div>
        </div>

        <!-- right: side panel -->
        <aside class="hidden md:flex flex-col border-l border-[var(--hair)]"
               style="background: linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0));">
          <div class="px-[var(--pad)] pt-[clamp(2.5rem,6vw,6rem)] pb-10 fade-up" data-anim="meta">
            <div class="flex items-center justify-between mb-6">
              <div class="kicker kicker-ink">— 02 / Protocol</div>
              <span class="status-pill"><span class="pulse"></span>Live</span>
            </div>
            <ol class="mt-8 flex flex-col">
              <li class="py-5 border-b border-[var(--hair)]">
                <div class="flex items-baseline gap-5">
                  <span class="foot-mark">01</span>
                  <div>
                    <div class="display-sm">Tell us your stage</div>
                    <div class="lede mt-1" style="font-size:14px">Pre-revenue, early, scaling, or established.</div>
                  </div>
                </div>
              </li>
              <li class="py-5 border-b border-[var(--hair)]">
                <div class="flex items-baseline gap-5">
                  <span class="foot-mark">02</span>
                  <div>
                    <div class="display-sm">Pick an industry</div>
                    <div class="lede mt-1" style="font-size:14px">Software, healthcare, manufacturing, agriculture, hospitality.</div>
                  </div>
                </div>
              </li>
              <li class="py-5 border-b border-[var(--hair)]">
                <div class="flex items-baseline gap-5">
                  <span class="foot-mark">03</span>
                  <div>
                    <div class="display-sm">Name what you need</div>
                    <div class="lede mt-1" style="font-size:14px">Funding, talent, community, legal, or marketing.</div>
                  </div>
                </div>
              </li>
              <li class="py-5">
                <div class="flex items-baseline gap-5">
                  <span class="foot-mark">04</span>
                  <div>
                    <div class="display-sm">Get your matches</div>
                    <div class="lede mt-1" style="font-size:14px">Ranked, filterable, and sourced from across the state.</div>
                  </div>
                </div>
              </li>
            </ol>
          </div>

          <div class="mt-auto px-[var(--pad)] pb-8">
            <hr class="hr-thin mb-6" />
            <div class="flex items-baseline justify-between">
              <div class="kicker">Featured cohort</div>
              <div class="foot-mark">Spring '26</div>
            </div>
            <p class="serif-italic mt-4" style="font-size:1.1rem; line-height:1.45;">
              \u201CFor every founder we met in the Uintah Basin, three more were already
              quietly shipping. The map is bigger than you think.\u201D
            </p>
            <div class="mt-3 kicker">— Drew T., Field notes</div>
          </div>
        </aside>
      </div>
    </section>

    <!-- QUIZ -->
    <section v-else-if="screen === 'quiz'" class="flex-1 flex flex-col" data-screen-label="02 Quiz">
      <!-- progress -->
      <div class="px-[var(--pad)] pt-6">
        <div class="flex items-center justify-between mb-3">
          <button class="btn-text" @click="goBack()">\u2190 Back</button>
          <div class="kicker">Question {{ quizStep + 1 }} / {{ quizSteps.length }}</div>
        </div>
        <div class="progress-rail" :style="{ '--p': ((quizStep+1) / quizSteps.length * 100) + '%' }"></div>
      </div>

      <div class="stage" data-anim="quiz-card">
        <div class="max-w-[1100px] mx-auto w-full">
          <div class="idx mb-6">— 0{{ quizStep + 1 }} / {{ quizSteps[quizStep].key }}</div>
          <h2 class="display-md max-w-[18ch]">{{ quizSteps[quizStep].title }}</h2>
          <p class="lede mt-4">{{ quizSteps[quizStep].sub }}</p>

          <div class="grid sm:grid-cols-2 gap-4 mt-12">
            <button v-for="(o, i) in quizSteps[quizStep].options" :key="o.id"
                    data-anim="quiz-opt"
                    class="opt"
                    :class="{ 'is-selected': quiz[quizSteps[quizStep].key] === o.id }"
                    @click="selectAnswer(o.id)">
              <div class="flex items-baseline justify-between">
                <span class="opt-num">{{ String(i + 1).padStart(2, '0') }}</span>
                <span class="opt-num arrow">\u2192</span>
              </div>
              <div class="opt-title">{{ o.title }}</div>
              <div class="opt-sub">{{ o.sub }}</div>
            </button>
          </div>

          <div class="mt-10 flex items-center justify-between">
            <button class="btn-text" @click="skipStep()">Skip this question</button>
            <div class="foot-mark hidden md:flex items-center gap-3">
              <span class="dot"></span> Smooth transition powered by GSAP
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- RESULTS -->
    <section v-else-if="screen === 'results'" class="flex-1" data-screen-label="03 Results">
      <div class="px-[var(--pad)] pt-10 pb-6" data-anim="results-head">
        <div class="idx">— 03 / Matches</div>
        <h2 class="display-md mt-6 max-w-[20ch]">
          {{ visibleResults.length }} resources, ranked for you.
        </h2>
        <p class="lede mt-3">
          Based on
          <span v-if="quiz.stage" class="serif-italic">{{ STAGE_OPTIONS.find(s=>s.id===quiz.stage)?.title.toLowerCase() }}</span>
          <span v-if="quiz.industry"> in <span class="serif-italic">{{ INDUSTRY_OPTIONS.find(s=>s.id===quiz.industry)?.title.toLowerCase() }}</span></span>
          <span v-if="quiz.topic"> looking for <span class="serif-italic">{{ TOPIC_OPTIONS.find(s=>s.id===quiz.topic)?.title.toLowerCase() }}</span></span>.
          Refine below.
        </p>

        <!-- filter chips -->
        <div class="mt-8 flex flex-wrap items-center gap-2">
          <span class="kicker mr-3">Filter</span>
          <button class="chip" :class="{ 'is-active': !filterStage }" @click="filterStage = null">All stages</button>
          <button v-for="s in STAGE_OPTIONS" :key="s.id"
                  class="chip" :class="{ 'is-active': filterStage === s.id }"
                  @click="filterStage = filterStage === s.id ? null : s.id">{{ s.title }}</button>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <span class="kicker mr-3 invisible md:visible">Industry</span>
          <button class="chip" :class="{ 'is-active': !filterIndustry }" @click="filterIndustry = null">All industries</button>
          <button v-for="o in INDUSTRY_OPTIONS" :key="o.id"
                  class="chip" :class="{ 'is-active': filterIndustry === o.id }"
                  @click="filterIndustry = filterIndustry === o.id ? null : o.id">{{ o.title }}</button>
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <span class="kicker mr-3 invisible md:visible">Need</span>
          <button class="chip" :class="{ 'is-active': !filterTopic }" @click="filterTopic = null">All needs</button>
          <button v-for="o in TOPIC_OPTIONS" :key="o.id"
                  class="chip" :class="{ 'is-active': filterTopic === o.id }"
                  @click="filterTopic = filterTopic === o.id ? null : o.id">{{ o.title }}</button>
          <span class="ml-auto kicker">Sorted by match</span>
        </div>

        <hr class="hr-thin mt-6" />
      </div>

      <!-- ranked list -->
      <div class="px-[var(--pad)] pb-24">
        <div v-if="loading" class="py-20 text-center kicker">Loading\u2026</div>
        <ul v-else class="flex flex-col">
          <li v-for="(r, i) in visibleResults" :key="r.id"
              data-anim="result-row"
              class="result-row group cursor-pointer border-b border-[var(--hair)] py-7 grid grid-cols-12 gap-6 items-baseline"
              @click="openDetail(r.id)">
            <div class="col-span-1 foot-mark pt-2">{{ String(i + 1).padStart(2, '0') }}</div>
            <div class="col-span-11 md:col-span-7">
              <div class="flex flex-wrap items-center gap-2 mb-2">
                <span v-for="t in r.topics.slice(0, 2)" :key="t"
                      class="badge-cat"
                      :class="t === 'Funding' ? 'accent' : ''">
                  {{ t }}
                </span>
                <span v-if="r.communities[0]" class="badge-cat outline">{{ r.communities[0] }}</span>
              </div>
              <h3 class="display-sm group-hover:underline" style="text-decoration-thickness:1px; text-underline-offset:6px;">
                {{ r.title }}
              </h3>
              <p class="mt-2 text-[15px] leading-[1.6]" style="color:var(--fg-2); max-width: 70ch;">
                {{ truncate(r.description, 200) }}
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <span v-for="loc in r.locations.slice(0, 4)" :key="loc" class="county-tag">{{ loc }}</span>
                <span v-if="r.locations.length > 4" class="county-tag">+{{ r.locations.length - 4 }}</span>
              </div>
            </div>
            <div class="hidden md:flex col-span-4 flex-col items-end gap-2 pt-2">
              <div class="score">
                <span>match</span>
                <span class="bar" :style="{ '--w': Math.min(100, (r.score / maxScore) * 100) + '%' }"></span>
                <span style="color:var(--fg); font-weight:600;">{{ r.score }}</span>
              </div>
              <div class="kicker">{{ r.reasons?.[0]?.[0] || 'Broad match' }}</div>
              <button class="btn btn-text" @click.stop="openDetail(r.id)">View detail <span class="arrow">\u2192</span></button>
            </div>
          </li>
          <li v-if="visibleResults.length === 0" class="py-20 text-center">
            <div class="display-sm">No matches with current filters.</div>
            <button class="btn btn-text mt-4" @click="filterIndustry=null; filterTopic=null; filterStage=null;">Clear filters</button>
          </li>
        </ul>
      </div>
    </section>

    <!-- DETAIL -->
    <section v-else-if="screen === 'detail'" class="flex-1" data-screen-label="04 Resource detail">
      <div class="px-[var(--pad)] pt-6">
        <button class="btn-text" @click="goto('results')">\u2190 Back to results</button>
      </div>
      <article v-if="detail" class="px-[var(--pad)] pt-10 pb-24 max-w-[860px] mx-auto detail-shell">
        <div class="flex items-center gap-3 mb-6">
          <span class="accent-bar" style="height:36px; width:3px;"></span>
          <div class="kicker">— Resource / #{{ detail.id }}</div>
        </div>
        <h2 class="display-md max-w-[24ch]">{{ detail.title }}</h2>
        <div class="mt-6 flex flex-wrap gap-2">
          <span v-for="t in detail.topics" :key="t" class="badge-cat">{{ t }}</span>
          <span v-for="c in detail.communities" :key="c" class="badge-cat outline">{{ c }}</span>
        </div>

        <hr class="hr-thin my-10" />

        <p class="text-[17px] leading-[1.85]" style="color:var(--fg); max-width:62ch;">
          {{ detail.description }}
        </p>

        <div class="mt-12 grid md:grid-cols-2 gap-8">
          <div>
            <div class="kicker mb-3">Industries served</div>
            <ul class="flex flex-wrap gap-2">
              <li v-for="i in detail.industries" :key="i" class="county-tag">{{ i }}</li>
            </ul>
          </div>
          <div>
            <div class="kicker mb-3">Counties</div>
            <ul class="flex flex-wrap gap-2">
              <li v-for="l in detail.locations" :key="l" class="county-tag">{{ l }}</li>
            </ul>
          </div>
        </div>

        <hr class="hr-thin my-10" />

        <div class="flex flex-wrap gap-4 items-center">
          <a v-if="detail.link" :href="detail.link" target="_blank" rel="noopener" class="btn btn-accent">
            Visit website <span class="arrow">\u2197</span>
          </a>
          <a v-if="detail.email" :href="'mailto:' + detail.email" class="btn btn-ghost">
            Email {{ detail.email }}
          </a>
          <button class="btn-text ml-auto" @click="copyShare()">Copy share link</button>
        </div>
      </article>
    </section>

    <!-- SUBMIT FORM -->
    <section v-else-if="screen === 'submit'" class="flex-1" data-screen-label="05 Submit profile">
      <div class="px-[var(--pad)] pt-12 pb-24 max-w-[920px] mx-auto">
        <div class="idx">— 05 / Add a startup</div>
        <h2 class="display-md mt-6 max-w-[20ch]">Add your startup to Utah's ecosystem.</h2>
        <p class="lede mt-3">
          Eleven fields, four short groups. Required marked with <span class="req serif-italic">*</span>.
          We'll review and publish within 48 hours.
        </p>

        <form class="mt-12 flex flex-col gap-6" @submit.prevent="onSubmit()">
          <!-- group: basics -->
          <div class="form-section">
            <div class="kicker mb-6">Group 01 — Basics</div>
            <div class="grid md:grid-cols-2 gap-5">
              <div>
                <label class="field-label">Startup name <span class="req serif-italic">*</span></label>
                <input class="input" v-model="form.name" placeholder="e.g. Cedar Logic" />
                <div v-if="formErrors.name" class="field-hint" style="color:var(--accent)">{{ formErrors.name }}</div>
              </div>
              <div>
                <label class="field-label">Website</label>
                <input class="input" v-model="form.website" placeholder="https://" />
              </div>
              <div>
                <label class="field-label">Year founded</label>
                <input class="input" type="number" v-model="form.founded" placeholder="2024" />
              </div>
            </div>
          </div>

          <!-- group: business -->
          <div class="form-section">
            <div class="kicker mb-6">Group 02 — Business info</div>
            <div class="grid md:grid-cols-2 gap-5">
              <div>
                <label class="field-label">Sector / Industry <span class="req serif-italic">*</span></label>
                <select class="select" v-model="form.sector">
                  <option value="">Select one</option>
                  <option v-for="o in INDUSTRY_OPTIONS" :key="o.id" :value="o.match">{{ o.title }}</option>
                </select>
                <div v-if="formErrors.sector" class="field-hint" style="color:var(--accent)">{{ formErrors.sector }}</div>
              </div>
              <div>
                <label class="field-label">Employees</label>
                <input class="input" type="number" v-model="form.employees" placeholder="1\u201310" />
              </div>
              <div>
                <label class="field-label">Hiring status</label>
                <div class="flex gap-3">
                  <label v-for="opt in ['Yes','No','Maybe']" :key="opt"
                         class="chip cursor-pointer" :class="{ 'is-active': form.hiring === opt }">
                    <input type="radio" v-model="form.hiring" :value="opt" class="hidden" />{{ opt }}
                  </label>
                </div>
              </div>
              <div>
                <label class="field-label">Open job postings</label>
                <textarea class="textarea" v-model="form.postings" placeholder="One per line\u2014link if you have it." style="min-height:96px;"></textarea>
              </div>
            </div>
          </div>

          <!-- group: marketing -->
          <div class="form-section">
            <div class="kicker mb-6">Group 03 — Marketing</div>
            <div>
              <label class="field-label">Description <span class="req serif-italic">*</span> <span class="foot-mark ml-2">150 words max</span></label>
              <textarea class="textarea" v-model="form.description" placeholder="What you do, who it's for, why it matters."></textarea>
              <div v-if="formErrors.description" class="field-hint" style="color:var(--accent)">{{ formErrors.description }}</div>
            </div>
            <div class="grid md:grid-cols-2 gap-5 mt-5">
              <div>
                <label class="field-label">LinkedIn profile</label>
                <input class="input" v-model="form.linkedin" placeholder="https://linkedin.com/company/\u2026" />
              </div>
              <div>
                <label class="field-label">Address</label>
                <input class="input" v-model="form.address" placeholder="City, county, ZIP" />
              </div>
            </div>
          </div>

          <!-- group: media -->
          <div class="form-section">
            <div class="kicker mb-6">Group 04 — Media</div>
            <label class="field-label">Photo or logo (jpg, png, webp)</label>
            <label class="opt cursor-pointer text-center" style="border-style:dashed;">
              <span class="opt-num">Drag &amp; drop</span>
              <span class="opt-title" style="font-size:1.25rem;">{{ form.photoName || 'Choose a file' }}</span>
              <span class="opt-sub">Square images look best in resource cards.</span>
              <input type="file" accept="image/*" class="hidden" @change="onFile" />
            </label>
          </div>

          <div class="flex items-center justify-end gap-4 pt-4">
            <button type="button" class="btn-text" @click="goto('landing')">Cancel</button>
            <button type="submit" class="btn btn-accent" :disabled="submitting">
              <span v-if="!submitting">Add my startup <span class="arrow">\u2192</span></span>
              <span v-else>Submitting\u2026</span>
            </button>
          </div>
        </form>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="px-[var(--pad)] py-10 border-t border-[var(--hair)] flex flex-col gap-8">
      <div class="flex flex-wrap items-center justify-between gap-6">
        <div class="flex items-center gap-4">
          <a href="https://goeo.utah.gov" target="_blank" rel="noopener" class="logo-chip logo-chip-lg" aria-label="Governor's Office of Economic Opportunity">
            <img src="assets/goeo-logo.webp" alt="GOEO" />
          </a>
          <a href="https://startup.utah.gov" target="_blank" rel="noopener" class="logo-chip logo-chip-lg" aria-label="Startup State">
            <img src="assets/startup-state-logo.jpg" alt="Startup State" />
          </a>
        </div>
        <div class="brand-mark"><span>Founder<span style="color:#11DF81">'</span>s <span style="color:#0cb76a">Navigator</span></span></div>
      </div>
      <hr class="hr-thin" />
      <div class="flex flex-wrap items-baseline justify-between gap-4">
        <div class="foot-mark">A project of GOEO \u2014 Utah's Office of Economic Opportunity</div>
        <div class="foot-mark">Built for builders. {{ new Date().getFullYear() }}.</div>
      </div>
    </footer>

    <!-- TWEAKS PANEL -->
    <div v-if="tweaksOpen" class="tweaks">
      <div class="tweaks-head">
        <span class="tt">Tweaks</span>
        <button class="tweaks-close" @click="closeTweaks()" aria-label="Close">\u00d7</button>
      </div>
      <div class="tweaks-body">
        <div class="tweak-row">
          <label class="field-label">Accent</label>
          <div class="swatches">
            <button v-for="(v,k) in ACCENTS" :key="k"
                    class="sw" :class="{ 'is-on': tweaks.accent === k }"
                    :style="{ background: v.color }"
                    @click="setTweak('accent', k)" :aria-label="k"></button>
          </div>
        </div>
        <div class="tweak-row">
          <label class="field-label">Background</label>
          <div class="seg">
            <button v-for="b in ['navy','abyss','graphite','charcoal']" :key="b"
                    :class="{ 'is-on': tweaks.bgVariant === b }"
                    @click="setTweak('bgVariant', b)">{{ b }}</button>
          </div>
        </div>
        <div class="tweak-row">
          <label class="field-label">Density</label>
          <div class="seg">
            <button v-for="d in ['editorial','compact']" :key="d"
                    :class="{ 'is-on': tweaks.density === d }"
                    @click="setTweak('density', d)">{{ d }}</button>
          </div>
        </div>
        <div class="tweak-row">
          <label class="field-label">Style</label>
          <div class="seg">
            <button v-for="s in ['editorial','minimal']" :key="s"
                    :class="{ 'is-on': tweaks.style === s }"
                    @click="setTweak('style', s)">{{ s }}</button>
          </div>
        </div>
        <div class="tweak-row" style="flex-direction:row; align-items:center; justify-content:space-between;">
          <label class="field-label" style="margin:0">Grid overlay</label>
          <button class="tg" :class="{ 'is-on': tweaks.grid }" @click="setTweak('grid', !tweaks.grid)" aria-label="Toggle grid overlay"></button>
        </div>
      </div>
    </div>

    <!-- TOAST -->
    <transition name="fade">
      <div v-if="toast" class="toast">
        <span class="dot" style="background:var(--accent)"></span>
        {{ toast }}
      </div>
    </transition>
  </div>`,
  methods: {
    truncate(s, n) {
      if (!s) return '';
      if (s.length <= n) return s;
      const cut = s.slice(0, n);
      return cut.slice(0, cut.lastIndexOf(' ')) + '\u2026';
    },
    async runAll() {
      this.loading = true;
      this.goto('results');
      const r = await api.getResources();
      // emulate scoring layer with neutral score so list renders
      this.results = r.map(x => ({ ...x, score: 0, reasons: [] })).sort((a,b)=>a.title.localeCompare(b.title)).slice(0, 60);
      this.filterIndustry = null; this.filterTopic = null; this.filterStage = null;
      this.loading = false;
      await this.$nextTick();
      gsap.fromTo('[data-anim="result-row"]', { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out', stagger: 0.03 });
    },
    copyShare() {
      navigator.clipboard?.writeText(window.location.href);
      this.toast = 'Link copied.';
      setTimeout(() => this.toast = null, 2500);
    },
  }
};

createApp(App).mount('#app');
