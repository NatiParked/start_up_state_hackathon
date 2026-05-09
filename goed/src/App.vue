<script setup></script>

<template>
  <div class="h-screen flex flex-col overflow-hidden">
    <header class="topnav shrink-0">
      <RouterLink to="/" class="brand-link flex items-center gap-4 shrink-0 no-underline">
        <span class="brand-utah">Utah</span>
        <img
          src="/logos/startup-state.svg"
          alt="Startup State"
          class="brand-logo h-8 w-auto"
        />
        <span class="brand-divider"></span>
        <img
          src="/logos/goeo.webp"
          alt="Governor's Office of Economic Opportunity"
          class="brand-logo h-8 w-auto"
        />
      </RouterLink>
      <nav class="flex items-center gap-6">
        <RouterLink to="/">Startup Map</RouterLink>
        <a href="https://foundersjourney2.netlify.app/" target="_blank" rel="noopener noreferrer">Founder's Navigator</a>
        <RouterLink to="/admin">Admin</RouterLink>
        <RouterLink to="/roadmap">Roadmap</RouterLink>
        <RouterLink to="/subscribe">Subscribe</RouterLink>
      </nav>
    </header>
    <main class="flex-1 min-h-0 flex flex-col overflow-y-auto overflow-x-hidden">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.topnav :deep(a.router-link-exact-active:not(.brand-link)) {
  border-bottom-color: var(--accent);
  color: var(--fg);
}
.topnav :deep(a.brand-link),
.topnav :deep(a.brand-link:hover) {
  border-bottom-color: transparent;
}
.brand-utah {
  font-family: var(--display);
  font-weight: 700;
  font-size: 36px;
  line-height: 1;
  letter-spacing: -0.03em;
  color: var(--fg);
}
.brand-logo {
  display: block;
  object-fit: contain;
}
.brand-divider {
  display: inline-block;
  width: 1px;
  height: 22px;
  background: var(--hair-2);
}
</style>
