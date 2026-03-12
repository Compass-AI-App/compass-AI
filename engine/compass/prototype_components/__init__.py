"""Pre-built HTML component snippets for prototype composition.

Each component is a self-contained Tailwind CSS snippet that can be
referenced by name in prototype descriptions or browsed in the UI.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ComponentSnippet:
    id: str
    name: str
    category: str
    description: str
    html: str


COMPONENTS: list[ComponentSnippet] = [
    ComponentSnippet(
        id="hero-centered",
        name="Hero (Centered)",
        category="hero",
        description="Centered hero section with headline, subheadline, and CTA buttons",
        html="""<section class="bg-gradient-to-br from-indigo-600 to-purple-700 text-white py-24 px-6">
  <div class="max-w-4xl mx-auto text-center">
    <h1 class="text-5xl font-bold mb-6">Your Headline Here</h1>
    <p class="text-xl text-indigo-100 mb-8 max-w-2xl mx-auto">A compelling subheadline that explains the value proposition in one or two sentences.</p>
    <div class="flex gap-4 justify-center">
      <a href="#" class="px-8 py-3 bg-white text-indigo-700 rounded-lg font-semibold hover:bg-indigo-50 transition">Get Started</a>
      <a href="#" class="px-8 py-3 border-2 border-white/30 rounded-lg font-semibold hover:bg-white/10 transition">Learn More</a>
    </div>
  </div>
</section>""",
    ),
    ComponentSnippet(
        id="feature-grid-3col",
        name="Feature Grid (3 Column)",
        category="features",
        description="Three-column feature grid with icons and descriptions",
        html="""<section class="py-20 px-6 bg-white">
  <div class="max-w-6xl mx-auto">
    <h2 class="text-3xl font-bold text-center text-slate-900 mb-4">Key Features</h2>
    <p class="text-slate-500 text-center mb-12 max-w-2xl mx-auto">Everything you need to succeed, all in one place.</p>
    <div class="grid md:grid-cols-3 gap-8">
      <div class="p-6 rounded-xl border border-slate-200 hover:shadow-lg transition">
        <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4"><span class="text-2xl">⚡</span></div>
        <h3 class="text-lg font-semibold text-slate-900 mb-2">Feature One</h3>
        <p class="text-slate-500">Brief description of this feature and why it matters to users.</p>
      </div>
      <div class="p-6 rounded-xl border border-slate-200 hover:shadow-lg transition">
        <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4"><span class="text-2xl">🎯</span></div>
        <h3 class="text-lg font-semibold text-slate-900 mb-2">Feature Two</h3>
        <p class="text-slate-500">Brief description of this feature and why it matters to users.</p>
      </div>
      <div class="p-6 rounded-xl border border-slate-200 hover:shadow-lg transition">
        <div class="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center mb-4"><span class="text-2xl">🚀</span></div>
        <h3 class="text-lg font-semibold text-slate-900 mb-2">Feature Three</h3>
        <p class="text-slate-500">Brief description of this feature and why it matters to users.</p>
      </div>
    </div>
  </div>
</section>""",
    ),
    ComponentSnippet(
        id="pricing-3tier",
        name="Pricing (3 Tiers)",
        category="pricing",
        description="Three-tier pricing cards with highlighted recommended plan",
        html="""<section class="py-20 px-6 bg-slate-50">
  <div class="max-w-5xl mx-auto">
    <h2 class="text-3xl font-bold text-center text-slate-900 mb-12">Simple, Transparent Pricing</h2>
    <div class="grid md:grid-cols-3 gap-8">
      <div class="bg-white rounded-2xl p-8 border border-slate-200">
        <h3 class="text-lg font-semibold text-slate-900">Starter</h3>
        <div class="mt-4 mb-6"><span class="text-4xl font-bold text-slate-900">$9</span><span class="text-slate-500">/month</span></div>
        <ul class="space-y-3 mb-8 text-slate-600 text-sm">
          <li>✓ Up to 5 projects</li><li>✓ Basic analytics</li><li>✓ Email support</li>
        </ul>
        <a href="#" class="block text-center py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition font-medium">Get Started</a>
      </div>
      <div class="bg-indigo-600 rounded-2xl p-8 text-white ring-2 ring-indigo-600 ring-offset-2 scale-105">
        <div class="flex justify-between items-center"><h3 class="text-lg font-semibold">Pro</h3><span class="text-xs bg-indigo-500 px-2 py-1 rounded-full">Popular</span></div>
        <div class="mt-4 mb-6"><span class="text-4xl font-bold">$29</span><span class="text-indigo-200">/month</span></div>
        <ul class="space-y-3 mb-8 text-indigo-100 text-sm">
          <li>✓ Unlimited projects</li><li>✓ Advanced analytics</li><li>✓ Priority support</li><li>✓ API access</li>
        </ul>
        <a href="#" class="block text-center py-2.5 bg-white text-indigo-700 rounded-lg hover:bg-indigo-50 transition font-semibold">Get Started</a>
      </div>
      <div class="bg-white rounded-2xl p-8 border border-slate-200">
        <h3 class="text-lg font-semibold text-slate-900">Enterprise</h3>
        <div class="mt-4 mb-6"><span class="text-4xl font-bold text-slate-900">Custom</span></div>
        <ul class="space-y-3 mb-8 text-slate-600 text-sm">
          <li>✓ Everything in Pro</li><li>✓ SSO & SAML</li><li>✓ Dedicated support</li><li>✓ SLA guarantee</li>
        </ul>
        <a href="#" class="block text-center py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition font-medium">Contact Sales</a>
      </div>
    </div>
  </div>
</section>""",
    ),
    ComponentSnippet(
        id="testimonials-cards",
        name="Testimonials (Cards)",
        category="testimonials",
        description="Customer testimonial cards with avatars and quotes",
        html="""<section class="py-20 px-6 bg-white">
  <div class="max-w-6xl mx-auto">
    <h2 class="text-3xl font-bold text-center text-slate-900 mb-12">What Our Customers Say</h2>
    <div class="grid md:grid-cols-3 gap-8">
      <div class="bg-slate-50 rounded-xl p-6">
        <p class="text-slate-600 mb-4">"This product has completely transformed how our team works. Incredible results in just weeks."</p>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-indigo-200 rounded-full flex items-center justify-center text-indigo-700 font-semibold">JD</div>
          <div><p class="font-medium text-slate-900 text-sm">Jane Doe</p><p class="text-xs text-slate-500">VP of Product, Acme Inc</p></div>
        </div>
      </div>
      <div class="bg-slate-50 rounded-xl p-6">
        <p class="text-slate-600 mb-4">"The best investment we've made this year. ROI was visible within the first month."</p>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-emerald-200 rounded-full flex items-center justify-center text-emerald-700 font-semibold">AS</div>
          <div><p class="font-medium text-slate-900 text-sm">Alex Smith</p><p class="text-xs text-slate-500">CEO, StartupCo</p></div>
        </div>
      </div>
      <div class="bg-slate-50 rounded-xl p-6">
        <p class="text-slate-600 mb-4">"Easy to use, powerful features, and excellent support. Exactly what we needed."</p>
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-amber-200 rounded-full flex items-center justify-center text-amber-700 font-semibold">MK</div>
          <div><p class="font-medium text-slate-900 text-sm">Maria Kim</p><p class="text-xs text-slate-500">Director of Eng, BigCorp</p></div>
        </div>
      </div>
    </div>
  </div>
</section>""",
    ),
    ComponentSnippet(
        id="signup-form",
        name="Signup Form",
        category="forms",
        description="Clean signup form with email, password, and social login options",
        html="""<section class="min-h-screen flex items-center justify-center bg-slate-50 px-6">
  <div class="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
    <h2 class="text-2xl font-bold text-slate-900 mb-2">Create your account</h2>
    <p class="text-slate-500 mb-6">Start your free trial today.</p>
    <form class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
        <input type="text" class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="John Doe">
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input type="email" class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="john@example.com">
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Password</label>
        <input type="password" class="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none" placeholder="8+ characters">
      </div>
      <button type="submit" class="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 transition">Sign Up</button>
    </form>
    <div class="flex items-center gap-3 my-6"><div class="flex-1 h-px bg-slate-200"></div><span class="text-xs text-slate-400">or continue with</span><div class="flex-1 h-px bg-slate-200"></div></div>
    <div class="flex gap-3">
      <button class="flex-1 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition font-medium">Google</button>
      <button class="flex-1 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-700 hover:bg-slate-50 transition font-medium">GitHub</button>
    </div>
  </div>
</section>""",
    ),
    ComponentSnippet(
        id="dashboard-metrics",
        name="Dashboard Metrics",
        category="dashboard",
        description="Metric cards row with trend indicators",
        html="""<div class="grid grid-cols-2 lg:grid-cols-4 gap-4 p-6">
  <div class="bg-white rounded-xl p-5 border border-slate-200">
    <p class="text-sm text-slate-500">Total Users</p>
    <p class="text-2xl font-bold text-slate-900 mt-1">12,456</p>
    <p class="text-xs text-emerald-600 mt-2">↑ 12.5% from last month</p>
  </div>
  <div class="bg-white rounded-xl p-5 border border-slate-200">
    <p class="text-sm text-slate-500">Revenue</p>
    <p class="text-2xl font-bold text-slate-900 mt-1">$84.2K</p>
    <p class="text-xs text-emerald-600 mt-2">↑ 8.1% from last month</p>
  </div>
  <div class="bg-white rounded-xl p-5 border border-slate-200">
    <p class="text-sm text-slate-500">Conversion</p>
    <p class="text-2xl font-bold text-slate-900 mt-1">3.24%</p>
    <p class="text-xs text-red-500 mt-2">↓ 0.3% from last month</p>
  </div>
  <div class="bg-white rounded-xl p-5 border border-slate-200">
    <p class="text-sm text-slate-500">Active Sessions</p>
    <p class="text-2xl font-bold text-slate-900 mt-1">1,893</p>
    <p class="text-xs text-emerald-600 mt-2">↑ 4.7% from last hour</p>
  </div>
</div>""",
    ),
]


def list_components() -> list[dict]:
    """List all available component snippets."""
    return [
        {"id": c.id, "name": c.name, "category": c.category, "description": c.description}
        for c in COMPONENTS
    ]


def get_component(component_id: str) -> ComponentSnippet | None:
    """Get a component snippet by ID."""
    for c in COMPONENTS:
        if c.id == component_id:
            return c
    return None


def get_components_by_category(category: str) -> list[ComponentSnippet]:
    """Get all components in a category."""
    return [c for c in COMPONENTS if c.category == category]
